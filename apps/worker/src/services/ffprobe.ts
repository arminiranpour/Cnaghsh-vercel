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

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  width?: number;
  height?: number;
  duration?: string | number;
  bit_rate?: string | number;
  channels?: number;
  sample_rate?: string | number;
  tags?: Record<string, string | undefined>;
  side_data_list?: Array<{ rotation?: number }>;
};

type ProbeFormat = {
  duration?: string;
  bit_rate?: string;
  format_name?: string;
};

type ProbeResponse = {
  streams?: ProbeStream[];
  format?: ProbeFormat;
};

type ProbedMedia =
  | {
      type: "video";
      durationSec: number;
      width: number;
      height: number;
      videoCodec: string;
      audioCodec: string | null;
      bitrateKbps: number | null;
      channels: number | null;
      sampleRate: number | null;
      rotation: number | null;
      container: string | null;
    }
  | {
      type: "audio";
      durationSec: number;
      width: null;
      height: null;
      videoCodec: null;
      audioCodec: string;
      bitrateKbps: number | null;
      channels: number | null;
      sampleRate: number | null;
      rotation: null;
      container: string | null;
    };

const parseNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseRotation = (stream?: ProbeStream) => {
  const tagRotation = stream?.tags?.rotate;
  const parsedTagRotation = tagRotation ? Number.parseInt(tagRotation, 10) : NaN;
  if (Number.isFinite(parsedTagRotation)) {
    return parsedTagRotation;
  }
  const sideDataRotation = stream?.side_data_list?.find((entry) => typeof entry.rotation === "number")?.rotation;
  return typeof sideDataRotation === "number" && Number.isFinite(sideDataRotation)
    ? sideDataRotation
    : null;
};

const probeMedia = async (inputPath: string): Promise<ProbedMedia> => {
  const { stdout } = await execa(transcodeConfig.ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    inputPath,
  ]);

  const parsed = JSON.parse(stdout) as ProbeResponse;
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  const durationSec =
    parseNumber(parsed.format?.duration)
    ?? parseNumber(videoStream?.duration)
    ?? parseNumber(audioStream?.duration);

  if (!durationSec || durationSec <= 0) {
    throw new Error("Unable to determine media duration");
  }

  const bitrateBits =
    parseNumber(parsed.format?.bit_rate)
    ?? parseNumber(videoStream?.bit_rate)
    ?? parseNumber(audioStream?.bit_rate);
  const bitrateKbps = bitrateBits ? Math.max(Math.round(bitrateBits / 1000), 1) : null;
  const container = parsed.format?.format_name ?? null;

  if (videoStream) {
    const width = parseNumber(videoStream.width);
    const height = parseNumber(videoStream.height);
    if (!width || !height) {
      throw new Error("Unable to determine video dimensions");
    }
    return {
      type: "video",
      durationSec,
      width,
      height,
      videoCodec: videoStream.codec_name ?? videoStream.codec_long_name ?? "unknown",
      audioCodec: audioStream?.codec_name ?? audioStream?.codec_long_name ?? null,
      bitrateKbps,
      channels: audioStream?.channels ?? null,
      sampleRate: parseNumber(audioStream?.sample_rate)
        ? Math.max(Math.round(parseNumber(audioStream?.sample_rate) ?? 0), 1)
        : null,
      rotation: parseRotation(videoStream),
      container,
    };
  }

  if (!audioStream) {
    throw new Error("No audio or video stream found in media");
  }

  return {
    type: "audio",
    durationSec,
    width: null,
    height: null,
    videoCodec: null,
    audioCodec: audioStream.codec_name ?? audioStream.codec_long_name ?? "unknown",
    bitrateKbps,
    channels: audioStream.channels ?? null,
    sampleRate: parseNumber(audioStream.sample_rate)
      ? Math.max(Math.round(parseNumber(audioStream.sample_rate) ?? 0), 1)
      : null,
    rotation: null,
    container,
  };
};

export type { ProbedMedia };
export { probeMedia };
