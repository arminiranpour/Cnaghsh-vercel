import sharp from "sharp";

type SupportedImageMime =
  | "image/heic"
  | "image/heif"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

type ProcessedImageVariant = {
  width: number;
  height: number;
  buffer: Buffer;
};

type ProcessedImage = {
  inputMime: SupportedImageMime;
  width: number;
  height: number;
  variants: ProcessedImageVariant[];
};

const SHARP_INPUT_MIME_MAP: Record<string, SupportedImageMime> = {
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_INPUT_PIXELS = 10000 * 10000;

const toSharp = (input: Buffer) =>
  sharp(input, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  });

const detectImageMimeFromBuffer = async (input: Buffer): Promise<SupportedImageMime | null> => {
  const metadata = await toSharp(input).metadata();
  const format = metadata.format?.toLowerCase() ?? "";
  if (!format) {
    return null;
  }

  if (format === "heif") {
    return "image/heic";
  }

  return SHARP_INPUT_MIME_MAP[format] ?? null;
};

const getTargetWidths = (sourceWidth: number, requestedWidths: readonly number[]) => {
  const normalizedWidths = requestedWidths.filter((width) => width <= sourceWidth);
  if (normalizedWidths[normalizedWidths.length - 1] !== sourceWidth) {
    normalizedWidths.push(sourceWidth);
  }
  return normalizedWidths.length > 0 ? normalizedWidths : [sourceWidth];
};

const processImageBuffer = async (
  input: Buffer,
  webpQuality: number,
  requestedWidths: readonly number[],
): Promise<ProcessedImage> => {
  const inputMime = await detectImageMimeFromBuffer(input);
  if (!inputMime) {
    throw new Error("Unsupported or unreadable image format");
  }

  const { data: normalizedInput, info: normalizedInfo } = await toSharp(input)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const width = normalizedInfo.width ?? 0;
  const height = normalizedInfo.height ?? 0;

  if (!width || !height) {
    throw new Error("Unable to determine image dimensions");
  }

  const targetWidths = getTargetWidths(width, requestedWidths);
  const variants: ProcessedImageVariant[] = [];

  for (const targetWidth of targetWidths) {
    const { data, info } = await toSharp(normalizedInput)
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
      })
      .webp({
        quality: webpQuality,
        effort: 4,
      })
      .toBuffer({ resolveWithObject: true });

    variants.push({
      width: info.width,
      height: info.height,
      buffer: data,
    });
  }

  if (variants.length === 0) {
    throw new Error("No responsive image variants were generated");
  }

  return {
    inputMime,
    width,
    height,
    variants,
  };
};

export type { ProcessedImage, ProcessedImageVariant, SupportedImageMime };
export { detectImageMimeFromBuffer, processImageBuffer };
