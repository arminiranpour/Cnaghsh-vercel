import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import * as execaModule from "execa";

import { transcodeConfig, type VideoRenditionConfig } from "../config.transcode";

type ExecaFn = typeof import("execa").execa;

const resolveExeca = (): ExecaFn => {
  const candidate = execaModule as unknown;

  if (typeof candidate === "function") {
    return candidate as ExecaFn;
  }

  if (candidate && typeof (candidate as { execa?: unknown }).execa === "function") {
    return (candidate as { execa: ExecaFn }).execa;
  }

  if (candidate && typeof (candidate as { default?: unknown }).default === "function") {
    return (candidate as { default: ExecaFn }).default;
  }

  throw new Error("Unable to resolve execa function export");
};

const execa = resolveExeca();

type PreparedVideoRendition = VideoRenditionConfig & {
  outputWidth: number;
  outputHeight: number;
};

type VideoTranscodeOutput = {
  name: string;
  path: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
};

const toEven = (value: number) => {
  const floored = Math.max(Math.floor(value), 2);
  return floored % 2 === 0 ? floored : floored - 1;
};

const fitWithinBox = (
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: toEven(sourceWidth * scale),
    height: toEven(sourceHeight * scale),
  };
};

const prepareRenditions = (
  sourceWidth: number,
  sourceHeight: number,
  renditions: VideoRenditionConfig[],
) => {
  const prepared: PreparedVideoRendition[] = [];
  const seen = new Set<string>();

  for (const rendition of renditions) {
    const fitted = fitWithinBox(sourceWidth, sourceHeight, rendition.width, rendition.height);
    if (fitted.width <= 0 || fitted.height <= 0) {
      continue;
    }
    if (
      fitted.width === sourceWidth
      && fitted.height === sourceHeight
      && rendition.width > sourceWidth
      && rendition.height > sourceHeight
    ) {
      continue;
    }
    const key = `${fitted.width}x${fitted.height}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    prepared.push({
      ...rendition,
      outputWidth: fitted.width,
      outputHeight: fitted.height,
    });
  }

  if (prepared.length === 0) {
    const fitted = fitWithinBox(sourceWidth, sourceHeight, sourceWidth, sourceHeight);
    prepared.push({
      name: sourceHeight > transcodeConfig.videoMaxHeightPx ? `${transcodeConfig.videoMaxHeightPx}p` : "source",
      width: sourceWidth,
      height: sourceHeight,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
      outputWidth: fitted.width,
      outputHeight: fitted.height,
    });
  }

  return prepared;
};

const buildVideoArgs = (
  inputPath: string,
  outputPath: string,
  rendition: PreparedVideoRendition,
  hasAudio: boolean,
) => {
  const filter = `scale=w=min(${rendition.width}\\,iw):h=min(${rendition.height}\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`;
  const args = [
    "-y",
    "-i",
    inputPath,
    "-map_metadata",
    "-1",
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    `${transcodeConfig.videoCrf}`,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];

  if (hasAudio) {
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      `${rendition.audioBitrateKbps}k`,
      "-ac",
      "2",
      "-ar",
      `${transcodeConfig.audioSampleRateHz}`,
    );
  } else {
    args.push("-an");
  }

  args.push(outputPath);
  return args;
};

const transcodeVideoRenditions = async ({
  inputPath,
  outputDir,
  sourceWidth,
  sourceHeight,
  hasAudio,
  renditions,
}: {
  inputPath: string;
  outputDir: string;
  sourceWidth: number;
  sourceHeight: number;
  hasAudio: boolean;
  renditions: VideoRenditionConfig[];
}): Promise<VideoTranscodeOutput[]> => {
  await mkdir(outputDir, { recursive: true });
  const prepared = prepareRenditions(sourceWidth, sourceHeight, renditions);
  const outputs: VideoTranscodeOutput[] = [];

  for (const rendition of prepared) {
    const outputPath = join(outputDir, `${rendition.name}.mp4`);
    await execa(
      transcodeConfig.ffmpegPath,
      buildVideoArgs(inputPath, outputPath, rendition, hasAudio),
    );
    outputs.push({
      name: rendition.name,
      path: outputPath,
      width: rendition.outputWidth,
      height: rendition.outputHeight,
      videoBitrateKbps: rendition.videoBitrateKbps,
      audioBitrateKbps: hasAudio ? rendition.audioBitrateKbps : 0,
    });
  }

  return outputs;
};

export type { VideoTranscodeOutput };
export { transcodeVideoRenditions };
