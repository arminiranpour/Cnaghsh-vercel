import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
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

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      throw new MediaStorageError("نوع فایل پشتیبانی نمی شود.");
  }
}

function joinKey(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter((part) => part.length > 0)
    .join("/");
}

function buildProfileImageKey(userId: string, extension: string) {
  return joinKey(
    "uploads",
    "profile-images",
    userId,
    `${Date.now()}-${crypto.randomUUID()}.${extension}`,
  );
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
    throw new MediaStorageError("لطفاً تصویری با فرمت مجاز (PNG، JPEG یا WEBP) بارگذاری کنید.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = getExtension(file.type);
  const key = buildProfileImageKey(userId, extension);

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
    await putBuffer(bucket, key, buffer, file.type);
    return { url: getPublicMediaUrlFromKey(key) };
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

  const segments = key.split("/");
  if (segments.length < 4 || segments[0] !== "uploads" || segments[2] !== userId) {
    throw new MediaStorageError("دسترسی به حذف این فایل مجاز نیست.");
  }

  try {
    const bucket = resolveBucketForVisibility("public");
    await remove(bucket, key);
  } catch {
    throw new MediaStorageError(IMAGE_DELETE_ERROR);
  }
}
