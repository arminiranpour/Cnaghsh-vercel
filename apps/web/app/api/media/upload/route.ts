import { randomUUID } from "node:crypto";

import { MediaStatus, MediaType, MediaVisibility } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { NO_STORE_HEADERS, safeJson } from "@/lib/http";
import { logError, logInfo } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { uploadConfig } from "@/lib/media/config";
import {
  getExtensionForMime,
  getMediaTypeFromMime,
  normalizeMime,
} from "@/lib/media/formats";
import { createReadyImageMediaAsset } from "@/lib/media/media-asset-images";
import { MediaTranscodeDisabledError, queueMediaTranscode } from "@/lib/media/transcode";
import {
  canUploadVideo,
  getUserMediaEntitlements,
} from "@/lib/media/entitlements";
import { sniffMimeFromFile } from "@/lib/media/mime-sniff";
import type { UploadInitResponse, UploadMode } from "@/lib/media/types";
import {
  isAllowedMime,
  isWithinSizeLimit,
  parseUploadRequest,
  validateDuration,
  validateDeclaredMedia,
} from "@/lib/media/validation";
import { isMediaTranscodeEnabled } from "@/lib/queues/mediaTranscode.queue";
import { getDailyBytes, assertWithinRateLimit, trackDailyBytes, RateLimitExceededError } from "@/lib/rate-limit";
import { cacheOriginal } from "@/lib/storage/headers";
import { getOriginalKey } from "@/lib/storage/keys";
import { getSignedPutUrl } from "@/lib/storage/signing";
import { putBuffer } from "@/lib/storage/s3";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type UploadMetadata = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  estimatedDurationSec?: number;
};

type MultipartMetadata = UploadMetadata & { file: File };

type ErrorTuple = { status: number; code: "INVALID_MIME" | "TOO_LARGE" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "DURATION_EXCEEDED" | "DEMO_DISABLED" | "UNKNOWN"; message: string };

const privateBucket = resolveBucketForVisibility("private");

const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first) {
      return first.trim();
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "";
};

const errorResponse = ({ status, code, message }: ErrorTuple) => {
  return NextResponse.json(
    {
      ok: false,
      errorCode: code,
      messageFa: message,
    },
    { status, headers: NO_STORE_HEADERS },
  );
};

const respondWithError = (
  error: ErrorTuple,
  fields?: Record<string, unknown>,
) => {
  logError("upload.init.failure", {
    status: error.status,
    code: error.code,
    ...(fields ?? {}),
  });
  return errorResponse(error);
};

const ensureDailyQuota = async (userId: string, sizeBytes: number) => {
  const todayBytes = await getDailyBytes(userId);
  if (todayBytes + sizeBytes > uploadConfig.dailyUserCapBytes) {
    return respondWithError(
      {
        status: 429,
        code: "QUOTA_EXCEEDED",
        message: "سقف روزانه حجم آپلود شما تکمیل شده است.",
      },
      {
        userId,
        todayBytes,
        sizeBytes,
        reason: "quota_exceeded",
      },
    );
  }
  return null;
};

const createMediaAssetRecord = async (
  ownerUserId: string,
  extension: string,
  sizeBytes: number,
  type: MediaType,
) => {
  const mediaId = randomUUID();
  const sourceKey = getOriginalKey(ownerUserId, mediaId, extension);
  const media = await prisma.mediaAsset.create({
    data: {
      id: mediaId,
      type,
      status: MediaStatus.uploaded,
      visibility: MediaVisibility.private,
      ownerUserId,
      sourceKey,
      sizeBytes: BigInt(sizeBytes),
    },
  });
  return media;
};

const successResponse = (
  mediaId: string,
  sourceKey: string,
  mode: UploadMode,
  signedUrl?: string,
) => {
  const finalizeUrl = mode === "signed-put" ? `/api/media/${mediaId}/finalize` : undefined;
  const payload: UploadInitResponse = {
    ok: true,
    mediaId,
    mode,
    sourceKey,
    signedUrl,
    maxSingleUploadBytes: uploadConfig.maxSingleUploadBytes,
    next: { checkStatusUrl: `/api/media/${mediaId}/status`, finalizeUrl },
  };
  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
};

const evaluatePlanLimits = async (
  userId: string,
  metadata: UploadMetadata,
) => {
  const entitlements = await getUserMediaEntitlements(userId);
  const estimatedDuration = metadata.estimatedDurationSec ?? 0;
  if (!validateDuration(estimatedDuration, entitlements.maxDurationPerVideoSec)) {
    return respondWithError(
      {
        status: 422,
        code: "DURATION_EXCEEDED",
        message: "مدت ویدیو از سقف طرح شما بیشتر است.",
      },
      {
        userId,
        reason: "duration_limit",
        estimatedDurationSec: estimatedDuration,
        planDurationLimitSec: entitlements.maxDurationPerVideoSec,
      },
    );
  }
  const decision = await canUploadVideo(
    userId,
    metadata.sizeBytes,
    estimatedDuration,
    entitlements,
  );
  if (!decision.ok) {
    const message =
      decision.reason === "DURATION_LIMIT"
        ? "مدت ویدیو از سقف طرح شما بیشتر است."
        : "شما به سقف مجاز بارگذاری رسیده‌اید.";
    return respondWithError(
      {
        status: 429,
        code: decision.reason === "DURATION_LIMIT" ? "DURATION_EXCEEDED" : "QUOTA_EXCEEDED",
        message,
      },
      {
        userId,
        reason: decision.reason,
        sizeBytes: metadata.sizeBytes,
        estimatedDurationSec: estimatedDuration,
      },
    );
  }
  return null;
};

