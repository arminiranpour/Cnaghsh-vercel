import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import { uploadConfig } from "@/lib/media/config";
import { detectImageMimeFromBuffer, processImageBuffer } from "@/lib/media/image-processing";
import { getProfileImageVariantKey } from "@/lib/storage/keys";

const ALLOWED_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const STORAGE_CONFIG_ERROR = "تنظیمات ذخیره سازی تصاویر کامل نیست.";
const IMAGE_UPLOAD_ERROR = "بارگذاری تصویر ناموفق بود.";
const IMAGE_DELETE_ERROR = "حذف تصویر ناموفق بود.";

export class MediaStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaStorageError";
  }
}

export function isMediaStorageError(error: unknown): error is MediaStorageError {
  return error instanceof MediaStorageError;
}

function parsePublicObjectKey(url: string, publicBaseUrl: string): string | null {
  const publicBase = new URL(publicBaseUrl);
  const target = new URL(url);

  if (publicBase.origin !== target.origin) {
    return null;
  }

  const basePath = `${publicBase.pathname.replace(/\/+$/, "")}/`;
  if (!target.pathname.startsWith(basePath)) {
    return null;
  }

  const encodedKey = target.pathname.slice(basePath.length);
  if (!encodedKey) {
    return null;
  }

  return encodedKey
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

const isEquivalentImageMime = (declared: string, detected: string) => {
  const normalize = (value: string) => value.trim().toLowerCase();
  const left = normalize(declared);
  const right = normalize(detected);

  if (left === right) {
    return true;
  }
  if ((left === "image/jpeg" || left === "image/jpg") && right === "image/jpeg") {
    return true;
  }
  if ((left === "image/heic" || left === "image/heif") && (right === "image/heic" || right === "image/heif")) {
    return true;
  }
  return false;
};

const parseResponsiveProfileImageKey = (key: string) => {
  const match = key.match(/^uploads\/profile-images\/([^/]+)\/([^/]+)\/(\d+)\.webp$/i);
  if (!match) {
    return null;
  }
  return {
    ownerUserId: match[1] ?? "",
    imageId: match[2] ?? "",
    width: Number.parseInt(match[3] ?? "", 10),
  };
};

const PUBLIC_DIR = (() => {
  const cwd = process.cwd();
  const direct = path.join(cwd, "public");
  if (existsSync(direct)) {
    return direct;
  }
  return path.join(cwd, "apps", "web", "public");
})();

export async function saveImageFromFormData(
  formData: FormData,
  userId: string,
): Promise<{ url: string }> {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new MediaStorageError("فایل تصویر یافت نشد.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new MediaStorageError("لطفاً تصویری با فرمت مجاز (PNG، JPEG، WEBP یا HEIC) بارگذاری کنید.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detectedMime = await detectImageMimeFromBuffer(buffer).catch(() => null);
  if (!detectedMime) {
    throw new MediaStorageError("فایل تصویر معتبر نیست.");
  }
  if (file.type && !isEquivalentImageMime(file.type, detectedMime)) {
    throw new MediaStorageError("نوع واقعی فایل تصویر با نوع اعلام‌شده مطابقت ندارد.");
  }

  const imageId = `${Date.now()}-${crypto.randomUUID()}`;
  const processed = await processImageBuffer(
    buffer,
    uploadConfig.imageWebpQuality,
    uploadConfig.responsiveImageWidths,
  );

  let putBuffer: typeof import("@/lib/storage/s3").putBuffer;
  let resolveBucketForVisibility: typeof import("@/lib/storage/visibility").resolveBucketForVisibility;
  let getPublicMediaUrlFromKey: typeof import("@/lib/media/urls").getPublicMediaUrlFromKey;

  try {
    ([{ putBuffer }, { resolveBucketForVisibility }, { getPublicMediaUrlFromKey }] =
      await Promise.all([
        import("@/lib/storage/s3"),
        import("@/lib/storage/visibility"),
        import("@/lib/media/urls"),
      ]));
  } catch {
    throw new MediaStorageError(STORAGE_CONFIG_ERROR);
  }

  try {
    const bucket = resolveBucketForVisibility("public");
    for (const variant of processed.variants) {
      const key = getProfileImageVariantKey(userId, imageId, variant.width);
      await putBuffer(bucket, key, variant.buffer, "image/webp");
    }
    const largestVariant = processed.variants[processed.variants.length - 1];
    if (!largestVariant) {
      throw new MediaStorageError("تبدیل تصویر ناموفق بود.");
    }
    const largestKey = getProfileImageVariantKey(userId, imageId, largestVariant.width);
    return { url: getPublicMediaUrlFromKey(largestKey) };
  } catch {
    throw new MediaStorageError(IMAGE_UPLOAD_ERROR);
  }
}

export async function deleteByUrl(url: string, userId: string): Promise<void> {
  if (url.startsWith("/uploads/")) {
    const normalized = url.replace(/^\/+/, "");
    const segments = normalized.split("/");

    if (segments.length < 3 || segments[0] !== "uploads" || segments[1] !== userId) {
      throw new MediaStorageError("دسترسی به حذف این فایل مجاز نیست.");
    }

    const filePath = path.join(PUBLIC_DIR, normalized);
    await fs.rm(filePath, { force: true });
    return;
  }

  let mediaCdnConfig: typeof import("@/lib/media/cdn-config").mediaCdnConfig;
  let remove: typeof import("@/lib/storage/s3").remove;
  let resolveBucketForVisibility: typeof import("@/lib/storage/visibility").resolveBucketForVisibility;

  try {
    ([{ mediaCdnConfig }, { remove }, { resolveBucketForVisibility }] = await Promise.all([
      import("@/lib/media/cdn-config"),
      import("@/lib/storage/s3"),
      import("@/lib/storage/visibility"),
    ]));
  } catch {
    throw new MediaStorageError(STORAGE_CONFIG_ERROR);
  }

  let key: string | null = null;
  try {
    key = parsePublicObjectKey(url, mediaCdnConfig.publicBaseUrl);
  } catch {
    key = null;
  }

  if (!key) {
    throw new MediaStorageError("آدرس فایل نامعتبر است.");
  }

  const responsiveKey = parseResponsiveProfileImageKey(key);
  if (responsiveKey) {
    if (responsiveKey.ownerUserId !== userId) {
      throw new MediaStorageError("دسترسی به حذف این فایل مجاز نیست.");
    }
  } else {
    const segments = key.split("/");
    if (segments.length < 4 || segments[0] !== "uploads" || segments[2] !== userId) {
      throw new MediaStorageError("دسترسی به حذف این فایل مجاز نیست.");
    }
  }

  try {
    const bucket = resolveBucketForVisibility("public");
    if (responsiveKey) {
      const widths = Array.from(new Set([
        ...uploadConfig.responsiveImageWidths,
        responsiveKey.width,
      ]));
      await Promise.all(
        widths.map((width) =>
          remove(bucket, getProfileImageVariantKey(userId, responsiveKey.imageId, width)).catch(() => undefined),
        ),
      );
      return;
    }

    await remove(bucket, key);
  } catch {
    throw new MediaStorageError(IMAGE_DELETE_ERROR);
  }
}
