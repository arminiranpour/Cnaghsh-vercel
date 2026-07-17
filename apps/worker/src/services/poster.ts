import * as execaModule from "execa";

import { transcodeConfig } from "../config.transcode";

type ExecaFn = typeof import("execa").execa;

const resolveExeca = (): ExecaFn => {
  const candidate = execaModule as unknown;

  if (typeof candidate === "function") {
    return candidate as ExecaFn;
  }

  if (
    candidate &&
    typeof (candidate as { execa?: unknown }).execa === "function"
  ) {
    return (candidate as { execa: ExecaFn }).execa;
  }

  if (
    candidate &&
    typeof (candidate as { default?: unknown }).default === "function"
  ) {
    return (candidate as { default: ExecaFn }).default;
  }

  throw new Error("Unable to resolve execa function export");
};

const execa = resolveExeca();

const clampPosterTime = (durationSec: number, posterTimeFraction: number) => {
  const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1;
  const raw = safeDuration * posterTimeFraction;
  const maxTimestamp = Math.max(safeDuration - 1, 1);
  const minTimestamp = Math.min(1, maxTimestamp);
  let timestamp = Math.min(Math.max(raw, minTimestamp), maxTimestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    timestamp = Math.min(Math.max(safeDuration / 2, minTimestamp), maxTimestamp);
  }
  if (timestamp >= safeDuration) {
    timestamp = Math.max(safeDuration - 0.1, minTimestamp);
  }
  return timestamp;
};

const generatePoster = async (
  inputPath: string,
  outputPath: string,
  durationSec: number,
  posterTimeFraction: number,
): Promise<void> => {
  const timestampSec = clampPosterTime(durationSec, posterTimeFraction);
  await execa(transcodeConfig.ffmpegPath, [
    "-y",
    "-ss",
    timestampSec.toFixed(2),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=w='min(1280,iw)':h=-2:force_divisible_by=2",
    "-c:v",
    "libwebp",
    "-compression_level",
    "4",
    "-quality",
    "82",
    outputPath,
  ]);
};

export { generatePoster };
