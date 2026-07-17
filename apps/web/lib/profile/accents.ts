import { LANGUAGE_LEVEL_MAX } from "./languages";

export type AccentEntry = {
  title: string;
  level?: number | null;
  mediaId?: string;
  url?: string;
  duration?: number | null;
  fileName?: string | null;
};

export const ACCENT_OPTIONS = [
  { value: "تهرانی", label: "لهجه تهرانی" },
  { value: "مشهدی", label: "لهجه مشهدی" },
  { value: "اصفهانی", label: "لهجه اصفهانی" },
  { value: "شیرازی", label: "لهجه شیرازی" },
  { value: "تبریزی", label: "لهجه تبریزی/آذری" },
  { value: "کردی", label: "لهجه کردی" },
  { value: "لری", label: "لهجه لری" },
  { value: "گیلکی", label: "لهجه گیلکی" },
  { value: "مازنی", label: "لهجه مازنی" },
  { value: "بلوچی", label: "لهجه بلوچی" },
  { value: "عربی", label: "لهجه عربی" },
  { value: "افغان", label: "لهجه افغانستانی" },
] as const;

function cleanAccentText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAccentText(value: string): string {
  return cleanAccentText(value).toLocaleLowerCase();
}

function normalizeAccentLevel(value: unknown): number | null {
  const numericLevel =
    typeof value === "number" && Number.isInteger(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

  if (
    !Number.isInteger(numericLevel) ||
    numericLevel < 1 ||
    numericLevel > LANGUAGE_LEVEL_MAX
  ) {
    return null;
  }

  return numericLevel;
}

export function normalizeAccentEntries(value: unknown): AccentEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: AccentEntry[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry === "string") {
      const title = cleanAccentText(entry);
      if (!title) {
        continue;
      }

      const key = normalizeAccentText(title);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({ title, level: null });
      continue;
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const rawTitle =
      typeof (entry as { title?: unknown }).title === "string"
        ? ((entry as { title?: string }).title ?? "").trim()
        : typeof (entry as { label?: unknown }).label === "string"
          ? ((entry as { label?: string }).label ?? "").trim()
          : "";

    const title = cleanAccentText(rawTitle);

    if (!title) {
      continue;
    }

    const key = normalizeAccentText(title);
    if (seen.has(key)) {
      continue;
    }

    const mediaId =
      typeof (entry as { mediaId?: unknown }).mediaId === "string"
        ? ((entry as { mediaId?: string }).mediaId ?? "").trim()
        : "";
    const url =
      typeof (entry as { url?: unknown }).url === "string"
        ? ((entry as { url?: string }).url ?? "").trim()
        : "";
    const duration =
      typeof (entry as { duration?: unknown }).duration === "number" &&
      Number.isFinite((entry as { duration?: number }).duration)
        ? (entry as { duration?: number }).duration
        : null;
    const fileName =
      typeof (entry as { fileName?: unknown }).fileName === "string"
        ? ((entry as { fileName?: string }).fileName ?? "").trim()
        : "";
    const level = normalizeAccentLevel((entry as { level?: unknown }).level);

    seen.add(key);
    result.push({
      title,
      level,
      ...(mediaId && url
        ? {
            mediaId,
            url,
            duration,
            fileName: fileName || null,
          }
        : {}),
    });
  }

  return result;
}
