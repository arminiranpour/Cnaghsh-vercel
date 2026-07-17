import * as execaModule from "execa";

import { transcodeConfig } from "../config.transcode";

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

const transcodeAudioToMp3 = async ({
  inputPath,
  outputPath,
  channels,
}: {
  inputPath: string;
  outputPath: string;
  channels: number | null;
}) => {
  const normalizedChannels = channels === 1 ? 1 : 2;
  await execa(transcodeConfig.ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-map_metadata",
    "-1",
    "-c:a",
    "libmp3lame",
    "-b:a",
    `${transcodeConfig.audioBitrateKbps}k`,
    "-ar",
    `${transcodeConfig.audioSampleRateHz}`,
    "-ac",
    `${normalizedChannels}`,
    outputPath,
  ]);
};

export { transcodeAudioToMp3 };
