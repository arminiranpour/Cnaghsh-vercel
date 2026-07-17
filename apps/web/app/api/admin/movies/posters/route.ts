import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/admin";
import { NO_STORE_HEADERS } from "@/lib/http";
import { createReadyImageMediaAsset, ImageAssetProcessingError } from "@/lib/media/media-asset-images";

type UploadResponse =
  | { ok: true; mediaId: string }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

const failure = (status: number, error: string) =>
  NextResponse.json({ ok: false, error } satisfies UploadResponse, {
    status,
    headers: NO_STORE_HEADERS,
  });

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const { user } = await requireAdminSession();

    if (!user?.id) {
      return failure(401, "UNAUTHORIZED");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return failure(400, "فایل تصویر یافت نشد.");
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      return failure(400, "فایل تصویر معتبر نیست.");
    }

    if (file.size > MAX_BYTES) {
      return failure(422, "حجم تصویر باید کمتر از ۱۰ مگابایت باشد.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await createReadyImageMediaAsset({
      ownerUserId: user.id,
      buffer,
      declaredMime: file.type,
      visibility: "public",
      sizeBytes: file.size,
    });

    return NextResponse.json({ ok: true, mediaId: media.id }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof ImageAssetProcessingError) {
      return failure(422, "فقط تصاویر JPG، PNG، WEBP یا HEIC مجاز هستند.");
    }
    return failure(500, "بارگذاری تصویر ناموفق بود.");
  }
}
