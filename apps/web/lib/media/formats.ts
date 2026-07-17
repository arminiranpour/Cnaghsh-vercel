import { MediaType } from "@prisma/client";

const RESPONSIVE_IMAGE_WIDTHS = [320, 640, 1280, 1600] as const;

const IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
].join(",");

const VIDEO_ACCEPT = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
].join(",");

const AUDIO_ACCEPT = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  ".mp3",
  ".m4a",
  ".wav",
  ".aac",
].join(",");

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VIDEO_MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
};

const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  "audio/aac": "aac",
  "audio/m4a": "m4a",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "aac"]);

const IMAGE_MIME_TYPES = new Set(Object.keys(IMAGE_MIME_EXTENSIONS));
const VIDEO_MIME_TYPES = new Set(Object.keys(VIDEO_MIME_EXTENSIONS));
const AUDIO_MIME_TYPES = new Set(Object.keys(AUDIO_MIME_EXTENSIONS));

const normalizeMime = (value: string) => value.split(";")[0]?.trim().toLowerCase() ?? "";

const getExtensionFromFileName = (fileName: string) => {
  const trimmed = fileName.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return trimmed.slice(lastDot + 1);
};

const getMediaTypeFromMime = (value: string): MediaType | null => {
  const mime = normalizeMime(value);
  if (IMAGE_MIME_TYPES.has(mime)) {
    return MediaType.image;
  }
  if (VIDEO_MIME_TYPES.has(mime)) {
    return MediaType.video;
  }
  if (AUDIO_MIME_TYPES.has(mime)) {
    return MediaType.audio;
  }
  return null;
};

const getExtensionForMime = (value: string) => {
  const mime = normalizeMime(value);
  return IMAGE_MIME_EXTENSIONS[mime]
    ?? VIDEO_MIME_EXTENSIONS[mime]
    ?? AUDIO_MIME_EXTENSIONS[mime]
    ?? null;
};

const getAllowedExtensionsForType = (type: MediaType) => {
  switch (type) {
    case MediaType.image:
      return IMAGE_EXTENSIONS;
    case MediaType.video:
      return VIDEO_EXTENSIONS;
    case MediaType.audio:
      return AUDIO_EXTENSIONS;
    default:
      return new Set<string>();
  }
};

const isAllowedMimeForType = (value: string, type: MediaType) => {
  const mime = normalizeMime(value);
  switch (type) {
    case MediaType.image:
      return IMAGE_MIME_TYPES.has(mime);
    case MediaType.video:
      return VIDEO_MIME_TYPES.has(mime);
    case MediaType.audio:
      return AUDIO_MIME_TYPES.has(mime);
    default:
      return false;
  }
};

const isAllowedExtensionForType = (fileName: string, type: MediaType) => {
  const extension = getExtensionFromFileName(fileName);
  if (!extension) {
    return false;
  }
  return getAllowedExtensionsForType(type).has(extension);
};

export {
  AUDIO_ACCEPT,
  AUDIO_EXTENSIONS,
  AUDIO_MIME_EXTENSIONS,
  AUDIO_MIME_TYPES,
  IMAGE_ACCEPT,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_EXTENSIONS,
  IMAGE_MIME_TYPES,
  RESPONSIVE_IMAGE_WIDTHS,
  VIDEO_ACCEPT,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_EXTENSIONS,
  VIDEO_MIME_TYPES,
  getAllowedExtensionsForType,
  getExtensionForMime,
  getExtensionFromFileName,
  getMediaTypeFromMime,
  isAllowedExtensionForType,
  isAllowedMimeForType,
  normalizeMime,
};
