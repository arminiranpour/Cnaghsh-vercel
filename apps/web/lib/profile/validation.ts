import { z } from "zod";

import { LANGUAGE_LEVEL_MAX } from "./languages";
import { getSkillIdentity, resolveSkillValue } from "./skills";

const AVATAR_URL_ERROR = "لطفاً تصویر پروفایل معتبر انتخاب کنید.";

const AVATAR_UPLOAD_REGEX = /^\/uploads\/[A-Za-z0-9/_.-]+$/;
const INTRO_VIDEO_ERROR = "ویدیوی انتخاب شده معتبر نیست.";

function isValidAvatarUrl(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (AVATAR_UPLOAD_REGEX.test(value)) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

export const personalInfoSchema = z.object({
  firstName: z.string().trim().min(1, "لطفاً نام را وارد کنید.").max(191),
  lastName: z.string().trim().min(1, "لطفاً نام خانوادگی را وارد کنید.").max(191),
  stageName: z.string().trim().max(191).optional().or(z.literal("")),
  age: z
    .preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(5, "سن معتبر نیست.").max(120, "سن معتبر نیست."),
    )
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{10}$/, "شماره تلفن باید با 0 شروع شده و 11 رقم باشد.")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  cityId: z.string().trim().optional().or(z.literal("")),
  avatarUrl: z
    .string()
    .trim()
    .refine(isValidAvatarUrl, AVATAR_URL_ERROR),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید به صورت YYYY-MM-DD باشد.")
    .optional()
    .or(z.literal("")),
  introVideoMediaId: z
    .string()
    .trim()
    .max(191, INTRO_VIDEO_ERROR)
    .optional()
    .or(z.literal("")),
});

export const skillsSchema = z.object({
  skills: z
    .array(z.string().trim().min(1, "لطفاً مهارت معتبر وارد کنید.").max(191))
    .optional()
    .default([])
    .transform((skills) => {
      const result: string[] = [];
      const seen = new Set<string>();

      for (const skill of skills) {
        const resolved = resolveSkillValue(skill);
        const identity = getSkillIdentity(resolved);
        if (!resolved || seen.has(identity)) {
          continue;
        }

        seen.add(identity);
        result.push(resolved);
      }

      return result;
    }),
});

const experienceEntrySchema = z.object({
  role: z.string().trim().min(1, "لطفاً نقش را وارد کنید.").max(191),
  work: z
    .string()
    .trim()
    .min(1, "لطفاً نام اثر یا نمایش را وارد کنید.")
    .max(191),
});

export const experienceSchema = z.object({
  theatre: z.array(experienceEntrySchema).optional().default([]),
  shortFilm: z.array(experienceEntrySchema).optional().default([]),
  cinema: z.array(experienceEntrySchema).optional().default([]),
  tv: z.array(experienceEntrySchema).optional().default([]),
  resume: z
    .array(
      z.object({
        type: z.string().trim().max(191).optional().or(z.literal("")),
        title: z.string().trim().max(191).optional().or(z.literal("")),
        position: z.string().trim().max(191).optional().or(z.literal("")),
        role: z.string().trim().max(191).optional().or(z.literal("")),
        director: z.string().trim().max(191).optional().or(z.literal("")),
      }),
    )
    .optional()
    .default([]),
  courses: z
    .array(
      z.object({
        title: z.string().trim().max(191).optional().or(z.literal("")),
        instructor: z.string().trim().max(191).optional().or(z.literal("")),
      }),
    )
    .optional()
    .default([]),
});

const languageEntrySchema = z.object({
  label: z.string().trim().min(1, "لطفاً نام زبان را وارد کنید.").max(191),
  level: z
    .coerce.number()
    .int()
    .min(1, "سطح باید بین ۱ تا ۵ باشد.")
    .max(LANGUAGE_LEVEL_MAX, "سطح باید بین ۱ تا ۵ باشد."),
  mediaId: z.string().trim().max(191).optional().or(z.literal("")),
  url: z.string().trim().url().optional().or(z.literal("")),
  duration: z.number().nonnegative().optional().nullable(),
});

export const languagesSchema = z.array(languageEntrySchema).optional().default([]);

export const accentEntrySchema = z.object({
  title: z.string().trim().min(1, "لطفاً عنوان لهجه را وارد کنید.").max(100),
  mediaId: z.string().trim().max(191).optional().or(z.literal("")),
  url: z.string().trim().url().optional().or(z.literal("")),
  duration: z.number().nonnegative().optional().nullable(),
});

export const accentsSchema = z
  .array(z.union([z.string().trim().max(100), accentEntrySchema]))
  .optional()
  .nullable();

export const degreeEntrySchema = z.object({
  degreeLevel: z.string().trim().max(100),
  major: z.string().trim().max(100),
});

export const degreesSchema = z.array(degreeEntrySchema).optional().nullable();

const awardDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}(-(?:0[1-9]|1[0-2]))?$/, "تاریخ باید به صورت YYYY یا YYYY-MM باشد.")
  .optional()
  .nullable()
  .or(z.literal(""));

export const awardEntrySchema = z.object({
  id: z.string().trim().cuid().optional().nullable(),
  title: z.string().trim().min(1, "لطفاً عنوان جایزه را وارد کنید.").max(200),
  workTitle: z.string().trim().max(200).optional().nullable().or(z.literal("")),
  place: z.string().trim().max(200).optional().nullable().or(z.literal("")),
  date: awardDateSchema,
});

export const awardsSchema = z.array(awardEntrySchema).optional().nullable();

export const voiceEntrySchema = z.object({
  mediaId: z.string().trim().min(1),
  url: z.string().url(),
  title: z.string().trim().max(200).optional().nullable(),
  duration: z.number().nonnegative().optional().nullable(),
});

export const voicesSchema = z.array(voiceEntrySchema).optional().nullable();

export const profileVideoEntrySchema = z.object({
  mediaId: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  order: z.number().int().optional(),
});

export const profileVideosSchema = z
  .array(profileVideoEntrySchema)
  .optional()
  .nullable();

const gallerySlotSchema = z.enum([
  "headshotFront",
  "profileSide",
  "profileThreeQuarter",
  "fullBody",
  "other",
]);

export const galleryEntrySchema = z.object({
  url: z.string().trim().min(1),
  slot: gallerySlotSchema.optional(),
});

export const gallerySchema = z.array(galleryEntrySchema).optional().nullable();

export function validateReadyToPublish(input: unknown) {
  return personalInfoSchema.safeParse(input);
}
