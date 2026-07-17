const PROBE_LENGTH = 512;

const sliceToAscii = (bytes: Uint8Array, start: number, length: number) => {
  const end = Math.min(bytes.length, start + length);
  return Array.from(bytes.slice(start, end))
    .map((code) => String.fromCharCode(code))
    .join("");
};

const includesAscii = (bytes: Uint8Array, pattern: string) => {
  const haystack = sliceToAscii(bytes, 0, bytes.length).toLowerCase();
  return haystack.includes(pattern.toLowerCase());
};

const sniffFromBytes = (bytes: Uint8Array): string | null => {
  if (
    bytes.length >= 12
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12
    && sliceToAscii(bytes, 0, 4) === "RIFF"
    && sliceToAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 12
    && sliceToAscii(bytes, 0, 4) === "RIFF"
    && sliceToAscii(bytes, 8, 4) === "WAVE"
  ) {
    return "audio/wav";
  }

  if (bytes.length >= 3 && sliceToAscii(bytes, 0, 3) === "ID3") {
    return "audio/mpeg";
  }

  if (
    bytes.length >= 2
    && bytes[0] === 0xff
    && (bytes[1] & 0xe0) === 0xe0
  ) {
    const layerBits = (bytes[1] >> 1) & 0x03;
    if (layerBits === 0) {
      return "audio/aac";
    }
    return "audio/mpeg";
  }

  if (bytes.length >= 12) {
    const box = sliceToAscii(bytes, 4, 4);
    if (box === "ftyp") {
      const brand = sliceToAscii(bytes, 8, 4).trim().toLowerCase();
      if (brand.startsWith("qt")) {
        return "video/quicktime";
      }
      if (["heic", "heix", "hevc", "hevx"].includes(brand)) {
        return "image/heic";
      }
      if (["mif1", "msf1", "heif"].includes(brand)) {
        return "image/heif";
      }
      if (["m4a", "m4b", "m4p"].includes(brand)) {
        return "audio/mp4";
      }
      return "video/mp4";
    }
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    if (includesAscii(bytes, "matroska")) {
      return "video/x-matroska";
    }
    return "video/webm";
  }
  return null;
};

export const sniffMimeFromBuffer = (buffer: Uint8Array) => {
  return sniffFromBytes(buffer);
};

export const sniffMimeFromFile = async (file: File) => {
  const blob = file.slice(0, PROBE_LENGTH);
  const arrayBuffer = await blob.arrayBuffer();
  return sniffFromBytes(new Uint8Array(arrayBuffer));
};
