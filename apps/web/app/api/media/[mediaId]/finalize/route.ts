import { randomUUID } from "node:crypto";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as Sentry from "@sentry/nextjs";
import { MediaStatus, MediaType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { NO_STORE_HEADERS } from "@/lib/http";
import { logError, logInfo } from "@/lib/logging";
import { finalizeStoredImageMediaAsset, ImageAssetProcessingError } from "@/lib/media/media-asset-images";
import { probeAvFile } from "@/lib/media/server-probe";
import { MediaTranscodeDisabledError, queueMediaTranscode } from "@/lib/media/transcode";
import { prisma } from "@/lib/prisma";
import { isMediaTranscodeEnabled } from "@/lib/queues/mediaTranscode.queue";
import { exists, getStream } from "@/lib/storage/s3";
import { storageConfig } from "@/lib/storage/config";
import { buffer as streamToBuffer } from "node:stream/consumers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

const privateBucket = storageConfig.privateBucket;

const sanitizeErrorMessage = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 500) {
    return trimmed;
  }
  return `${trimmed.slice(0, 497)}...`;
};

const createTempFilePath = (extension: string) => {
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return join(tmpdir(), `media-finalize-${randomUUID()}${safeExtension}`);
};

const markFailed = async (mediaId: string, message: string) => {
  await prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      status: MediaStatus.failed,
      errorMessage: sanitizeErrorMessage(message),
    },
  }).catch(() => undefined);
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { mediaId } = await context.params;
  if (!mediaId) {
    return NextResponse.json(
      { ok: false, errorCode: "INVALID_ID" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let userId: string | null = null;
  let sourceKey: string | null = null;

  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, errorCode: "UNAUTHORIZED" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    userId = session.user.id;

    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        ownerUserId: true,
        type: true,
        status: true,
        sourceKey: true,
        sizeBytes: true,
      },
    });

    if (!media || media.ownerUserId !== userId) {
      return NextResponse.json(
        { ok: false, errorCode: "NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    // اگر قبلاً آماده یا در حال پردازش است، چیزی برای انجام‌دادن نیست
    if (media.status === MediaStatus.ready || media.status === MediaStatus.processing) {
      logInfo("media.upload.finalize.skip", {
        mediaId,
        userId,
        status: media.status,
      });
      return NextResponse.json(
        { ok: true, status: media.status },
        { headers: NO_STORE_HEADERS },
      );
    }

    // اگر fail شده، نذار دوباره finalize بشه
    if (media.status === MediaStatus.failed) {
      logInfo("media.upload.finalize.invalid_state", {
        mediaId,
        userId,
        status: media.status,
      });
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_STATE" },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    sourceKey = media.sourceKey;

    logInfo("media.upload.finalize.start", {
      mediaId,
      userId,
      bucket: privateBucket,
      key: media.sourceKey,
      status: media.status,
      type: media.type,
    });

    const objectExists = await exists(privateBucket, media.sourceKey);
    if (!objectExists) {
      logError("media.upload.finalize.missing_source", {
        mediaId,
        userId,
        bucket: privateBucket,
        key: media.sourceKey,
      });
      return NextResponse.json(
        { ok: false, errorCode: "SOURCE_NOT_FOUND" },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    if (media.type === MediaType.image) {
      try {
        await finalizeStoredImageMediaAsset({
          id: media.id,
          sourceKey: media.sourceKey,
          sizeBytes: media.sizeBytes,
        });
      } catch (error) {
        const message =
          error instanceof ImageAssetProcessingError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Image processing failed";
        await markFailed(media.id, message);
        return NextResponse.json(
          {
            ok: false,
            errorCode: "PROCESSING_FAILED",
            messageFa: "پردازش تصویر ناموفق بود.",
          },
          { status: 422, headers: NO_STORE_HEADERS },
        );
      }

      logInfo("media.upload.finalize.image_ready", {
        mediaId,
        userId,
        bucket: privateBucket,
        sourceKey,
      });

      return NextResponse.json(
        { ok: true, status: MediaStatus.ready },
        { headers: NO_STORE_HEADERS },
      );
    }

    if (media.type !== MediaType.video && media.type !== MediaType.audio) {
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_MEDIA_TYPE" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!isMediaTranscodeEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "DEMO_DISABLED",
          messageFa: "پردازش این رسانه در نسخه دمو غیرفعال است.",
        },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    let tempPath: string | null = null;
    try {
      const extension = media.sourceKey.includes(".")
        ? `.${media.sourceKey.split(".").pop() ?? "bin"}`
        : ".bin";
      tempPath = createTempFilePath(extension);
      const stream = await getStream(privateBucket, media.sourceKey);
      const sourceBuffer = Buffer.from(await streamToBuffer(stream));
      await writeFile(tempPath, sourceBuffer);
      const probed = await probeAvFile(tempPath);
      if (media.type === MediaType.video && probed.type !== "video") {
        await markFailed(media.id, "Uploaded file is not a valid video");
        return NextResponse.json(
          { ok: false, errorCode: "INVALID_MIME", messageFa: "نوع واقعی فایل ویدیویی نیست." },
          { status: 415, headers: NO_STORE_HEADERS },
        );
      }
      if (media.type === MediaType.audio && probed.type !== "audio") {
        await markFailed(media.id, "Uploaded file is not a valid audio file");
        return NextResponse.json(
          { ok: false, errorCode: "INVALID_MIME", messageFa: "نوع واقعی فایل صوتی نیست." },
          { status: 415, headers: NO_STORE_HEADERS },
        );
      }

      await queueMediaTranscode(media.id);
    } catch (error) {
      if (error instanceof MediaTranscodeDisabledError) {
        return NextResponse.json(
          {
            ok: false,
            errorCode: "DEMO_DISABLED",
            messageFa: "پردازش این رسانه در نسخه دمو غیرفعال است.",
          },
          { status: 503, headers: NO_STORE_HEADERS },
        );
      }
      const message = error instanceof Error ? error.message : "unknown";
      await markFailed(media.id, message);
      return NextResponse.json(
        {
          ok: false,
          errorCode: "PROCESSING_FAILED",
          messageFa: "فایل رسانه معتبر نیست یا پردازش آن ممکن نشد.",
        },
        { status: 422, headers: NO_STORE_HEADERS },
      );
    } finally {
      if (tempPath) {
        await rm(tempPath, { force: true }).catch(() => undefined);
      }
    }

    logInfo("media.upload.finalize.success", {
      mediaId,
      userId,
      bucket: privateBucket,
      sourceKey,
    });

    return NextResponse.json(
      { ok: true, status: MediaStatus.processing },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    Sentry.captureException(error);
    logError("media.upload.finalize.error", {
      mediaId,
      userId: typeof userId === "string" ? userId : null,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
      bucket: privateBucket,
      key: sourceKey,
    });
    return NextResponse.json(
      { ok: false, errorCode: "UNKNOWN" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
