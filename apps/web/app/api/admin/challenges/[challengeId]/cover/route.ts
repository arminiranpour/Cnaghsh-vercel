import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SessionUser } from "next-auth";

import { requireAdminSession } from "@/lib/auth/admin";
import { NO_STORE_HEADERS } from "@/lib/http";
import { createReadyImageMediaAsset, ImageAssetProcessingError } from "@/lib/media/media-asset-images";
import { prisma } from "@/lib/prisma";

type CoverResponse = {
  ok: boolean;
  error?: string;
  mediaId?: string | null;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const success = (payload: CoverResponse) =>
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
  { params }: { params: { challengeId: string } },
): Promise<NextResponse<CoverResponse>> {
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
  if (file.size > MAX_IMAGE_BYTES) {
    return failure(400, "FILE_TOO_LARGE");
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.challengeId },
    select: { id: true },
  });
  if (!challenge) {
    return failure(404, "CHALLENGE_NOT_FOUND");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await createReadyImageMediaAsset({
      ownerUserId: admin.id,
      buffer,
      declaredMime: file.type,
      visibility: "public",
      sizeBytes: file.size,
    });

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { coverMediaAssetId: media.id },
    });

    revalidatePath(`/admin/challenges/${challenge.id}/edit`);
    revalidatePath("/admin/challenges");
    revalidatePath(`/challenges/${challenge.id}`);
    revalidatePath("/challenges");

    return success({ ok: true, mediaId: media.id });
  } catch (error) {
    if (error instanceof ImageAssetProcessingError) {
      return failure(400, "UNSUPPORTED_MEDIA_TYPE");
    }
    return failure(500, "UPLOAD_FAILED");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { challengeId: string } },
): Promise<NextResponse<CoverResponse>> {
  const admin = await ensureAdmin();
  if (!admin) {
    return failure(401, "UNAUTHORIZED");
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.challengeId },
    select: { id: true, coverMediaAssetId: true },
  });
  if (!challenge) {
    return failure(404, "CHALLENGE_NOT_FOUND");
  }

  if (!challenge.coverMediaAssetId) {
    return success({ ok: true, mediaId: null });
  }

  try {
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { coverMediaAssetId: null },
    });

    revalidatePath(`/admin/challenges/${challenge.id}/edit`);
    revalidatePath("/admin/challenges");
    revalidatePath(`/challenges/${challenge.id}`);
    revalidatePath("/challenges");

    return success({ ok: true, mediaId: null });
  } catch (error) {
    return failure(500, "REMOVE_FAILED");
  }
}
