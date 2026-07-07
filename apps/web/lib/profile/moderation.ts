import { revalidatePath } from "next/cache";
import { Prisma, type ModerationStatus, type ProfileVisibility } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  emitHidden,
  emitModerationApproved,
  emitModerationPending,
  emitModerationRejected,
  emitUnhidden,
} from "@/lib/notifications/events";
import { getPublishability } from "@/lib/profile/enforcement";

const PROFILE_PATHS_TO_REVALIDATE = [
  "/profiles",
  "/dashboard/profile",
];

export const MODERATION_PROFILE_SELECT = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  stageName: true,
  age: true,
  birthDate: true,
  bio: true,
  avatarUrl: true,
  cityId: true,
  phone: true,
  address: true,
  gallery: true,
  skills: true,
  languages: true,
  accents: true,
  experience: true,
  degrees: true,
  voices: true,
  awards: {
    orderBy: [
      { awardDate: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      workTitle: true,
      place: true,
      awardDate: true,
    },
  },
  videos: true,
  introVideoMediaId: true,
  hasProfileEdits: true,
  visibility: true,
  moderationStatus: true,
  moderationNotes: true,
  moderatedBy: true,
  moderatedAt: true,
  updatedAt: true,
} satisfies Prisma.ProfileSelect;

export type ModerationProfileSnapshot = Prisma.ProfileGetPayload<{
  select: typeof MODERATION_PROFILE_SELECT;
}>;

const CRITICAL_JSON_KEYS = new Set<keyof ModerationProfileSnapshot>([
  "gallery",
  "skills",
  "languages",
  "accents",
  "experience",
  "degrees",
  "voices",
  "awards",
  "videos",
]);

const CRITICAL_FIELD_KEYS: Array<keyof ModerationProfileSnapshot> = [
  "firstName",
  "lastName",
  "stageName",
  "bio",
  "avatarUrl",
  "cityId",
  "phone",
  "address",
  "gallery",
  "skills",
  "languages",
  "accents",
  "experience",
  "degrees",
  "voices",
  "awards",
  "videos",
  "introVideoMediaId",
];

function normalizeJson(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasCriticalDifferences(
  previous: ModerationProfileSnapshot | null,
  next: ModerationProfileSnapshot | null,
): boolean {
  if (!previous || !next) {
    return false;
  }

  if (previous.moderationStatus !== "APPROVED") {
    return false;
  }

  for (const key of CRITICAL_FIELD_KEYS) {
    const oldValue = previous[key];
    const newValue = next[key];

    if (CRITICAL_JSON_KEYS.has(key)) {
      if (normalizeJson(oldValue) !== normalizeJson(newValue)) {
        return true;
      }
    } else {
      if ((oldValue ?? null) !== (newValue ?? null)) {
        return true;
      }
    }
  }

  return false;
}

async function revalidateProfilePaths(profileId: string) {
  const paths = [
    `/profiles/${profileId}`,
    ...PROFILE_PATHS_TO_REVALIDATE,
  ];

  for (const path of paths) {
    try {
      await revalidatePath(path);
    } catch (error) {
      console.warn("[moderation] revalidate_failed", {
        path,
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export async function maybeMarkPendingOnCriticalEdit({
  old,
  next,
  actorId,
}: {
  old: ModerationProfileSnapshot | null;
  next: ModerationProfileSnapshot | null;
  actorId?: string | null;
}): Promise<boolean> {
  if (!old || !next) {
    return false;
  }

  if (!hasCriticalDifferences(old, next)) {
    return false;
  }

  const [, event] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: next.id },
      data: {
        moderationStatus: "PENDING",
        moderationNotes: null,
        moderatedBy: null,
        moderatedAt: null,
      },
    }),
    prisma.moderationEvent.create({
      data: {
        profileId: next.id,
        actorId: actorId ?? null,
        action: "REVERT_TO_PENDING",
        reason: null,
      },
    }),
  ]);

  await revalidateProfilePaths(next.id);

  return Boolean(event);
}

export async function approveProfile(
  profileId: string,
  actorId: string,
  note?: string,
): Promise<ModerationProfileSnapshot> {
  const cleanedNote = note?.trim() ? note.trim() : null;
  const now = new Date();

  const [profile] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: {
        moderationStatus: "APPROVED",
        moderationNotes: cleanedNote,
        moderatedBy: actorId,
        moderatedAt: now,
      },
      select: MODERATION_PROFILE_SELECT,
    }),
    prisma.moderationEvent.create({
      data: {
        profileId,
        actorId,
        action: "APPROVE",
        reason: cleanedNote,
      },
    }),
  ]);

  await revalidateProfilePaths(profileId);

  await emitModerationApproved(profile.userId, profile.id);

  return profile;
}

