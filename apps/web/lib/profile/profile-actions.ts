"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  enforceUserProfileVisibility,
  getPublishability,
} from "@/lib/profile/enforcement";
import {
  MODERATION_PROFILE_SELECT,
  type ModerationProfileSnapshot,
  maybeMarkPendingOnCriticalEdit,
} from "@/lib/profile/moderation";
import { didProfileEditableFieldsChange } from "@/lib/profile/profile-edit-cue";
import {
  accentsSchema,
  experienceSchema,
  degreesSchema,
  languagesSchema,
  personalInfoSchema,
  profileVideosSchema,
  awardsSchema,
  gallerySchema,
  voicesSchema,
  skillsSchema,
} from "@/lib/profile/validation";
import {
  deleteByUrl,
  isMediaStorageError,
  saveImageFromFormData,
} from "@/lib/media/storage";
import {
  emitUserPublishSubmitted,
  emitUserUnpublished,
} from "@/lib/notifications/events";
import { validateOwnedReadyVideo } from "@/lib/media/ownership";

const GENERIC_ERROR = "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
const AUTH_ERROR = "نشست شما منقضی شده است. لطفاً دوباره وارد شوید.";
const NO_PROFILE_ERROR = "ابتدا اطلاعات پروفایل خود را تکمیل کنید.";
const PUBLISH_ENTITLEMENT_ERROR = "برای انتشار پروفایل نیاز به اشتراک فعال دارید.";

const DASHBOARD_PROFILE_PATHS = [
  "/dashboard/profile",
  "/profiles",
];

const DIGIT_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => DIGIT_MAP[char] ?? char);
}

function calculateAgeFromBirthDate(birthDate: Date): number | null {
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
}

type PersonalInfoActionResult = {
  ok: boolean;
  fieldErrors?: Partial<Record<keyof z.infer<typeof personalInfoSchema>, string>>;
  error?: string;
  data?: { avatarUrl: string };
};

type SkillsActionResult = {
  ok: boolean;
  error?: string;
};

type LanguagesActionResult = {
  ok: boolean;
  error?: string;
};

type AccentsActionResult = {
  ok: boolean;
  error?: string;
};

type DegreesActionResult = {
  ok: boolean;
  error?: string;
};

type ExperienceActionResult = {
  ok: boolean;
  error?: string;
};

type VideosActionResult = {
  ok: boolean;
  error?: string;
};

type VoicesActionResult = {
  ok: boolean;
  error?: string;
};

type AwardsActionResult = {
  ok: boolean;
  error?: string;
};

type GalleryActionResult = {
  ok: boolean;
  error?: string;
  url?: string;
};

type PublishActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof personalInfoSchema>, string>>;
};

async function ensureSessionUserId(): Promise<string> {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    throw new Error(AUTH_ERROR);
  }

  return session.user.id;
}

async function revalidateProfilePaths(profileId: string) {
  revalidatePath(`/profiles/${profileId}`);
  for (const path of DASHBOARD_PROFILE_PATHS) {
    revalidatePath(path);
  }
}

async function markProfileAsEditedIfNeeded({
  previous,
  next,
}: {
  previous: ModerationProfileSnapshot | null;
  next: ModerationProfileSnapshot | null;
}) {
  if (!next || next.hasProfileEdits || !didProfileEditableFieldsChange(previous, next)) {
    return;
  }

  await prisma.profile.update({
    where: { id: next.id },
    data: { hasProfileEdits: true },
  });
}

function mapZodErrors(
  error: z.ZodError,
): Partial<Record<keyof z.infer<typeof personalInfoSchema>, string>> {
  const fieldErrors: Partial<
    Record<keyof z.infer<typeof personalInfoSchema>, string>
  > = {};

  for (const issue of error.issues) {
    const pathKey = issue.path[0];
    if (typeof pathKey === "string" && !(pathKey in fieldErrors)) {
      fieldErrors[pathKey as keyof z.infer<typeof personalInfoSchema>] =
        issue.message;
    }
  }

  return fieldErrors;
}

