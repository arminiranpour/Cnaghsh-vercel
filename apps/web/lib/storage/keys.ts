const normalizeSegment = (value: string) => value.replace(/^\/+|\/+$/g, "");

const normalizeExt = (ext: string) => {
  const trimmed = ext.trim();
  if (trimmed.startsWith(".")) {
    return trimmed.slice(1);
  }
  return trimmed;
};

const joinKey = (...parts: string[]) =>
  parts
    .map((part) => normalizeSegment(part))
    .filter((part) => part.length > 0)
    .join("/");

const getOriginalKey = (ownerUserId: string, mediaId: string, ext: string) => {
  const safeExt = normalizeExt(ext);
  if (safeExt.length === 0) {
    throw new Error("File extension is required for original uploads");
  }
  return joinKey("uploads/originals", ownerUserId, `${mediaId}.${safeExt}`);
};

const getImageVariantKey = (mediaId: string, width: number) => {
  return joinKey("processed/images", mediaId, `${Math.max(1, Math.round(width))}.webp`);
};

const getProfileImageVariantKey = (ownerUserId: string, imageId: string, width: number) => {
  return joinKey(
    "uploads",
    "profile-images",
    ownerUserId,
    imageId,
    `${Math.max(1, Math.round(width))}.webp`,
  );
};

const getVideoOutputKey = (mediaId: string, variant: string) => {
  return joinKey("processed/video", mediaId, `${normalizeSegment(variant)}.mp4`);
};

const getAudioOutputKey = (mediaId: string) => {
  return joinKey("processed/audio", `${mediaId}.mp3`);
};

const getPosterKey = (mediaId: string) => {
  return joinKey("processed/posters", `${mediaId}.webp`);
};

export {
  getAudioOutputKey,
  getImageVariantKey,
  getOriginalKey,
  getPosterKey,
  getProfileImageVariantKey,
  getVideoOutputKey,
  joinKey,
};
