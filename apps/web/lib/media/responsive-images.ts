const KNOWN_RESPONSIVE_WIDTHS = [320, 640, 1280, 1600] as const;

type ParsedResponsiveImageUrl = {
  baseUrl: string;
  directory: string;
  extension: string;
  maxWidth: number;
  search: string;
};

const parseResponsiveImageUrl = (url: string): ParsedResponsiveImageUrl | null => {
  try {
    const target = new URL(url);
    const match = target.pathname.match(/^(.*\/)(\d+)\.(webp)$/i);
    if (!match) {
      return null;
    }
    const maxWidth = Number.parseInt(match[2] ?? "", 10);
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
      return null;
    }
    return {
      baseUrl: `${target.origin}${match[1] ?? ""}`,
      directory: match[1] ?? "",
      extension: match[3] ?? "webp",
      maxWidth,
      search: target.search,
    };
  } catch {
    return null;
  }
};

const getResponsiveImageWidths = (url: string) => {
  const parsed = parseResponsiveImageUrl(url);
  if (!parsed) {
    return [];
  }
  return KNOWN_RESPONSIVE_WIDTHS.filter((width) => width <= parsed.maxWidth);
};

const getResponsiveImageUrlForWidth = (url: string, requestedWidth: number) => {
  const parsed = parseResponsiveImageUrl(url);
  if (!parsed) {
    return url;
  }
  const availableWidths = getResponsiveImageWidths(url);
  if (availableWidths.length === 0) {
    return url;
  }
  const safeWidth = Math.max(availableWidths[0] ?? requestedWidth, Math.round(requestedWidth));
  const resolvedWidth =
    availableWidths.find((width) => width >= safeWidth)
    ?? availableWidths[availableWidths.length - 1]
    ?? parsed.maxWidth;
  return `${parsed.baseUrl}${resolvedWidth}.${parsed.extension}${parsed.search}`;
};

const buildResponsiveImageSrcSet = (url: string) => {
  const parsed = parseResponsiveImageUrl(url);
  if (!parsed) {
    return undefined;
  }
  const availableWidths = getResponsiveImageWidths(url);
  if (availableWidths.length <= 1) {
    return undefined;
  }
  return availableWidths
    .map((width) => `${parsed.baseUrl}${width}.${parsed.extension}${parsed.search} ${width}w`)
    .join(", ");
};

const responsiveImageLoader = ({ src, width }: { src: string; width: number }) => {
  return getResponsiveImageUrlForWidth(src, width);
};

export {
  KNOWN_RESPONSIVE_WIDTHS,
  buildResponsiveImageSrcSet,
  getResponsiveImageUrlForWidth,
  getResponsiveImageWidths,
  parseResponsiveImageUrl,
  responsiveImageLoader,
};
