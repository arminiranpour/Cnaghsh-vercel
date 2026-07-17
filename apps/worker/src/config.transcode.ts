import { z } from "zod";

const renditionSchema = z.object({
  name: z.string().min(1),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  videoBitrateKbps: z.coerce.number().int().positive(),
  audioBitrateKbps: z.coerce.number().int().positive(),
});

type VideoRenditionConfig = {
  name: string;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
};

const parseRenditions = z
  .string()
  .transform((value: string, ctx: { addIssue: (issue: { code: "custom"; message: string }) => void }) => {
    try {
      return JSON.parse(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "VIDEO_RENDITIONS must be valid JSON" });
      return z.NEVER;
    }
  })
  .pipe(z.array(renditionSchema).min(1));

const defaultVideoRenditions: VideoRenditionConfig[] = [
  { name: "360p", width: 640, height: 360, videoBitrateKbps: 900, audioBitrateKbps: 96 },
  { name: "720p", width: 1280, height: 720, videoBitrateKbps: 2500, audioBitrateKbps: 128 },
  { name: "1080p", width: 1920, height: 1080, videoBitrateKbps: 4500, audioBitrateKbps: 160 },
];

const schema = z.object({
  FFMPEG_PATH: z.string().min(1),
  FFPROBE_PATH: z.string().min(1),
  VIDEO_RENDITIONS: parseRenditions,
  VIDEO_MAX_HEIGHT_PX: z.coerce.number().int().positive(),
  VIDEO_CRF: z.coerce.number().int().min(0).max(51),
  VIDEO_POSTER_TIME_FRACTION: z.coerce.number().min(0).max(1),
  AUDIO_BITRATE_KBPS: z.coerce.number().int().positive(),
  AUDIO_SAMPLE_RATE_HZ: z.coerce.number().int().positive(),
});

const raw = schema.parse({
  FFMPEG_PATH: process.env.FFMPEG_PATH ?? "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH ?? "ffprobe",
  VIDEO_RENDITIONS:
    process.env.VIDEO_RENDITIONS
    ?? process.env.HLS_VARIANTS
    ?? JSON.stringify(defaultVideoRenditions),
  VIDEO_MAX_HEIGHT_PX: process.env.VIDEO_MAX_HEIGHT_PX ?? "1080",
  VIDEO_CRF: process.env.VIDEO_CRF ?? "23",
  VIDEO_POSTER_TIME_FRACTION:
    process.env.VIDEO_POSTER_TIME_FRACTION
    ?? process.env.HLS_POSTER_TIME_FRACTION
    ?? "0.5",
  AUDIO_BITRATE_KBPS: process.env.AUDIO_BITRATE_KBPS ?? "192",
  AUDIO_SAMPLE_RATE_HZ: process.env.AUDIO_SAMPLE_RATE_HZ ?? "44100",
});

const transcodeConfig = {
  ffmpegPath: raw.FFMPEG_PATH,
  ffprobePath: raw.FFPROBE_PATH,
  videoRenditions: raw.VIDEO_RENDITIONS,
  videoMaxHeightPx: raw.VIDEO_MAX_HEIGHT_PX,
  videoCrf: raw.VIDEO_CRF,
  posterTimeFraction: raw.VIDEO_POSTER_TIME_FRACTION,
  audioBitrateKbps: raw.AUDIO_BITRATE_KBPS,
  audioSampleRateHz: raw.AUDIO_SAMPLE_RATE_HZ,
};

export { transcodeConfig };
export type { VideoRenditionConfig };
