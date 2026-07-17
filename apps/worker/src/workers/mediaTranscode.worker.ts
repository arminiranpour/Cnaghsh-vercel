import { extname } from "node:path";
import { stat } from "node:fs/promises";

import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { MediaStatus, MediaType, Prisma, PrismaClient, TranscodeJobStatus } from "@prisma/client";

import { config } from "../config";
import { transcodeConfig } from "../config.transcode";
import { logError, logInfo, logWarn } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { createWorkerConnection } from "../lib/queue-connection";
import { cleanupPath, createTempDir, createTempFile } from "../lib/tmp";
import { MEDIA_TRANSCODE_QUEUE_NAME } from "../queues/mediaTranscode.constants";
import type { MediaTranscodeJobData } from "../queues/mediaTranscode.types";
import { transcodeAudioToMp3 } from "../services/audio-transcode";
import { probeMedia } from "../services/ffprobe";
import { generatePoster } from "../services/poster";
import { transcodeVideoRenditions } from "../services/video-transcode";
import { storageConfig } from "../storage/config";
import { cacheHlsSegment, cachePoster } from "../storage/headers";
import { deleteObject, downloadToFile, uploadFile } from "../storage/io";
import { getAudioOutputKey, getPosterKey, getVideoOutputKey } from "../storage/keys";
import { resolveBucketForVisibility } from "../storage/visibility";
import { captureWorkerException } from "../sentry";

type MediaTranscodeJobResult = { mediaAssetId: string; attempt: number };

const calculateBackoff = (attemptsMade: number) => {
  if (attemptsMade <= 1) {
    return config.MEDIA_TRANSCODE_BACKOFF_MS;
  }
  return config.MEDIA_TRANSCODE_BACKOFF_MS * Math.pow(2, attemptsMade - 1);
};

