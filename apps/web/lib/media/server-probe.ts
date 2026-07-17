import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);

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

type ProbedAvFile = {
  type: "video" | "audio";
  durationSec: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitrateKbps: number | null;
  channels: number | null;
  sampleRate: number | null;
  rotation: number | null;
  container: string | null;
};

const FFPROBE_PATH = process.env.FFPROBE_PATH ?? "ffprobe";

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

const probeAvFile = async (inputPath: string): Promise<ProbedAvFile> => {
  const { stdout } = await execFile(FFPROBE_PATH, [
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

  if (!videoStream && !audioStream) {
    throw new Error("No audio or video stream found in media");
  }

  const width = videoStream ? Math.max(Math.round(parseNumber(videoStream.width) ?? 0), 0) : null;
  const height = videoStream ? Math.max(Math.round(parseNumber(videoStream.height) ?? 0), 0) : null;
  const bitrateBits =
    parseNumber(parsed.format?.bit_rate)
    ?? parseNumber(videoStream?.bit_rate)
    ?? parseNumber(audioStream?.bit_rate);

  return {
    type: videoStream ? "video" : "audio",
    durationSec,
    width: width && height ? width : null,
    height: width && height ? height : null,
    videoCodec: videoStream?.codec_name ?? videoStream?.codec_long_name ?? null,
    audioCodec: audioStream?.codec_name ?? audioStream?.codec_long_name ?? null,
    bitrateKbps: bitrateBits ? Math.max(Math.round(bitrateBits / 1000), 1) : null,
    channels: audioStream?.channels ?? null,
    sampleRate: parseNumber(audioStream?.sample_rate)
      ? Math.max(Math.round(parseNumber(audioStream?.sample_rate) ?? 0), 1)
      : null,
    rotation: parseRotation(videoStream),
    container: parsed.format?.format_name ?? null,
  };
};

export type { ProbedAvFile };
export { probeAvFile };
