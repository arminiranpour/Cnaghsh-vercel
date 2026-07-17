import type { MediaAsset, Prisma } from "@prisma/client";

import type { PublicProfileData, ProfileVideoData } from "@/components/profile/ProfilePageClient";
import type { City } from "@/lib/location/cities";
import { getPlaybackInfoForMedia } from "@/lib/media/urls";
import { prisma } from "@/lib/prisma";
import { normalizeAccentEntries } from "@/lib/profile/accents";
import { normalizeLanguageSkills } from "@/lib/profile/languages";
import { SKILLS, type SkillKey } from "@/lib/profile/skills";

type ProfileWithRelations = Prisma.ProfileGetPayload<{
  include: { awards: true };
}>;

const SKILL_LABELS = new Map(SKILLS.map((skill) => [skill.key, skill.label] as const));

const calculateAge = (birthDate?: Date | null): number | null => {
  if (!birthDate || Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const now = new Date();
  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

export function getDisplayName(
  stageName?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string {
  if (stageName && stageName.trim()) {
    return stageName.trim();
  }

  const combined = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return combined || "پروفایل بدون نام";
}

export function normalizeSkills(raw: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const skills: string[] = [];

  for (const entry of raw) {
    if (typeof entry === "string") {
      const label = SKILL_LABELS.get(entry as SkillKey) ?? entry;
      skills.push(label);
    }
  }

  return skills;
}

export function normalizeGallery(
  raw: Prisma.JsonValue | null | undefined,
): { url: string }[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const images: { url: string }[] = [];

  for (const entry of raw) {
    if (entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string") {
      images.push({ url: entry.url });
    }
  }

  return images;
}

export function normalizeLanguages(raw: Prisma.JsonValue | null | undefined) {
  return normalizeLanguageSkills(raw);
}

export function normalizeAccents(raw: Prisma.JsonValue | null | undefined) {
  return normalizeAccentEntries(raw);
}

export function normalizeDegrees(
  raw: Prisma.JsonValue | null | undefined,
): { degreeLevel: string; major: string }[] {
  if (!Array.isArray(raw)) return [];
  const result: { degreeLevel: string; major: string }[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

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

function collectVideoMediaIds(raw: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const mediaId =
      typeof (item as { mediaId?: unknown }).mediaId === "string"
        ? ((item as { mediaId?: string }).mediaId ?? "").trim()
        : "";

    if (!mediaId || seen.has(mediaId)) {
      continue;
    }

    seen.add(mediaId);
    ids.push(mediaId);
  }

  return ids;
}

function normalizeVideos(
  videosRaw: Prisma.JsonValue | null | undefined,
  mediaById: Map<string, MediaAsset>,
): ProfileVideoData[] {
  if (!Array.isArray(videosRaw)) {
    return [];
  }

  const parsed: Array<{
    mediaId: string;
    title?: string;
    order?: number;
    index: number;
  }> = [];

  for (const item of videosRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const mediaId =
      typeof (item as { mediaId?: unknown }).mediaId === "string"
        ? ((item as { mediaId?: string }).mediaId ?? "").trim()
        : "";

    if (!mediaId) {
      continue;
    }

    const rawTitle = (item as { title?: unknown }).title;
    const rawOrder = (item as { order?: unknown }).order;

    const title = typeof rawTitle === "string" ? rawTitle.trim() : undefined;
    const order =
      typeof rawOrder === "number" && Number.isInteger(rawOrder) ? rawOrder : undefined;

    parsed.push({
      mediaId,
      title: title || undefined,
      order: order ?? undefined,
      index: parsed.length,
    });
  }

  const result: ProfileVideoData[] = [];

  parsed
    .sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.index - b.index;
    })
    .forEach((entry) => {
      const media = mediaById.get(entry.mediaId);

      if (!media) {
        return;
      }

      try {
        const playback = getPlaybackInfoForMedia(media);
        result.push({
          mediaId: entry.mediaId,
          url: playback.manifestUrl,
          posterUrl: playback.posterUrl,
          title: entry.title,
          playbackKind: playback.kind,
        });
      } catch (error) {
        console.warn("[profile] failed to build playback for video", {
          mediaId: entry.mediaId,
          error,
        });
      }
    });

  return result;
}

export function normalizeVoices(
  raw: Prisma.JsonValue | null | undefined,
): { mediaId: string; url: string; title?: string | null; duration?: number | null; fileName?: string | null }[] {
  if (!Array.isArray(raw)) return [];

  const result: { mediaId: string; url: string; title?: string | null; duration?: number | null; fileName?: string | null }[] =
    [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const mediaId =
      typeof (item as { mediaId?: unknown }).mediaId === "string"
        ? ((item as { mediaId?: string }).mediaId ?? "").trim()
        : "";
    const url =
      typeof (item as { url?: unknown }).url === "string"
        ? ((item as { url?: string }).url ?? "").trim()
        : "";
    const title = (item as { title?: unknown }).title
      ? String((item as { title?: unknown }).title).trim()
      : null;
    const duration =
      typeof (item as { duration?: unknown }).duration === "number" &&
      Number.isFinite((item as { duration?: number }).duration)
        ? (item as { duration?: number }).duration
        : null;
    const fileName =
      typeof (item as { fileName?: unknown }).fileName === "string"
        ? ((item as { fileName?: string }).fileName ?? "").trim()
        : null;

    if (mediaId && url) {
      result.push({ mediaId, url, title, duration, fileName });
    }
  }

  return result;
}

export function normalizeAwards(
  raw: ProfileWithRelations["awards"] | null | undefined,
): PublicProfileData["awards"] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((award) => ({
      id: award.id,
      title: (award.title ?? "").trim(),
      workTitle: award.workTitle?.trim() || null,
      place: award.place?.trim() || null,
      awardDate: award.awardDate?.trim() || null,
    }))
    .filter((award) => award.title);
}

export async function buildProfilePageData(
  profile: ProfileWithRelations,
  cities: City[],
  options?: { includePrivateMedia?: boolean },
): Promise<PublicProfileData> {
  const includePrivateMedia = options?.includePrivateMedia ?? false;
  const videoMediaIds = collectVideoMediaIds(profile.videos);

  const videoMedia = videoMediaIds.length
    ? await prisma.mediaAsset.findMany({
        where: {
          id: { in: videoMediaIds },
          status: "ready",
          type: "video",
          outputKey: { not: null },
          ...(includePrivateMedia ? {} : { visibility: "public" }),
        },
      })
    : [];

  const mediaById = new Map(videoMedia.map((media) => [media.id, media] as const));
  const cityMap = new Map(cities.map((city) => [city.id, city.name] as const));

  const videos = normalizeVideos(profile.videos, mediaById);
  const voices = normalizeVoices(profile.voices);
  const awards = normalizeAwards(profile.awards);
  const derivedAge = calculateAge(profile.birthDate) ?? profile.age ?? null;

  return {
    id: profile.id,
    userId: profile.userId,
    displayName: getDisplayName(profile.stageName, profile.firstName, profile.lastName),
    avatarUrl: profile.avatarUrl,
    age: derivedAge,
    bio: profile.bio,
    cityName: profile.cityId ? cityMap.get(profile.cityId) ?? undefined : undefined,
    likesCount: profile.likesCount ?? 0,
    rating: profile.rating ?? 0,
    skillLevel: profile.skillLevel ?? 0,
    isSavedByMe: false,
    skills: normalizeSkills(profile.skills),
    languages: normalizeLanguages(profile.languages),
    accents: normalizeAccents(profile.accents),
    degrees: normalizeDegrees(profile.degrees),
    gallery: normalizeGallery(profile.gallery),
    experience: profile.experience ?? null,
    voices,
    videos,
    awards,
  };
}
