import { MediaType, type MediaAsset } from "@prisma/client";

import { uploadConfig } from "@/lib/media/config";
import { getAudioOutputKey, getImageVariantKey, getPosterKey, getVideoOutputKey } from "@/lib/storage/keys";

const VIDEO_RENDITION_NAMES = ["360p", "720p", "1080p", "source"] as const;

const parseImageWidthFromOutputKey = (key: string) => {
  const match = key.match(/^processed\/images\/[^/]+\/(\d+)\.webp$/i);
  if (!match) {
    return null;
  }
  const width = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(width) && width > 0 ? width : null;
};

const listDerivedOutputKeys = (
  media: Pick<MediaAsset, "id" | "type" | "outputKey" | "posterKey">,
) => {
  const keys = new Set<string>();

  if (media.outputKey) {
    keys.add(media.outputKey);
  }
  if (media.posterKey) {
    keys.add(media.posterKey);
  }

  if (media.type === MediaType.image && media.outputKey) {
    const maxWidth = parseImageWidthFromOutputKey(media.outputKey);
    if (maxWidth) {
      const widths = Array.from(new Set([...uploadConfig.responsiveImageWidths, maxWidth]));
      for (const width of widths) {
        if (width <= maxWidth) {
          keys.add(getImageVariantKey(media.id, width));
        }
      }
    }
  }

  if (media.type === MediaType.video) {
    for (const rendition of VIDEO_RENDITION_NAMES) {
      keys.add(getVideoOutputKey(media.id, rendition));
    }
    keys.add(getPosterKey(media.id));
  }

  if (media.type === MediaType.audio) {
    keys.add(getAudioOutputKey(media.id));
  }

  return Array.from(keys);
};

export { listDerivedOutputKeys };
