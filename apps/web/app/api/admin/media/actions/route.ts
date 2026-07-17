import { MediaModerationStatus, MediaVisibility } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/admin";
import { NO_STORE_HEADERS } from "@/lib/http";
import { listDerivedOutputKeys } from "@/lib/media/derived-storage";
import { MediaTranscodeDisabledError, queueMediaTranscode } from "@/lib/media/transcode";
import { prisma } from "@/lib/prisma";
import { isMediaTranscodeEnabled } from "@/lib/queues/mediaTranscode.queue";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";
import { remove } from "@/lib/storage/s3";

type AdminMediaAction =
  | { type: "REQUEUE_TRANSCODE"; mediaId: string }
  | { type: "MARK_REJECTED"; mediaId: string; reason?: string }
  | { type: "TOGGLE_VISIBILITY"; mediaId: string; visibility: "public" | "private" }
  | { type: "DELETE_MEDIA"; mediaId: string };

type ActionResponse = { ok: boolean; error?: string };

const success = (): NextResponse<ActionResponse> => {
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
};

const failure = (status: number, error: string): NextResponse<ActionResponse> => {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE_HEADERS });
};

const assertAdminId = (userId: string | undefined): string | null => {
  if (!userId || userId.length === 0) {
    return null;
  }
  return userId;
};

const handleRequeue = async (mediaId: string) => {
  if (!isMediaTranscodeEnabled()) {
    return failure(503, "صف پردازش ویدیو در نسخه دمو غیرفعال است.");
  }

  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { id: true, type: true },
  });

  if (!media) {
    return failure(404, "MEDIA_NOT_FOUND");
  }

  if (media.type !== "video" && media.type !== "audio") {
    return failure(400, "MEDIA_TYPE_NOT_REQUEUEABLE");
  }

  try {
    await queueMediaTranscode(mediaId);
  } catch (error) {
    if (error instanceof MediaTranscodeDisabledError) {
      return failure(503, "صف پردازش ویدیو در نسخه دمو غیرفعال است.");
    }
    throw error;
  }
  return success();
};

const handleReject = async (mediaId: string, reason: string | undefined, adminId: string) => {
  const trimmedReason = reason?.trim() ?? "";
  const now = new Date();
  try {
    await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        moderationStatus: MediaModerationStatus.rejected,
        moderationReason: trimmedReason.length > 0 ? trimmedReason : null,
        moderationReviewedAt: now,
        moderationReviewedById: adminId,
        visibility: MediaVisibility.private,
      },
    });
    return success();
  } catch (error) {
    return failure(404, "MEDIA_NOT_FOUND");
  }
};

const handleToggleVisibility = async (mediaId: string, visibility: "public" | "private", adminId: string) => {
  const now = new Date();
  try {
    await prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        visibility,
        moderationStatus:
          visibility === "public" ? MediaModerationStatus.approved : undefined,
        moderationReason: visibility === "public" ? null : undefined,
        moderationReviewedAt: now,
        moderationReviewedById: adminId,
      },
    });
    return success();
  } catch (error) {
    return failure(404, "MEDIA_NOT_FOUND");
  }
};

const handleDelete = async (mediaId: string) => {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      type: true,
      sourceKey: true,
      outputKey: true,
      posterKey: true,
      visibility: true,
    },
  });

  if (!media) {
    return failure(404, "MEDIA_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.transcodeJob.deleteMany({ where: { mediaAssetId: mediaId } });
    await tx.mediaAsset.delete({ where: { id: mediaId } });
  });

  const deleteTasks: Array<Promise<unknown>> = [];
  const privateBucket = resolveBucketForVisibility("private");
  const outputBucket = resolveBucketForVisibility("public");
  deleteTasks.push(
    remove(privateBucket, media.sourceKey).catch(() => undefined),
  );
  for (const key of listDerivedOutputKeys(media)) {
    deleteTasks.push(remove(outputBucket, key).catch(() => undefined));
  }
  await Promise.allSettled(deleteTasks);

  return success();
};

export async function POST(request: NextRequest): Promise<NextResponse<ActionResponse>> {
  const { user } = await requireAdminSession();

  let payload: AdminMediaAction;
  try {
    payload = (await request.json()) as AdminMediaAction;
  } catch (error) {
    return failure(400, "INVALID_PAYLOAD");
  }

  if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
    return failure(400, "INVALID_PAYLOAD");
  }

  if (!payload.mediaId || typeof payload.mediaId !== "string") {
    return failure(400, "INVALID_MEDIA_ID");
  }

  switch (payload.type) {
    case "REQUEUE_TRANSCODE":
      return handleRequeue(payload.mediaId);
    case "MARK_REJECTED": {
      const adminId = assertAdminId(user.id);
      if (!adminId) {
        return failure(400, "ADMIN_ID_REQUIRED");
      }
      return handleReject(payload.mediaId, payload.reason, adminId);
    }
    case "TOGGLE_VISIBILITY": {
      if (payload.visibility !== "public" && payload.visibility !== "private") {
        return failure(400, "INVALID_VISIBILITY");
      }
      const adminId = assertAdminId(user.id);
      if (!adminId) {
        return failure(400, "ADMIN_ID_REQUIRED");
      }
      return handleToggleVisibility(payload.mediaId, payload.visibility, adminId);
    }
    case "DELETE_MEDIA":
      return handleDelete(payload.mediaId);
    default:
      return failure(400, "UNKNOWN_ACTION");
  }
}
