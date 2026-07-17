import { z } from "zod";

import { env } from "@/lib/env";

const schema = z.object({
  UPLOAD_ALLOWED_TYPES: z.string().min(1),
  UPLOAD_MAX_SIZE_MB_DEV: z.string().min(1),
  UPLOAD_MAX_SIZE_MB_PROD: z.string().min(1),
  UPLOAD_MAX_DURATION_SEC: z.string().min(1),
  UPLOAD_DAILY_USER_CAP_GB: z.string().min(1),
  UPLOAD_RATE_LIMIT_PER_MIN: z.string().min(1),
  UPLOAD_RATE_LIMIT_BURST: z.string().min(1),
  IMAGE_WEBP_QUALITY: z.string().optional(),
  IMAGE_RESPONSIVE_WIDTHS: z.string().optional(),
});

const raw = schema.parse({
  UPLOAD_ALLOWED_TYPES: process.env.UPLOAD_ALLOWED_TYPES,
  UPLOAD_MAX_SIZE_MB_DEV: process.env.UPLOAD_MAX_SIZE_MB_DEV,
  UPLOAD_MAX_SIZE_MB_PROD: process.env.UPLOAD_MAX_SIZE_MB_PROD,
  UPLOAD_MAX_DURATION_SEC: process.env.UPLOAD_MAX_DURATION_SEC,
  UPLOAD_DAILY_USER_CAP_GB: process.env.UPLOAD_DAILY_USER_CAP_GB,
  UPLOAD_RATE_LIMIT_PER_MIN: process.env.UPLOAD_RATE_LIMIT_PER_MIN,
  UPLOAD_RATE_LIMIT_BURST: process.env.UPLOAD_RATE_LIMIT_BURST,
  IMAGE_WEBP_QUALITY: process.env.IMAGE_WEBP_QUALITY,
  IMAGE_RESPONSIVE_WIDTHS: process.env.IMAGE_RESPONSIVE_WIDTHS,
});

const parsePositiveNumber = (value: string, label: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return parsed;
};

const allowedTypes = raw.UPLOAD_ALLOWED_TYPES.split(",")
  .map((type) => type.trim().toLowerCase())
  .filter((type) => type.length > 0);

if (allowedTypes.length === 0) {
  throw new Error("UPLOAD_ALLOWED_TYPES must include at least one MIME type");
}

const maxSizeMb = env.NODE_ENV === "production"
  ? parsePositiveNumber(raw.UPLOAD_MAX_SIZE_MB_PROD, "UPLOAD_MAX_SIZE_MB_PROD")
  : parsePositiveNumber(raw.UPLOAD_MAX_SIZE_MB_DEV, "UPLOAD_MAX_SIZE_MB_DEV");

const responsiveWidths = (raw.IMAGE_RESPONSIVE_WIDTHS ?? "320,640,1280,1600")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0)
  .sort((a, b) => a - b);

if (responsiveWidths.length === 0) {
  throw new Error("IMAGE_RESPONSIVE_WIDTHS must include at least one positive width");
}

const imageWebpQuality = raw.IMAGE_WEBP_QUALITY
  ? Math.round(parsePositiveNumber(raw.IMAGE_WEBP_QUALITY, "IMAGE_WEBP_QUALITY"))
  : 82;

if (imageWebpQuality < 1 || imageWebpQuality > 100) {
  throw new Error("IMAGE_WEBP_QUALITY must be between 1 and 100");
}

const uploadConfig = {
  allowedTypes: new Set(allowedTypes),
  maxSingleUploadBytes: Math.floor(maxSizeMb * 1024 * 1024),
  maxDurationSec: Math.floor(parsePositiveNumber(raw.UPLOAD_MAX_DURATION_SEC, "UPLOAD_MAX_DURATION_SEC")),
  dailyUserCapBytes: Math.floor(parsePositiveNumber(raw.UPLOAD_DAILY_USER_CAP_GB, "UPLOAD_DAILY_USER_CAP_GB") * 1024 * 1024 * 1024),
  rateLimitPerMinute: Math.floor(parsePositiveNumber(raw.UPLOAD_RATE_LIMIT_PER_MIN, "UPLOAD_RATE_LIMIT_PER_MIN")),
  rateLimitBurst: Math.floor(parsePositiveNumber(raw.UPLOAD_RATE_LIMIT_BURST, "UPLOAD_RATE_LIMIT_BURST")),
  imageWebpQuality,
  responsiveImageWidths: responsiveWidths,
} as const;

export type UploadConfig = typeof uploadConfig;

export { uploadConfig };