const prepareUpload = async (
  userId: string,
  metadata: UploadMetadata,
  mode: UploadMode,
  fileBuffer?: Buffer,
) => {
  const normalizedMime = normalizeMime(metadata.contentType);
  const mediaType = validateDeclaredMedia(metadata.fileName, normalizedMime);
  const isAudio = mediaType === MediaType.audio;
  const isImage = mediaType === MediaType.image;

  const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  if (isAudio && metadata.sizeBytes > MAX_AUDIO_BYTES) {
    return respondWithError(
      {
        status: 400,
        code: "TOO_LARGE",
        message: "حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشد.",
      },
      {
        userId,
        reason: "audio_too_large",
        sizeBytes: metadata.sizeBytes,
        limit: MAX_AUDIO_BYTES,
      },
    );
  }
  if (!normalizedMime || !isAllowedMime(normalizedMime) || !mediaType) {
    return respondWithError(
      {
        status: 415,
        code: "INVALID_MIME",
        message: "نوع فایل مجاز نیست.",
      },
      {
        userId,
        reason: "invalid_mime",
        contentType: metadata.contentType,
      },
    );
  }

  if (!isWithinSizeLimit(metadata.sizeBytes)) {
    return respondWithError(
      {
        status: 413,
        code: "TOO_LARGE",
        message: "حجم فایل از حد مجاز بیشتر است.",
      },
      {
        userId,
        reason: "size_limit",
        sizeBytes: metadata.sizeBytes,
      },
    );
  }

  const quotaError = await ensureDailyQuota(userId, metadata.sizeBytes);
  if (quotaError) {
    return quotaError;
  }

  const planError = mediaType === MediaType.image ? null : await evaluatePlanLimits(userId, metadata);
  if (planError) {
    return planError;
  }

  const extension = getExtensionForMime(normalizedMime);
  if (!extension) {
    return respondWithError(
      {
        status: 415,
        code: "INVALID_MIME",
        message: "نوع فایل مجاز نیست.",
      },
      {
        userId,
        reason: "missing_extension",
        normalizedMime,
      },
    );
  }

  if ((mediaType === MediaType.video || mediaType === MediaType.audio) && !isMediaTranscodeEnabled()) {
    return respondWithError(
      {
        status: 503,
        code: "DEMO_DISABLED",
        message: "پردازش این رسانه در نسخه دمو غیرفعال است.",
      },
      {
        userId,
        reason: "media_transcode_disabled",
        mode,
      },
    );
  }

  if (mode === "multipart" && fileBuffer && isImage) {
    const media = await createReadyImageMediaAsset({
      ownerUserId: userId,
      buffer: fileBuffer,
      declaredMime: normalizedMime,
      visibility: MediaVisibility.private,
      sizeBytes: metadata.sizeBytes,
    });

    await trackDailyBytes(userId, metadata.sizeBytes);

    logInfo("upload.init.image_ready_multipart", {
      userId,
      mediaId: media.id,
      contentType: normalizedMime,
      sizeBytes: metadata.sizeBytes,
    });

    return successResponse(media.id, media.sourceKey, mode);
  }

  const media = await createMediaAssetRecord(userId, extension, metadata.sizeBytes, mediaType);

  if (mode === "multipart" && fileBuffer) {
    await putBuffer(privateBucket, media.sourceKey, fileBuffer, normalizedMime, cacheOriginal());
    try {
      await queueMediaTranscode(media.id);
    } catch (error) {
      if (error instanceof MediaTranscodeDisabledError) {
        await prisma.mediaAsset.delete({ where: { id: media.id } }).catch(() => undefined);
        return respondWithError(
          {
            status: 503,
            code: "DEMO_DISABLED",
            message: "پردازش این رسانه در نسخه دمو غیرفعال است.",
          },
          {
            userId,
            mediaId: media.id,
            reason: "media_transcode_disabled",
            mode,
          },
        );
      }
      throw error;
    }
  }

  const signedUrl =
    mode === "signed-put"
      ? await getSignedPutUrl(privateBucket, media.sourceKey, normalizedMime)
      : undefined;

  await trackDailyBytes(userId, metadata.sizeBytes);

  logInfo("upload.init.success", {
    userId,
    mediaId: media.id,
    mode,
    contentType: normalizedMime,
    sizeBytes: metadata.sizeBytes,
    estimatedDurationSec: metadata.estimatedDurationSec ?? null,
  });

  return successResponse(media.id, media.sourceKey, mode, signedUrl);
};

