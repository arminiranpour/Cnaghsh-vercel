import { randomUUID } from "node:crypto";

import { MediaStatus, type MediaType, type MediaVisibility } from "@prisma/client";

import { cacheOriginal } from "@/lib/storage/headers";
import { getOriginalKey } from "@/lib/storage/keys";
import { putBuffer, remove } from "@/lib/storage/s3";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";
import { prisma } from "@/lib/prisma";
import { getExtensionForMime } from "./formats";

const createUploadedMediaAssetFromBuffer = async ({
  ownerUserId,
  buffer,
  declaredMime,
  mediaType,
  visibility,
  sizeBytes,
}: {
  ownerUserId: string;
  buffer: Buffer;
  declaredMime: string;
  mediaType: MediaType;
  visibility: MediaVisibility;
  sizeBytes: number;
}) => {
  const extension = getExtensionForMime(declaredMime);
  if (!extension) {
    throw new Error("Unsupported media MIME type");
  }

  const mediaId = randomUUID();
  const sourceKey = getOriginalKey(ownerUserId, mediaId, extension);
  const privateBucket = resolveBucketForVisibility("private");

  await putBuffer(
    privateBucket,
    sourceKey,
    buffer,
    declaredMime,
    cacheOriginal(),
  );

  try {
    return await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        type: mediaType,
        status: MediaStatus.uploaded,
        visibility,
        ownerUserId,
        sourceKey,
        sizeBytes: BigInt(sizeBytes),
      },
    });
  } catch (error) {
    await remove(privateBucket, sourceKey).catch(() => undefined);
    throw error;
  }
};

export { createUploadedMediaAssetFromBuffer };