const safeCleanup = async (path: string | null, label: string) => {
  if (!path) {
    return;
  }
  try {
    await cleanupPath(path);
  } catch (error) {
    logWarn("media.transcode.cleanup_failure", {
      path,
      label,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const safeDeleteObject = async (bucket: string | null, key: string) => {
  if (!bucket) {
    return;
  }
  try {
    await deleteObject(bucket, key);
  } catch (error) {
    logWarn("media.transcode.object_cleanup_failure", {
      bucket,
      key,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const finishFailedMedia = async (
  mediaAssetId: string,
  transcodeJobId: string | null,
  attempt: number,
  error: unknown,
) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message.length > 500 ? `${message.slice(0, 497)}...` : message;
  const failureLog: Prisma.JsonObject =
    error instanceof Error && error.stack
      ? { error: safeMessage, attempt, stack: error.stack }
      : { error: safeMessage, attempt };
  const finishedAt = new Date();
  try {
    if (transcodeJobId) {
      await prisma.transcodeJob.update({
        where: { id: transcodeJobId },
        data: {
          status: TranscodeJobStatus.failed,
          finishedAt,
          logs: failureLog,
        },
      });
    }
    await prisma.mediaAsset.update({
      where: { id: mediaAssetId },
      data: {
        status: MediaStatus.failed,
        errorMessage: safeMessage,
      },
    });
  } catch (updateError) {
    logError("media.transcode.failure_persist", {
      mediaAssetId,
      message: updateError instanceof Error ? updateError.message : String(updateError),
    });
  }
};

const processJob = async (job: Job<MediaTranscodeJobData>): Promise<MediaTranscodeJobResult> => {
  const mediaAssetId = job.data?.mediaAssetId;
  const attempt = job.data?.attempt ?? 1;
  if (!mediaAssetId) {
    throw new Error("Missing mediaAssetId");
  }

  logInfo("media.transcode.start", {
    queue: MEDIA_TRANSCODE_QUEUE_NAME,
    jobId: job.id,
    mediaAssetId,
    attempt,
    retryCount: job.attemptsMade,
  });

  let media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media) {
    throw new Error(`Media asset ${mediaAssetId} not found`);
  }
  if (media.type !== MediaType.video && media.type !== "audio") {
    throw new Error(`Unsupported media type ${media.type}`);
  }

  let transcodeJobRecord = await prisma.transcodeJob.findFirst({
    where: { mediaAssetId, attempt },
    orderBy: { createdAt: "desc" },
  });

  if (media.status === MediaStatus.ready && media.outputKey) {
    if (transcodeJobRecord && transcodeJobRecord.status !== TranscodeJobStatus.done) {
      const finishedAt = new Date();
      await prisma.transcodeJob.update({
        where: { id: transcodeJobRecord.id },
        data: {
          status: TranscodeJobStatus.done,
          startedAt: transcodeJobRecord.startedAt ?? finishedAt,
          finishedAt,
          logs: {
            skipped: true,
            reason: "already-ready",
          },
        },
      });
    }
    logInfo("media.transcode.skip", { mediaAssetId, jobId: job.id });
    return { mediaAssetId, attempt };
  }

  const startTime = new Date();
  const transactionResult = await prisma.$transaction(async (tx: PrismaClient) => {
    let activeJob = transcodeJobRecord;
    if (activeJob) {
      activeJob = await tx.transcodeJob.update({
        where: { id: activeJob.id },
        data: {
          attempt,
          status: TranscodeJobStatus.processing,
          startedAt: startTime,
          finishedAt: null,
        },
      });
    } else {
      activeJob = await tx.transcodeJob.create({
        data: {
          mediaAssetId,
          attempt,
          status: TranscodeJobStatus.processing,
          startedAt: startTime,
        },
      });
    }
    const updatedMedia = await tx.mediaAsset.update({
      where: { id: mediaAssetId },
      data: {
        status: MediaStatus.processing,
        errorMessage: null,
      },
    });
    return { activeJob, updatedMedia };
  });

  transcodeJobRecord = transactionResult.activeJob;
  media = transactionResult.updatedMedia;

  const sourceExt = extname(media.sourceKey);
  let sourcePath: string | null = null;
  let outputPath: string | null = null;
  let outputDir: string | null = null;
  let posterPath: string | null = null;
  let outputBucket: string | null = null;
  const uploadedObjectKeys: string[] = [];

  try {
    sourcePath = await createTempFile("media-source", sourceExt);
    const originalsBucket = storageConfig.privateBucket;
    await downloadToFile(originalsBucket, media.sourceKey, sourcePath);
    const sourceStats = await stat(sourcePath);
    const metadata = await probeMedia(sourcePath);
    outputBucket = resolveBucketForVisibility("public");

    if (media.type === "audio") {
      if (metadata.type !== "audio") {
        throw new Error("Uploaded media does not contain a valid audio stream");
      }

      outputPath = await createTempFile("media-audio", ".mp3");
      await transcodeAudioToMp3({
        inputPath: sourcePath,
        outputPath,
        channels: metadata.channels,
      });

      const outputKey = getAudioOutputKey(media.id);
      const outputStats = await stat(outputPath);
      await uploadFile(
        {
          bucket: outputBucket,
          key: outputKey,
          contentType: "audio/mpeg",
          cacheControl: cacheHlsSegment(),
        },
        outputPath,
      );
      uploadedObjectKeys.push(outputKey);

      const finishedAt = new Date();
      await prisma.$transaction(async (tx: PrismaClient) => {
        await tx.mediaAsset.update({
          where: { id: mediaAssetId },
          data: {
            status: MediaStatus.ready,
            outputKey,
            durationSec: Math.max(Math.round(metadata.durationSec), 1),
            width: null,
            height: null,
            codec: "mp3",
            bitrate: transcodeConfig.audioBitrateKbps,
            posterKey: null,
            errorMessage: null,
          },
        });
        await tx.transcodeJob.update({
          where: { id: transcodeJobRecord.id },
          data: {
            status: TranscodeJobStatus.done,
            finishedAt,
            logs: {
              ffprobe: metadata,
              outputKey,
              outputBytes: outputStats.size,
              sourceBytes: sourceStats.size,
              attempt,
            },
          },
        });
      });

      logInfo("media.transcode.success", { mediaAssetId, jobId: job.id, outputKey });
      return { mediaAssetId, attempt };
    }

    if (metadata.type !== "video") {
      throw new Error("Uploaded media does not contain a valid video stream");
    }

    outputDir = await createTempDir("media-video");
    const renditions = await transcodeVideoRenditions({
      inputPath: sourcePath,
      outputDir,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      hasAudio: Boolean(metadata.audioCodec),
      renditions: transcodeConfig.videoRenditions,
    });

    if (renditions.length === 0) {
      throw new Error("No video renditions were generated");
    }

    posterPath = await createTempFile("media-poster", ".webp");
    await generatePoster(sourcePath, posterPath, metadata.durationSec, transcodeConfig.posterTimeFraction);

    let totalOutputBytes = 0;
    const renditionSummaries: Array<{
      name: string;
      width: number;
      height: number;
      outputKey: string;
      bytes: number;
      videoBitrateKbps: number;
      audioBitrateKbps: number;
    }> = [];

    for (const rendition of renditions) {
      const outputKey = getVideoOutputKey(media.id, rendition.name);
      const outputStats = await stat(rendition.path);
      await uploadFile(
        {
          bucket: outputBucket,
          key: outputKey,
          contentType: "video/mp4",
          cacheControl: cacheHlsSegment(),
        },
        rendition.path,
      );
      uploadedObjectKeys.push(outputKey);
      totalOutputBytes += outputStats.size;
      renditionSummaries.push({
        name: rendition.name,
        width: rendition.width,
        height: rendition.height,
        outputKey,
        bytes: outputStats.size,
        videoBitrateKbps: rendition.videoBitrateKbps,
        audioBitrateKbps: rendition.audioBitrateKbps,
      });
    }

    const posterKey = getPosterKey(media.id);
    const posterStats = await stat(posterPath);
    await uploadFile(
      {
        bucket: outputBucket,
        key: posterKey,
        contentType: "image/webp",
        cacheControl: cachePoster(),
      },
      posterPath,
    );
    uploadedObjectKeys.push(posterKey);
    totalOutputBytes += posterStats.size;

    const primaryRendition =
      [...renditionSummaries].sort((left, right) => {
        if (left.height !== right.height) {
          return right.height - left.height;
        }
        return right.width - left.width;
      })[0];

    if (!primaryRendition) {
      throw new Error("Missing primary video rendition");
    }

    const finishedAt = new Date();
    await prisma.$transaction(async (tx: PrismaClient) => {
      await tx.mediaAsset.update({
        where: { id: mediaAssetId },
        data: {
          status: MediaStatus.ready,
          outputKey: primaryRendition.outputKey,
          posterKey,
          durationSec: Math.max(Math.round(metadata.durationSec), 1),
          width: primaryRendition.width,
          height: primaryRendition.height,
          codec: "h264",
          bitrate: primaryRendition.videoBitrateKbps + primaryRendition.audioBitrateKbps,
          errorMessage: null,
        },
      });
      await tx.transcodeJob.update({
        where: { id: transcodeJobRecord.id },
        data: {
          status: TranscodeJobStatus.done,
          finishedAt,
          logs: {
            ffprobe: metadata,
            renditions: renditionSummaries,
            posterKey,
            totalOutputBytes,
            sourceBytes: sourceStats.size,
            attempt,
          },
        },
      });
    });

    logInfo("media.transcode.success", {
      mediaAssetId,
      jobId: job.id,
      outputKey: primaryRendition.outputKey,
      posterKey,
    });

    return { mediaAssetId, attempt };
  } catch (error) {
    for (const key of uploadedObjectKeys) {
      await safeDeleteObject(outputBucket, key);
    }
    await finishFailedMedia(mediaAssetId, transcodeJobRecord?.id ?? null, attempt, error);
    logError("media.transcode.failure", {
      mediaAssetId,
      jobId: job.id,
      message: error instanceof Error ? error.message : String(error),
    });
    captureWorkerException(error);
    throw error;
  } finally {
    await safeCleanup(outputPath, "media-output");
    await safeCleanup(posterPath, "poster");
    await safeCleanup(outputDir, "media-output-dir");
    await safeCleanup(sourcePath, "source");
  }
};

export const mediaTranscodeWorker = new Worker<MediaTranscodeJobData, MediaTranscodeJobResult>(
  MEDIA_TRANSCODE_QUEUE_NAME,
  processJob,
  {
    connection: createWorkerConnection(),
    concurrency: config.MEDIA_TRANSCODE_CONCURRENCY,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  },
);

mediaTranscodeWorker.on("completed", (job: Job<MediaTranscodeJobData, MediaTranscodeJobResult>) => {
  logInfo("media.transcode.worker.completed", {
    queue: MEDIA_TRANSCODE_QUEUE_NAME,
    jobId: job.id,
    returnvalue: job.returnvalue,
  });
});

mediaTranscodeWorker.on("failed", (job: Job<MediaTranscodeJobData>, error: unknown) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  logError("media.transcode.worker.failed", {
    queue: MEDIA_TRANSCODE_QUEUE_NAME,
    jobId: job?.id,
    failedReason: normalizedError.message,
    stack: normalizedError.stack,
    attemptsMade: job?.attemptsMade,
  });
});

mediaTranscodeWorker.on("error", (error: unknown) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  logError("media.transcode.worker.error", {
    message: normalizedError.message,
    stack: normalizedError.stack,
  });
});
