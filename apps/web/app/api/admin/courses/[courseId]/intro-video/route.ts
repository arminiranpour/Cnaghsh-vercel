import { MediaType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SessionUser } from "next-auth";

import { requireAdminSession } from "@/lib/auth/admin";
import { NO_STORE_HEADERS } from "@/lib/http";
import { createUploadedMediaAssetFromBuffer } from "@/lib/media/media-asset-upload";
import { MediaTranscodeDisabledError, queueMediaTranscode } from "@/lib/media/transcode";
import { prisma } from "@/lib/prisma";
import { remove } from "@/lib/storage/s3";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";

type IntroVideoResponse = {
  ok: boolean;
  error?: string;
  mediaId?: string | null;
  url?: string | null;
};

const MAX_VIDEO_MB = Number.parseInt(process.env.COURSE_INTRO_VIDEO_MAX_MB ?? "", 10);
const MAX_VIDEO_BYTES =
  Number.isFinite(MAX_VIDEO_MB) && MAX_VIDEO_MB > 0
    ? MAX_VIDEO_MB * 1024 * 1024
    : 600 * 1024 * 1024;

const normalizeMime = (value: string) => value.split(";")[0]?.trim().toLowerCase() ?? "";

const success = (payload: IntroVideoResponse) =>
  NextResponse.json(payload, { headers: NO_STORE_HEADERS });

const failure = (status: number, error: string) =>
  NextResponse.json({ ok: false, error }, { status, headers: NO_STORE_HEADERS });

type AdminSessionUser = SessionUser & { id: string };

const ensureAdmin = async (): Promise<AdminSessionUser | null> => {
  try {
    const { user } = await requireAdminSession();
    if (typeof user.id !== "string" || user.id.length === 0) {
      return null;
    }
    return { ...user, id: user.id };
  } catch (error) {
    return null;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
): Promise<NextResponse<IntroVideoResponse>> {
  const admin = await ensureAdmin();
  if (!admin) {
    return failure(401, "UNAUTHORIZED");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return failure(400, "INVALID_FORM_DATA");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return failure(400, "FILE_REQUIRED");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return failure(400, "INVALID_FILE");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return failure(400, "FILE_TOO_LARGE");
  }

  const normalizedType = normalizeMime(file.type);
  if (!["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"].includes(normalizedType)) {
    return failure(400, "UNSUPPORTED_MEDIA_TYPE");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { id: true },
  });
  if (!course) {
    return failure(404, "COURSE_NOT_FOUND");
  }

  let createdMediaId: string | null = null;
  let createdSourceKey: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await createUploadedMediaAssetFromBuffer({
      ownerUserId: admin.id,
      buffer,
      declaredMime: normalizedType,
      mediaType: MediaType.video,
      visibility: "public",
      sizeBytes: file.size,
    });
    createdMediaId = media.id;
    createdSourceKey = media.sourceKey;
    await queueMediaTranscode(media.id);
    await prisma.course.update({
      where: { id: course.id },
      data: { introVideoMediaAssetId: media.id },
    });

    revalidatePath(`/admin/courses/${course.id}`);
    revalidatePath(`/courses/${course.id}`);

    return success({
      ok: true,
      mediaId: media.id,
      url: null,
    });
  } catch (error) {
    if (createdMediaId) {
      await prisma.mediaAsset.delete({ where: { id: createdMediaId } }).catch(() => undefined);
    }
    if (createdSourceKey) {
      await remove(resolveBucketForVisibility("private"), createdSourceKey).catch(() => undefined);
    }
    if (error instanceof MediaTranscodeDisabledError) {
      return failure(503, "TRANSCODE_DISABLED");
    }
    return failure(500, "UPLOAD_FAILED");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
): Promise<NextResponse<IntroVideoResponse>> {
  const admin = await ensureAdmin();
  if (!admin) {
    return failure(401, "UNAUTHORIZED");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { id: true, introVideoMediaAssetId: true },
  });
  if (!course) {
    return failure(404, "COURSE_NOT_FOUND");
  }

  if (!course.introVideoMediaAssetId) {
    return success({ ok: true, mediaId: null, url: null });
  }

  try {
    await prisma.course.update({
      where: { id: course.id },
      data: { introVideoMediaAssetId: null },
    });

    revalidatePath(`/admin/courses/${course.id}`);
    revalidatePath(`/courses/${course.id}`);

    return success({ ok: true, mediaId: null, url: null });
  } catch (error) {
    return failure(500, "REMOVE_FAILED");
  }
}