export async function rejectProfile(
  profileId: string,
  actorId: string,
  reason: string,
): Promise<ModerationProfileSnapshot> {
  const cleanedReason = reason.trim();
  const now = new Date();

  const [profile] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: {
        moderationStatus: "REJECTED",
        moderationNotes: cleanedReason,
        moderatedBy: actorId,
        moderatedAt: now,
        visibility: "PRIVATE",
      },
      select: MODERATION_PROFILE_SELECT,
    }),
    prisma.moderationEvent.create({
      data: {
        profileId,
        actorId,
        action: "REJECT",
        reason: cleanedReason,
      },
    }),
  ]);

  await revalidateProfilePaths(profileId);

  await emitModerationRejected(profile.userId, profile.id, cleanedReason);

  return profile;
}

export async function revertToPending(
  profileId: string,
  actorId: string,
  note?: string,
): Promise<ModerationProfileSnapshot> {
  const cleanedNote = note?.trim() ? note.trim() : null;
  const now = new Date();

  const [profile] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: {
        moderationStatus: "PENDING",
        moderationNotes: cleanedNote,
        moderatedBy: actorId,
        moderatedAt: now,
      },
      select: MODERATION_PROFILE_SELECT,
    }),
    prisma.moderationEvent.create({
      data: {
        profileId,
        actorId,
        action: "REVERT_TO_PENDING",
        reason: cleanedNote,
      },
    }),
  ]);

  await revalidateProfilePaths(profileId);

  await emitModerationPending(profile.userId, profile.id);

  return profile;
}

export async function hideProfile(
  profileId: string,
  actorId: string,
): Promise<ModerationProfileSnapshot> {
  const [profile] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: {
        visibility: "PRIVATE",
      },
      select: MODERATION_PROFILE_SELECT,
    }),
    prisma.moderationEvent.create({
      data: {
        profileId,
        actorId,
        action: "HIDE",
        reason: null,
      },
    }),
  ]);

  await revalidateProfilePaths(profileId);

  await emitHidden(profile.userId, profile.id);

  return profile;
}

export async function unhideProfile(
  profileId: string,
  actorId: string,
): Promise<ModerationProfileSnapshot> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      publishedAt: true,
    },
  });

  if (!profile) {
    throw new Error("پروفایل یافت نشد.");
  }

  if (!profile.publishedAt) {
    throw new Error(
      "این هنرمند پروفایل خود را از نمایش خارج کرده است. برای انتشار مجدد، لازم است خود کاربر آن را فعال کند.",
    );
  }

  const publishability = await getPublishability(profile.userId);

  if (!publishability.canPublish) {
    throw new Error("این کاربر دسترسی فعال برای نمایش پروفایل ندارد.");
  }

  const shouldNotify = Boolean(profile.publishedAt);

  const [updated] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: {
        visibility: "PUBLIC",
      },
      select: MODERATION_PROFILE_SELECT,
    }),
    prisma.moderationEvent.create({
      data: {
        profileId,
        actorId,
        action: "UNHIDE",
        reason: null,
      },
    }),
  ]);

  await revalidateProfilePaths(profileId);

  if (shouldNotify) {
    await emitUnhidden(updated.userId, updated.id);
  }

  return updated;
}

export type ModerationListFilters = {
  status?: ModerationStatus | "ALL";
  visibility?: ProfileVisibility | "ALL";
  hasAvatar?: boolean;
  cityId?: string;
  skill?: string;
  from?: Date;
  to?: Date;
  q?: string;
};

export type ModerationListResult = {
  items: Array<
    Prisma.ProfileGetPayload<{
      select: {
        id: true;
        firstName: true;
        lastName: true;
        stageName: true;
        cityId: true;
        age: true;
        skills: true;
        avatarUrl: true;
        visibility: true;
        moderationStatus: true;
        updatedAt: true;
      };
    }>
  >;
  total: number;
  page: number;
  pageSize: number;
};

export async function listProfilesForModeration(
  filters: ModerationListFilters,
  paging: { page?: number; pageSize?: number },
): Promise<ModerationListResult> {
  const page = paging.page && paging.page > 0 ? paging.page : 1;
  const pageSize = paging.pageSize && paging.pageSize > 0 ? paging.pageSize : 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ProfileWhereInput = {};

  if (filters.status && filters.status !== "ALL") {
    where.moderationStatus = filters.status;
  }

  if (filters.visibility && filters.visibility !== "ALL") {
    where.visibility = filters.visibility;
  }

  if (typeof filters.hasAvatar === "boolean") {
    where.avatarUrl = filters.hasAvatar
      ? { not: null }
      : { equals: null };
  }

  if (filters.cityId) {
    where.cityId = filters.cityId;
  }

  if (filters.skill) {
    where.skills = {
      contains: `"${filters.skill}"`,
    } as Prisma.JsonFilter;
  }

  if (filters.from || filters.to) {
    where.updatedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.q) {
    const query = filters.q.trim();
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { stageName: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.profile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stageName: true,
        cityId: true,
        age: true,
        skills: true,
        experience: true,
        avatarUrl: true,
        visibility: true,
        moderationStatus: true,
        updatedAt: true,
      },
    }),
    prisma.profile.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
  };
}

export async function getModerationDetail(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      ...MODERATION_PROFILE_SELECT,
      age: true,
      socialLinks: true,
      moderator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  const events = await prisma.moderationEvent.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      reason: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return { profile, events };
}

export { revalidateProfilePaths };
