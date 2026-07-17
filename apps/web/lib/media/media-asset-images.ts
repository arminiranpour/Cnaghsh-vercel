import { randomUUID } from "node:crypto";
import { buffer as streamToBuffer } from "node:stream/consumers";

import { MediaStatus, MediaType, type MediaAsset, type MediaVisibility } from "@prisma/client";

import { uploadConfig } from "@/lib/media/config";
import { getExtensionForMime } from "@/lib/media/formats";
import { detectImageMimeFromBuffer, processImageBuffer } from "@/lib/media/image-processing";
import { prisma } from "@/lib/prisma";
import { getImageVariantKey, getOriginalKey } from "@/lib/storage/keys";
import { getStream, putBuffer, remove } from "@/lib/storage/s3";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";

class ImageAssetProcessingError extends Error {
  code: "INVALID_IMAGE" | "MIME_MISMATCH" | "MISSING_SOURCE" | "UNSUPPORTED_IMAGE";

  constructor(
    code: "INVALID_IMAGE" | "MIME_MISMATCH" | "MISSING_SOURCE" | "UNSUPPORTED_IMAGE",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "ImageAssetProcessingError";
  }
}

const normalizeDeclaredMime = (value: string) => value.split(";")[0]?.trim().toLowerCase() ?? "";

const isEquivalentImageMime = (declared: string, detected: string) => {
  const left = normalizeDeclaredMime(declared);
  const right = normalizeDeclaredMime(detected);

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

const uploadProcessedImageVariants = async (mediaId: string, input: Buffer) => {
  const processed = await processImageBuffer(
    input,
    uploadConfig.imageWebpQuality,
    uploadConfig.responsiveImageWidths,
  );

  const outputBucket = resolveBucketForVisibility("public");
  const uploadedKeys: string[] = [];

  try {
    for (const variant of processed.variants) {
      const key = getImageVariantKey(mediaId, variant.width);
      await putBuffer(
        outputBucket,
        key,
        variant.buffer,
        "image/webp",
      );
      uploadedKeys.push(key);
    }
  } catch (error) {
    await cleanupUploadedObjects(outputBucket, uploadedKeys);
    throw error;
  }

  const largestVariant = processed.variants[processed.variants.length - 1];
  if (!largestVariant) {
    throw new ImageAssetProcessingError("INVALID_IMAGE", "No image variants were generated");
  }

  return {
    detectedMime: processed.inputMime,
    width: processed.width,
    height: processed.height,
    outputKey: getImageVariantKey(mediaId, largestVariant.width),
    uploadedKeys,
  };
};

const cleanupUploadedObjects = async (bucket: string, keys: Iterable<string>) => {
  await Promise.all(Array.from(new Set(keys)).map((key) => remove(bucket, key).catch(() => undefined)));
};

const createReadyImageMediaAsset = async ({
  ownerUserId,
  buffer,
  declaredMime,
  visibility,
  sizeBytes,
}: {
  ownerUserId: string;
  buffer: Buffer;
  declaredMime: string;
  visibility: MediaVisibility;
  sizeBytes: number;
}) => {
  const detectedMime = await detectImageMimeFromBuffer(buffer).catch(() => null);
  if (!detectedMime) {
    throw new ImageAssetProcessingError("INVALID_IMAGE", "Unsupported or unreadable image");
  }
  if (declaredMime && !isEquivalentImageMime(declaredMime, detectedMime)) {
    throw new ImageAssetProcessingError("MIME_MISMATCH", "Declared image MIME does not match file contents");
  }
  const extension = getExtensionForMime(detectedMime);
  if (!extension) {
    throw new ImageAssetProcessingError("UNSUPPORTED_IMAGE", "Unsupported image MIME type");
  }

  const mediaId = randomUUID();
  const sourceKey = getOriginalKey(ownerUserId, mediaId, extension);
  const privateBucket = resolveBucketForVisibility("private");
  const publicBucket = resolveBucketForVisibility("public");
  let uploadedSource = false;
  let uploadedKeys: string[] = [];

  try {
    await putBuffer(privateBucket, sourceKey, buffer, detectedMime);
    uploadedSource = true;

    const processed = await uploadProcessedImageVariants(mediaId, buffer);
    uploadedKeys = processed.uploadedKeys;

    return await prisma.mediaAsset.create({
      data: {
        id: mediaId,
        type: MediaType.image,
        status: MediaStatus.ready,
        visibility,
        ownerUserId,
        sourceKey,
        outputKey: processed.outputKey,
        width: processed.width,
        height: processed.height,
        codec: "webp",
        sizeBytes: BigInt(sizeBytes),
        errorMessage: null,
      },
    });
  } catch (error) {
    await cleanupUploadedObjects(publicBucket, uploadedKeys);
    if (uploadedSource) {
      await remove(privateBucket, sourceKey).catch(() => undefined);
    }
    throw error;
  }
};

const finalizeStoredImageMediaAsset = async (media: Pick<MediaAsset, "id" | "sourceKey" | "sizeBytes">) => {
  const privateBucket = resolveBucketForVisibility("private");
  const objectStream = await getStream(privateBucket, media.sourceKey).catch(() => null);
  if (!objectStream) {
    throw new ImageAssetProcessingError("MISSING_SOURCE", "Stored image source could not be found");
  }
  const sourceBuffer = Buffer.from(await streamToBuffer(objectStream));
  if (sourceBuffer.length === 0) {
    throw new ImageAssetProcessingError("INVALID_IMAGE", "Stored image source is empty");
  }

  const publicBucket = resolveBucketForVisibility("public");
  let uploadedKeys: string[] = [];

  try {
    const processed = await uploadProcessedImageVariants(media.id, sourceBuffer);
    uploadedKeys = processed.uploadedKeys;

    return await prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: MediaStatus.ready,
        outputKey: processed.outputKey,
        width: processed.width,
        height: processed.height,
        codec: "webp",
        errorMessage: null,
        sizeBytes: media.sizeBytes ?? BigInt(sourceBuffer.length),
      },
    });
  } catch (error) {
    await cleanupUploadedObjects(publicBucket, uploadedKeys);
    throw error;
  }
};

export { ImageAssetProcessingError, createReadyImageMediaAsset, finalizeStoredImageMediaAsset };