export async function upsertPersonalInfo(formData: FormData): Promise<PersonalInfoActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const isPartial = formData.get("partial") === "1";
    const hasField = (key: string) => formData.has(key);
    const getString = (key: string) => (formData.get(key) ?? "").toString().trim();

    const rawAvatarUrl = formData.get("avatarUrl");
    const avatarFile = formData.get("avatar");

    const provided = {
      firstName: hasField("firstName"),
      lastName: hasField("lastName"),
      stageName: hasField("stageName"),
      age: hasField("age"),
      phone: hasField("phone"),
      address: hasField("address"),
      cityId: hasField("cityId"),
      avatarUrl: hasField("avatarUrl"),
      bio: hasField("bio"),
      birthDate: hasField("birthDate"),
      introVideoMediaId: hasField("introVideoMediaId"),
      rating: hasField("rating"),
      skillLevel: hasField("skillLevel"),
    };

    const baseValues: Partial<Record<keyof z.infer<typeof personalInfoSchema>, unknown>> =
      {};

    if (provided.firstName) {
      baseValues.firstName = getString("firstName");
    }
    if (provided.lastName) {
      baseValues.lastName = getString("lastName");
    }
    if (provided.stageName) {
      baseValues.stageName = getString("stageName");
    }
    if (provided.age) {
      baseValues.age = formData.get("age") ?? "";
    }
    if (provided.phone) {
      baseValues.phone = normalizeDigits(getString("phone"));
    }
    if (provided.address) {
      baseValues.address = getString("address");
    }
    if (provided.cityId) {
      baseValues.cityId = getString("cityId");
    }
    if (provided.avatarUrl) {
      baseValues.avatarUrl = typeof rawAvatarUrl === "string" ? rawAvatarUrl.trim() : "";
    }
    if (provided.bio) {
      baseValues.bio = getString("bio");
    }
    if (provided.birthDate) {
      baseValues.birthDate = getString("birthDate");
    }
    if (provided.introVideoMediaId) {
      baseValues.introVideoMediaId = getString("introVideoMediaId");
    }
    if (provided.rating) {
      baseValues.rating = formData.get("rating");
    }
    if (provided.skillLevel) {
      baseValues.skillLevel = formData.get("skillLevel");
    }

    let uploadedAvatarUrl: string | null = null;
    const cleanupUploadedAvatar = async () => {
      if (!uploadedAvatarUrl) {
        return;
      }

      await deleteByUrl(uploadedAvatarUrl, userId).catch(() => undefined);
      uploadedAvatarUrl = null;
    };

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const uploadForm = new FormData();
      uploadForm.set("file", avatarFile);
      const { url } = await saveImageFromFormData(uploadForm, userId);
      baseValues.avatarUrl = url;
      uploadedAvatarUrl = url;
      provided.avatarUrl = true;
    }

    const validationSchema = isPartial ? personalInfoSchema.partial() : personalInfoSchema;
    const parsed = validationSchema.safeParse(baseValues);

    if (!parsed.success) {
      await cleanupUploadedAvatar();
      return {
        ok: false,
        fieldErrors: mapZodErrors(parsed.error),
      };
    }

    const data = parsed.data as Partial<z.infer<typeof personalInfoSchema>>;

    let birthDate: Date | null | undefined = undefined;

    if (provided.birthDate) {
      if (data.birthDate && data.birthDate.trim()) {
        const parts = data.birthDate.split("-").map((value) => Number(value));
        if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
          await cleanupUploadedAvatar();
          return {
            ok: false,
            fieldErrors: { birthDate: "تاریخ تولد معتبر نیست." },
          };
        }

        const [year, month, day] = parts;
        const parsedDate = new Date(Date.UTC(year, month - 1, day));

        if (Number.isNaN(parsedDate.getTime())) {
          await cleanupUploadedAvatar();
          return {
            ok: false,
            fieldErrors: { birthDate: "تاریخ تولد معتبر نیست." },
          };
        }

        const today = new Date();
        if (parsedDate > today) {
          await cleanupUploadedAvatar();
          return {
            ok: false,
            fieldErrors: { birthDate: "تاریخ تولد معتبر نیست." },
          };
        }

        birthDate = parsedDate;
      } else {
        birthDate = null;
      }
    }

    const derivedAge = provided.birthDate
      ? birthDate
        ? calculateAgeFromBirthDate(birthDate)
        : null
      : undefined;

    let introVideoMediaId: string | null | undefined = undefined;

    if (provided.introVideoMediaId) {
      if (data.introVideoMediaId && data.introVideoMediaId.trim()) {
        const validation = await validateOwnedReadyVideo(userId, data.introVideoMediaId);
        if (!validation.ok) {
          await cleanupUploadedAvatar();
          return {
            ok: false,
            fieldErrors: { introVideoMediaId: validation.error },
          };
        }
        introVideoMediaId = validation.mediaId;
      } else {
        introVideoMediaId = null;
      }
    }

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const cleanedAge = provided.age ? (typeof data.age === "number" ? data.age : null) : undefined;
    const cleanedPhone = provided.phone
      ? data.phone?.trim()
        ? data.phone.trim()
        : null
      : undefined;
    const cleanedAddress = provided.address
      ? data.address?.trim()
        ? data.address.trim()
        : null
      : undefined;
    const cleanedCityId = provided.cityId
      ? data.cityId?.trim()
        ? data.cityId.trim()
        : null
      : undefined;

    const updateData: Prisma.ProfileUpdateInput = {};
    const createData: Prisma.ProfileCreateInput = { user: { connect: { id: userId } } };

    if (provided.firstName && typeof data.firstName === "string") {
      updateData.firstName = data.firstName;
      createData.firstName = data.firstName;
    }
    if (provided.lastName && typeof data.lastName === "string") {
      updateData.lastName = data.lastName;
      createData.lastName = data.lastName;
    }
    if (provided.stageName) {
      const stageName =
        data.stageName && data.stageName.trim() ? data.stageName.trim() : null;
      updateData.stageName = stageName;
      createData.stageName = stageName;
    }
    if (provided.birthDate) {
      updateData.birthDate = birthDate ?? null;
      createData.birthDate = birthDate ?? null;
      updateData.age = derivedAge ?? null;
      createData.age = derivedAge ?? null;
    } else if (provided.age) {
      updateData.age = cleanedAge;
      createData.age = cleanedAge ?? null;
    }
    if (provided.phone) {
      updateData.phone = cleanedPhone;
      createData.phone = cleanedPhone ?? null;
    }
    if (provided.address) {
      updateData.address = cleanedAddress;
      createData.address = cleanedAddress ?? null;
    }
    if (provided.cityId) {
      updateData.cityId = cleanedCityId;
      createData.cityId = cleanedCityId ?? null;
    }
    if (provided.rating && typeof data.rating === "number") {
      updateData.rating = data.rating;
      createData.rating = data.rating;
    }
    if (provided.skillLevel && typeof data.skillLevel === "number") {
      updateData.skillLevel = data.skillLevel;
      createData.skillLevel = data.skillLevel;
    }
    if (provided.avatarUrl && typeof data.avatarUrl === "string") {
      updateData.avatarUrl = data.avatarUrl;
      createData.avatarUrl = data.avatarUrl;
    }
    if (provided.bio) {
      const bio = data.bio?.trim() ? data.bio.trim() : null;
      updateData.bio = bio;
      createData.bio = bio;
    }
    if (provided.introVideoMediaId) {
      if (introVideoMediaId) {
        updateData.introVideoMedia = { connect: { id: introVideoMediaId } };
        createData.introVideoMedia = { connect: { id: introVideoMediaId } };
      } else {
        updateData.introVideoMedia = { disconnect: true };
      }
    }

    const result = await prisma.profile.upsert({
      where: { userId },
      create: createData,
      update: updateData,
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return {
      ok: true,
      data: { avatarUrl: result.avatarUrl ?? "" },
    };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }
    if (isMediaStorageError(error)) {
      return { ok: false, error: error.message };
    }

    console.error("upsertPersonalInfo", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateSkills(formData: FormData): Promise<SkillsActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const rawSkills = formData.getAll("skills").map((value) => value?.toString() ?? "");

    const parsed = skillsSchema.safeParse({ skills: rawSkills });

    if (!parsed.success) {
      return { ok: false, error: "لیست مهارت‌ها معتبر نیست." };
    }

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        skills: parsed.data.skills,
      },
      update: {
        skills: parsed.data.skills,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateSkills", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateLanguages(formData: FormData): Promise<LanguagesActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const rawLanguages = formData.get("languages");

    if (typeof rawLanguages !== "string") {
      return { ok: false, error: "لطفاً زبان‌ها را بررسی کنید." };
    }

    let parsedLanguages: unknown;

    try {
      parsedLanguages = JSON.parse(rawLanguages);
    } catch {
      return { ok: false, error: "ساختار زبان‌ها معتبر نیست." };
    }

    const parsed = languagesSchema.safeParse(parsedLanguages);

    if (!parsed.success) {
      return {
        ok: false,
        error: "سطح زبان‌ها باید بین ۱ تا ۵ باشد.",
      };
    }

    const cleanedLanguages =
      parsed.data?.map((entry) => {
        const mediaId = entry.mediaId?.trim() ?? "";
        const url = entry.url?.trim() ?? "";
        const duration =
          typeof entry.duration === "number" && Number.isFinite(entry.duration)
            ? entry.duration
            : null;
        const fileName = entry.fileName?.trim() ?? "";

        return {
          label: entry.label.trim(),
          level: entry.level,
          ...(mediaId && url
            ? {
                mediaId,
                url,
                duration,
                fileName: fileName || null,
              }
            : {}),
        };
      }) ?? [];

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        languages: cleanedLanguages,
      },
      update: {
        languages: cleanedLanguages,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateLanguages", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateAccents(formData: FormData): Promise<AccentsActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const rawAccents = formData.get("accents");

    if (typeof rawAccents !== "string") {
      return { ok: false, error: "لطفاً لهجه‌ها را بررسی کنید." };
    }

    let parsedAccents: unknown;

    try {
      parsedAccents = JSON.parse(rawAccents);
    } catch {
      return { ok: false, error: "ساختار لهجه‌ها معتبر نیست." };
    }

    const parsed = accentsSchema.safeParse(parsedAccents);

    if (!parsed.success) {
      return {
        ok: false,
        error: "لطفاً لهجه‌ها را بررسی کنید.",
      };
    }

    const cleanedAccents: Array<{
      title: string;
      level?: number | null;
      mediaId?: string;
      url?: string;
      duration?: number | null;
    }> = [];
    const seen = new Set<string>();

    for (const entry of parsed.data ?? []) {
      if (typeof entry === "string") {
        const title = entry.trim();
        if (!title) {
          continue;
        }
        const key = title.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        cleanedAccents.push({ title });
        continue;
      }

      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }

      const title =
        typeof (entry as { title?: unknown }).title === "string"
          ? ((entry as { title?: string }).title ?? "").trim()
          : "";

      if (!title) {
        continue;
      }

      const dedupeKey = title.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }

      const mediaId =
        typeof (entry as { mediaId?: unknown }).mediaId === "string"
          ? ((entry as { mediaId?: string }).mediaId ?? "").trim()
          : "";
      const level =
        typeof (entry as { level?: unknown }).level === "number" &&
        Number.isInteger((entry as { level?: number }).level)
          ? ((entry as { level?: number }).level ?? null)
          : null;
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

      seen.add(dedupeKey);
      cleanedAccents.push({
        title,
        ...(level
          ? {
              level,
            }
          : {}),
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

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        accents: cleanedAccents.length > 0 ? cleanedAccents : Prisma.DbNull,
      },
      update: {
        accents: cleanedAccents.length > 0 ? cleanedAccents : Prisma.DbNull,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateAccents", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateDegrees(formData: FormData): Promise<DegreesActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const raw = formData.get("degrees");

    if (typeof raw !== "string") {
      return { ok: false, error: "لطفاً مقاطع تحصیلی را بررسی کنید." };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "ساختار مقاطع تحصیلی معتبر نیست." };
    }

    const validated = degreesSchema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, error: "لطفاً مقاطع تحصیلی را بررسی کنید." };
    }

    const cleaned =
      validated.data?.map((d) => ({
        degreeLevel: d.degreeLevel.trim(),
        major: d.major.trim(),
      })) ?? [];

    const previous = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: { userId, degrees: cleaned.length ? cleaned : Prisma.DbNull },
      update: { degrees: cleaned.length ? cleaned : Prisma.DbNull },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previous, next: result });
    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateExperience(formData: FormData): Promise<ExperienceActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const rawExperience = formData.get("experience");

    if (typeof rawExperience !== "string") {
      return { ok: false, error: "لطفاً اطلاعات تجربه را بررسی کنید." };
    }

    let parsedExperience: unknown;

    try {
      parsedExperience = JSON.parse(rawExperience);
    } catch {
      return { ok: false, error: "ساختار تجربه‌ها معتبر نیست." };
    }

    const parsed = experienceSchema.safeParse(parsedExperience);

    if (!parsed.success) {
      return {
        ok: false,
        error: "لطفاً نقش و نام اثر را برای همه موارد وارد کنید.",
      };
    }

    const cleanedExperience = {
      ...parsed.data,
      resume:
        parsed.data.resume?.map((entry) => ({
          type: entry.type?.trim() ?? "",
          title: entry.title?.trim() ?? "",
          position: entry.position?.trim() ?? "",
          role: entry.role?.trim() ?? "",
          director: entry.director?.trim() ?? "",
        }))?.filter((entry) => Object.values(entry).some((value) => value)) ?? [],
      courses:
        parsed.data.courses?.map((entry) => ({
          title: entry.title?.trim() ?? "",
          instructor: entry.instructor?.trim() ?? "",
        }))?.filter((entry) => entry.title || entry.instructor) ?? [],
    };

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        experience: cleanedExperience,
      },
      update: {
        experience: cleanedExperience,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateExperience", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateVideos(formData: FormData): Promise<VideosActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const raw = formData.get("videos");

    if (typeof raw !== "string") {
      return { ok: false, error: "لطفاً ویدئوها را بررسی کنید." };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "ساختار ویدئوها معتبر نیست." };
    }

    const validated = profileVideosSchema.safeParse(parsed);

    if (!validated.success) {
      return { ok: false, error: "لطفاً ویدئوها را بررسی کنید." };
    }

    const entries = Array.isArray(validated.data) ? validated.data : [];
    const cleaned: { mediaId: string; title?: string; order?: number }[] = [];
    const seen = new Set<string>();

    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry.mediaId !== "string") {
        continue;
      }

      const mediaId = entry.mediaId.trim();

      if (!mediaId || seen.has(mediaId)) {
        continue;
      }

      const validation = await validateOwnedReadyVideo(userId, mediaId);

      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      const title = entry.title?.trim();
      const order =
        typeof entry.order === "number" && Number.isInteger(entry.order)
          ? entry.order
          : undefined;

      cleaned.push({
        mediaId: validation.mediaId,
        title: title ? title : undefined,
        order: order ?? index,
      });
      seen.add(validation.mediaId);
    }

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        videos: cleaned.length > 0 ? cleaned : Prisma.DbNull,
      },
      update: {
        videos: cleaned.length > 0 ? cleaned : Prisma.DbNull,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateVideos", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateAwards(formData: FormData): Promise<AwardsActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const raw = formData.get("awards");

    if (typeof raw !== "string") {
      return { ok: false, error: "لطفاً جوایز را بررسی کنید." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "ساختار جوایز معتبر نیست." };
    }

    const validated = awardsSchema.safeParse(parsed);

    if (!validated.success) {
      return { ok: false, error: "لطفاً جوایز را بررسی کنید." };
    }

    const cleaned =
      validated.data?.map((entry) => ({
        id: entry.id?.trim() || undefined,
        title: entry.title.trim(),
        workTitle: entry.workTitle?.trim() || null,
        place: entry.place?.trim() || null,
        awardDate: entry.date?.trim() || null,
      })) ?? [];

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.profileAward.deleteMany({ where: { profileId: profile.id } }),
      ...(cleaned.length
        ? [
            prisma.profileAward.createMany({
              data: cleaned.map((award) => ({
                profileId: profile.id,
                ...(award.id ? { id: award.id } : {}),
                title: award.title,
                workTitle: award.workTitle,
                place: award.place,
                awardDate: award.awardDate,
              })),
            }),
          ]
        : []),
    ]);

    const result = await prisma.profile.findUnique({
      where: { id: profile.id },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });
    await revalidateProfilePaths(profile.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateAwards", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateVoices(formData: FormData): Promise<VoicesActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const raw = formData.get("voices");

    if (typeof raw !== "string") {
      return { ok: false, error: "لطفاً فایل‌های صوتی را بررسی کنید." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "ساختار فایل‌های صوتی معتبر نیست." };
    }

    const validated = voicesSchema.safeParse(parsed);

    if (!validated.success) {
      return { ok: false, error: "لطفاً فایل‌های صوتی را بررسی کنید." };
    }

    const cleaned =
      validated.data?.map((entry) => ({
        mediaId: entry.mediaId.trim(),
        url: entry.url.trim(),
        title: entry.title?.trim() || null,
        duration: typeof entry.duration === "number" ? entry.duration : null,
        fileName: entry.fileName?.trim() || null,
      })) ?? [];

    const previous = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        voices: cleaned.length ? cleaned : Prisma.DbNull,
      },
      update: {
        voices: cleaned.length ? cleaned : Prisma.DbNull,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previous, next: result });
    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateVoices", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function updateGallery(formData: FormData): Promise<GalleryActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const rawGallery = formData.get("gallery");

    if (typeof rawGallery !== "string") {
      return { ok: false, error: "لطفاً تصاویر گالری را بررسی کنید." };
    }

    let parsedGallery: unknown;

    try {
      parsedGallery = JSON.parse(rawGallery);
    } catch {
      return { ok: false, error: "ساختار گالری معتبر نیست." };
    }

    const parsed = gallerySchema.safeParse(parsedGallery);

    if (!parsed.success) {
      return { ok: false, error: "لطفاً تصاویر گالری را بررسی کنید." };
    }

    const cleaned =
      parsed.data
        ?.map((entry) => {
          const url = entry.url.trim();
          if (!url) {
            return null;
          }
          const slot = entry.slot?.trim();
          return slot ? { url, slot } : { url };
        })
        .filter((entry): entry is { url: string; slot?: string } => Boolean(entry)) ?? [];

    const trimmed = cleaned.slice(0, 7);
    const avatarUrl = trimmed.find((entry) => entry.slot === "headshotFront")?.url ?? null;

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        avatarUrl,
        gallery: trimmed.length ? trimmed : Prisma.DbNull,
      },
      update: {
        avatarUrl,
        gallery: trimmed.length ? trimmed : Prisma.DbNull,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });
    await revalidateProfilePaths(result.id);
    await enforceUserProfileVisibility(userId);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("updateGallery", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function uploadImage(formData: FormData): Promise<GalleryActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "لطفاً یک تصویر انتخاب کنید." };
    }

    const uploadForm = new FormData();
    uploadForm.set("file", file);
    const { url } = await saveImageFromFormData(uploadForm, userId);

    const previousProfile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    const currentGallery = Array.isArray(previousProfile?.gallery)
      ? (previousProfile?.gallery as Array<{ url: string }>)
      : [];

    const nextGallery = [...currentGallery, { url }];

    const result = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        gallery: nextGallery,
      },
      update: {
        gallery: nextGallery,
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await markProfileAsEditedIfNeeded({ previous: previousProfile, next: result });
    await maybeMarkPendingOnCriticalEdit({ old: previousProfile, next: result });

    await revalidateProfilePaths(result.id);

    return { ok: true, url };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }
    if (isMediaStorageError(error)) {
      return { ok: false, error: error.message };
    }

    console.error("uploadImage", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function deleteImage(formData: FormData): Promise<GalleryActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const url = (formData.get("url") ?? "").toString();

    if (!url) {
      return { ok: false, error: "آدرس تصویر نامعتبر است." };
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: MODERATION_PROFILE_SELECT,
    });

    if (!profile) {
      return { ok: false, error: NO_PROFILE_ERROR };
    }

    const currentGallery = Array.isArray(profile.gallery)
      ? (profile.gallery as Array<{ url: string }>)
      : [];

    const nextGallery = currentGallery.filter((item) => item.url !== url);

    const updated = await prisma.profile.update({
      where: { userId },
      data: {
        gallery: nextGallery,
        ...(profile.avatarUrl === url ? { avatarUrl: null } : {}),
      },
      select: MODERATION_PROFILE_SELECT,
    });

    await deleteByUrl(url, userId);
    await markProfileAsEditedIfNeeded({ previous: profile, next: updated });
    await maybeMarkPendingOnCriticalEdit({ old: profile, next: updated });
    await revalidateProfilePaths(updated.id);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }
    if (isMediaStorageError(error)) {
      return { ok: false, error: error.message };
    }

    console.error("deleteImage", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function publishProfile(): Promise<PublishActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stageName: true,
        age: true,
        phone: true,
        address: true,
        cityId: true,
        avatarUrl: true,
        bio: true,
        introVideoMediaId: true,
        moderationStatus: true,
        moderationNotes: true,
        moderatedBy: true,
        moderatedAt: true,
      },
    });

    if (!profile) {
      return { ok: false, error: NO_PROFILE_ERROR };
    }

    const publishability = await getPublishability(userId);

    if (!publishability.canPublish) {
      return { ok: false, error: PUBLISH_ENTITLEMENT_ERROR };
    }

    const validationPayload = {
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      stageName: profile.stageName ?? "",
      age: profile.age ?? "",
      phone: normalizeDigits(profile.phone ?? ""),
      address: profile.address ?? "",
      cityId: profile.cityId ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      bio: profile.bio ?? "",
      introVideoMediaId: profile.introVideoMediaId ?? "",
    };

    const parsed = personalInfoSchema.safeParse(validationPayload);

    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: mapZodErrors(parsed.error),
      };
    }

    const shouldResetModeration =
      !profile.moderationStatus || profile.moderationStatus === "REJECTED";

    await prisma.profile.update({
      where: { userId },
      data: {
        visibility: "PUBLIC",
        publishedAt: new Date(),
        moderationStatus: shouldResetModeration
          ? "PENDING"
          : profile.moderationStatus,
        ...(shouldResetModeration
          ? {
              moderatedBy: null,
              moderatedAt: null,
              moderationNotes: null,
            }
          : {}),
      },
    });

    await revalidateProfilePaths(profile.id);

    await emitUserPublishSubmitted(userId, profile.id);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("publishProfile", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function unpublishProfile(): Promise<PublishActionResult> {
  try {
    const userId = await ensureSessionUserId();
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return { ok: false, error: NO_PROFILE_ERROR };
    }

    await prisma.profile.update({
      where: { userId },
      data: {
        visibility: "PRIVATE",
        publishedAt: null,
      },
    });

    await revalidateProfilePaths(profile.id);

    await emitUserUnpublished(userId, profile.id);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_ERROR) {
      return { ok: false, error: AUTH_ERROR };
    }

    console.error("unpublishProfile", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}
