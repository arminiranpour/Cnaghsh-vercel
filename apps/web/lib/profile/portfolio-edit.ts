import type { Prisma } from "@prisma/client";

import { normalizeLanguageSkills, type LanguageSkill } from "@/lib/profile/languages";
import { getSkillIdentity, resolveSkillValue } from "@/lib/profile/skills";

export type AccentEntry = {
  title: string;
  mediaId?: string;
  url?: string;
  duration?: number | null;
};

export type VoiceEntry = {
  mediaId: string;
  url: string;
  title?: string | null;
  duration?: number | null;
};

export type PortfolioVideoEntry = {
  mediaId?: string | null;
  url?: string | null;
  title?: string | null;
  posterUrl?: string | null;
  playbackKind?: string | null;
  recordedMonth?: string | number | null;
  recordedYear?: string | number | null;
  order?: number | null;
};

export type ResumeEntry = {
  type: string;
  title: string;
  position: string;
  role: string;
  director: string;
};

export type CourseEntry = {
  title: string;
  instructor: string;
};

export type DegreeEntry = {
  degreeLevel: string;
  major: string;
};

export type ExperienceEntry = {
  role: string;
  work: string;
};

export type ExperienceData = {
  theatre?: ExperienceEntry[];
  shortFilm?: ExperienceEntry[];
  cinema?: ExperienceEntry[];
  tv?: ExperienceEntry[];
};

export type GalleryImageEntry = {
  url: string;
  slot?: "headshotFront" | "profileSide" | "profileThreeQuarter" | "fullBody" | "other";
};

export type PortfolioExperienceData = ExperienceData & {
  resume: ResumeEntry[];
  courses: CourseEntry[];
};

export type PortfolioEditInitialValues = {
  firstName: string;
  lastName: string;
  birthDate: string;
  cityId: string;
  bio: string;
  skills: string[];
  languages: LanguageSkill[];
  accents: AccentEntry[];
  voices?: VoiceEntry[];
  awards?: Array<{
    id?: string;
    title: string;
    workTitle?: string | null;
    place?: string | null;
    awardDate?: string | null;
  }>;
  videos?: PortfolioVideoEntry[];
  degrees: DegreeEntry[];
  resume: ResumeEntry[];
  courses: CourseEntry[];
  experienceBase: ExperienceData;
  avatarUrl: string;
  stageName: string;
  age: number | null;
  phone: string;
  address: string;
  introVideoMediaId: string;
  gallery: GalleryImageEntry[];
};

export function normalizeSkillKeys(raw: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "string") {
      continue;
    }

    const value = resolveSkillValue(entry);
    const identity = getSkillIdentity(value);
    if (!value || seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    result.push(value);
  }

  return result;
}

export function normalizeLanguageEntries(
  raw: Prisma.JsonValue | null | undefined,
): LanguageSkill[] {
  return normalizeLanguageSkills(raw);
}

export function normalizeAccentEntries(
  raw: Prisma.JsonValue | null | undefined,
): AccentEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: AccentEntry[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item === "string") {
      const cleaned = item.trim();
      if (!cleaned) {
        continue;
      }
      const key = cleaned.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ title: cleaned });
      continue;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const rawTitle =
      typeof (item as { title?: unknown }).title === "string"
        ? ((item as { title?: string }).title ?? "").trim()
        : typeof (item as { label?: unknown }).label === "string"
          ? ((item as { label?: string }).label ?? "").trim()
          : "";

    if (!rawTitle) {
      continue;
    }

    const dedupeKey = rawTitle.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    const mediaId =
      typeof (item as { mediaId?: unknown }).mediaId === "string"
        ? ((item as { mediaId?: string }).mediaId ?? "").trim()
        : "";
    const url =
      typeof (item as { url?: unknown }).url === "string"
        ? ((item as { url?: string }).url ?? "").trim()
        : "";
    const duration =
      typeof (item as { duration?: unknown }).duration === "number" &&
      Number.isFinite((item as { duration?: number }).duration)
        ? (item as { duration?: number }).duration
        : null;

    seen.add(dedupeKey);
    result.push({
      title: rawTitle,
      mediaId: mediaId || undefined,
      url: url || undefined,
      duration,
    });
  }

  return result;
}

export function normalizeDegreeEntries(
  raw: Prisma.JsonValue | null | undefined,
): DegreeEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: DegreeEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const degreeLevel =
      typeof (item as { degreeLevel?: unknown }).degreeLevel === "string"
        ? ((item as { degreeLevel?: string }).degreeLevel ?? "").trim()
        : "";
    const major =
      typeof (item as { major?: unknown }).major === "string"
        ? ((item as { major?: string }).major ?? "").trim()
        : "";

    if (degreeLevel || major) {
      result.push({ degreeLevel, major });
    }
  }

  return result;
}

function normalizeExperienceEntries(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: ExperienceEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const role =
      typeof (item as { role?: unknown }).role === "string"
        ? ((item as { role?: string }).role ?? "").trim()
        : "";
    const work =
      typeof (item as { work?: unknown }).work === "string"
        ? ((item as { work?: string }).work ?? "").trim()
        : "";

    if (role || work) {
      entries.push({ role, work });
    }
  }

  return entries;
}

function normalizeResumeEntries(value: unknown): ResumeEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: ResumeEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const type =
      typeof (item as { type?: unknown }).type === "string"
        ? ((item as { type?: string }).type ?? "").trim()
        : "";
    const title =
      typeof (item as { title?: unknown }).title === "string"
        ? ((item as { title?: string }).title ?? "").trim()
        : "";
    const position =
      typeof (item as { position?: unknown }).position === "string"
        ? ((item as { position?: string }).position ?? "").trim()
        : "";
    const role =
      typeof (item as { role?: unknown }).role === "string"
        ? ((item as { role?: string }).role ?? "").trim()
        : "";
    const director =
      typeof (item as { director?: unknown }).director === "string"
        ? ((item as { director?: string }).director ?? "").trim()
        : "";

    if (type || title || position || role || director) {
      entries.push({ type, title, position, role, director });
    }
  }

  return entries;
}

function normalizeCourseEntries(value: unknown): CourseEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: CourseEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const title =
      typeof (item as { title?: unknown }).title === "string"
        ? ((item as { title?: string }).title ?? "").trim()
        : "";
    const instructor =
      typeof (item as { instructor?: unknown }).instructor === "string"
        ? ((item as { instructor?: string }).instructor ?? "").trim()
        : "";

    if (title || instructor) {
      entries.push({ title, instructor });
    }
  }

  return entries;
}

export function normalizePortfolioExperience(
  raw: Prisma.JsonValue | null | undefined,
): PortfolioExperienceData {
  const empty: PortfolioExperienceData = {
    theatre: [],
    shortFilm: [],
    cinema: [],
    tv: [],
    resume: [],
    courses: [],
  };

  if (!raw) {
    return empty;
  }

  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return empty;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return empty;
  }

  const data = parsed as Record<string, unknown>;

  return {
    theatre: normalizeExperienceEntries(data.theatre),
    shortFilm: normalizeExperienceEntries(data.shortFilm),
    cinema: normalizeExperienceEntries(data.cinema),
    tv: normalizeExperienceEntries(data.tv),
    resume: normalizeResumeEntries(data.resume),
    courses: normalizeCourseEntries(data.courses),
  };
}