const parseMultipartMetadata = async (
  request: NextRequest,
  userId: string,
): Promise<{ metadata?: MultipartMetadata; error?: NextResponse }> => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return {
      error: respondWithError(
        {
          status: 400,
          code: "UNKNOWN",
          message: "فایل ارسال‌شده معتبر نیست.",
        },
        { userId, reason: "missing_file_field" },
      ),
    };
  }
  const fileName = file.name && file.name.length > 0 ? file.name : `upload-${Date.now()}`;
  const manualMime = formData.get("contentType");
  const declaredMime = typeof manualMime === "string" && manualMime.trim().length > 0 ? manualMime : file.type;
  const durationField = formData.get("estimatedDurationSec");
  let estimatedDurationSec: number | undefined;
  if (typeof durationField === "string" && durationField.trim().length > 0) {
    const parsed = Number.parseInt(durationField, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      estimatedDurationSec = parsed;
    }
  }
  return {
    metadata: {
      fileName,
      contentType: declaredMime,
      sizeBytes: Math.floor(file.size),
      estimatedDurationSec,
      file,
    },
  };
};

export async function POST(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return respondWithError(
      {
        status: 401,
        code: "UNKNOWN",
        message: "لطفاً ابتدا وارد حساب کاربری شوید.",
      },
      { reason: "unauthenticated" },
    );
  }
  const ownerUserId = session.user.id;
  try {
    await assertWithinRateLimit({ userId: ownerUserId, ip: getClientIp(request) });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return respondWithError(
        {
          status: 429,
          code: "RATE_LIMITED",
          message: "درخواست‌های شما بیش از حد مجاز است. بعداً دوباره تلاش کنید.",
        },
        { userId: ownerUserId, reason: "rate_limit" },
      );
    }
    throw error;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const { metadata, error } = await parseMultipartMetadata(request, ownerUserId);
      if (error) {
        return error;
      }
      if (!metadata) {
        return respondWithError(
          {
            status: 400,
            code: "UNKNOWN",
            message: "داده‌های ارسالی معتبر نیست.",
          },
          { userId: ownerUserId, reason: "missing_metadata", mode: "multipart" },
        );
      }
      const normalizedMime = normalizeMime(metadata.contentType);
      if (!normalizedMime) {
        return respondWithError(
          {
            status: 415,
            code: "INVALID_MIME",
            message: "نوع فایل مجاز نیست.",
          },
          { userId: ownerUserId, reason: "invalid_mime", mode: "multipart" },
        );
      }
      const sniffed = await sniffMimeFromFile(metadata.file);
      if (sniffed) {
        const declaredType = getMediaTypeFromMime(normalizedMime);
        const sniffedType = getMediaTypeFromMime(sniffed);
        const sameFamily = declaredType && sniffedType && declaredType === sniffedType;
        const equivalentHeif =
          (normalizedMime === "image/heic" || normalizedMime === "image/heif")
          && (sniffed === "image/heic" || sniffed === "image/heif");
        const equivalentJpeg =
          (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg")
          && sniffed === "image/jpeg";

        if (!sameFamily || (!equivalentHeif && !equivalentJpeg && sniffed !== normalizedMime)) {
          return respondWithError(
            {
              status: 415,
              code: "INVALID_MIME",
              message: "نوع فایل مجاز نیست.",
            },
            { userId: ownerUserId, reason: "sniff_mismatch", mode: "multipart", sniffed },
          );
        }
      }
      const buffer = Buffer.from(await metadata.file.arrayBuffer());
      return prepareUpload(
        ownerUserId,
        {
          fileName: metadata.fileName,
          contentType: normalizedMime,
          sizeBytes: buffer.length,
          estimatedDurationSec: metadata.estimatedDurationSec,
        },
        "multipart",
        buffer,
      );
    }

    const parsed = await safeJson<unknown>(request);
    if (!parsed.ok) {
      return respondWithError(
        {
          status: 400,
          code: "UNKNOWN",
          message: "داده‌های ارسالی معتبر نیست.",
        },
        { userId: ownerUserId, reason: "invalid_json" },
      );
    }
    let metadata: UploadMetadata;
    try {
      metadata = parseUploadRequest(parsed.data);
    } catch (error) {
      return respondWithError(
        {
          status: 400,
          code: "UNKNOWN",
          message: "داده‌های ارسالی معتبر نیست.",
        },
        { userId: ownerUserId, reason: "invalid_payload" },
      );
    }
    const normalizedMime = normalizeMime(metadata.contentType);
    return prepareUpload(
      ownerUserId,
      {
        fileName: metadata.fileName,
        contentType: normalizedMime,
        sizeBytes: Math.floor(metadata.sizeBytes),
        estimatedDurationSec: metadata.estimatedDurationSec,
      },
      "signed-put",
    );
  } catch (error) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : "unknown";
    return respondWithError(
      {
        status: 500,
        code: "UNKNOWN",
        message: "خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.",
      },
      {
        userId: ownerUserId,
        reason: "unexpected",
        errorMessage: message,
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
  }
}
