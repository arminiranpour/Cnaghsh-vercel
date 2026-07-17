"use server";

import { z } from "zod";
import {
  CourseDurationUnit,
  CourseStatus,
  DayOfWeek,
  SemesterStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import type { SessionUser } from "next-auth";

import { getServerAuthSession } from "@/lib/auth/session";
import { createReadyImageMediaAsset, ImageAssetProcessingError } from "@/lib/media/media-asset-images";
import { prisma } from "@/lib/prisma";
import {
  archiveCourse,
  CourseNotFoundError,
  createCourse,
  createSemester,
  publishCourse,
  removeScheduleDay,
  removeSlot,
  ScheduleDayNotFoundError,
  ScheduleOverlapError,
  ScheduleSlotNotFoundError,
  SemesterNotFoundError,
  unpublishCourse,
  updateCourse,
  updateSemester,
  upsertScheduleDay,
  addSlot,
  updateSlot,
} from "@/lib/courses/admin";

type FieldErrors<TFields extends string> = Partial<Record<TFields, string>>;

export type ActionResult<TFields extends string> =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: FieldErrors<TFields> };

type BannerActionResult =
  | { ok: true; mediaId?: string }
  | { ok: false; error: string };

export type CourseFormValues = {
  title: string;
  description: string;
  ageRangeText: string;
  durationValue: number;
  durationUnit: CourseDurationUnit;
  instructorName: string;
  prerequisiteText: string;
  bannerMediaAssetId?: string | null;
  introVideoMediaAssetId?: string | null;
  status?: CourseStatus;
};

export type SemesterFormValues = {
  title: string;
  startsAt: string;
  endsAt: string;
  tuitionAmountIrr: number;
  lumpSumDiscountAmountIrr: number;
  installmentPlanEnabled: boolean;
  installmentCount: number | null;
  capacity: number | null;
  status: SemesterStatus;
};

export type ScheduleDayValues = {
  courseId: string;
  semesterId: string;
  dayOfWeek: DayOfWeek;
};

export type ScheduleSlotValues = {
  courseId: string;
  semesterId: string;
  scheduleDayId: string;
  slotId?: string;
  title?: string | null;
  startMinute: number;
  endMinute: number;
};

const COURSE_LIST_PATH = "/admin/courses";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  ageRangeText: z.string().trim().min(1, "Age range is required."),
  durationValue: z.number().int().min(1, "Duration is required."),
  durationUnit: z.nativeEnum(CourseDurationUnit),
  instructorName: z.string().trim().min(1, "Instructor is required."),
  prerequisiteText: z.string().trim(),
  bannerMediaAssetId: z.string().trim().optional().nullable(),
  introVideoMediaAssetId: z.string().trim().optional().nullable(),
  status: z.nativeEnum(CourseStatus).optional(),
});

const dateSchema = z
  .string()
  .trim()
  .min(1, "Date is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.");

const semesterSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  startsAt: dateSchema,
  endsAt: dateSchema,
  tuitionAmountIrr: z.number().int().min(0, "Tuition is required."),
  lumpSumDiscountAmountIrr: z.number().int().min(0, "Invalid discount."),
  installmentPlanEnabled: z.boolean(),
  installmentCount: z.number().int().min(2, "Minimum 2 installments.").nullable(),
  capacity: z.number().int().min(0, "Capacity must be positive.").nullable(),
  status: z.nativeEnum(SemesterStatus),
});

const scheduleDaySchema = z.object({
  courseId: z.string().cuid(),
  semesterId: z.string().cuid(),
  dayOfWeek: z.nativeEnum(DayOfWeek),
});

const scheduleSlotSchema = z.object({
  courseId: z.string().cuid(),
  semesterId: z.string().cuid(),
  scheduleDayId: z.string().cuid(),
  slotId: z.string().cuid().optional(),
  title: z.string().trim().optional().nullable(),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const BANNER_MAX_BYTES = 10 * 1024 * 1024;

const trimToUndefined = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type AdminSessionUser = SessionUser & { id: string; role: "ADMIN" };

async function ensureAdmin(): Promise<AdminSessionUser> {
  const session = await getServerAuthSession();
  const user = session?.user;
  if (!user || user.role !== "ADMIN" || typeof user.id !== "string" || user.id.length === 0) {
    notFound();
  }
  return {
    ...user,
    id: user.id,
    role: "ADMIN",
  };
}

function mapZodError<TFields extends string>(
  error: z.ZodError,
  fallback: string
): { error: string; fieldErrors: FieldErrors<TFields> } {
  const fieldErrors: FieldErrors<TFields> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key as TFields]) {
      fieldErrors[key as TFields] = issue.message;
    }
  }
  return { error: fallback, fieldErrors };
}

function normalizeCourseValues(values: CourseFormValues) {
  const introVideoMediaAssetId = trimToUndefined(values.introVideoMediaAssetId ?? undefined);
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    ageRangeText: values.ageRangeText.trim(),
    instructorName: values.instructorName.trim(),
    prerequisiteText: values.prerequisiteText?.trim() ?? "",
    bannerMediaAssetId: values.bannerMediaAssetId?.trim() || null,
    introVideoMediaAssetId,
  };
}

function normalizeSemesterValues(values: SemesterFormValues) {
  const startsAt = new Date(values.startsAt);
  const endsAt = new Date(values.endsAt);
  return {
    ...values,
    title: values.title.trim(),
    startsAt,
    endsAt,
    installmentCount: values.installmentPlanEnabled
      ? values.installmentCount
      : null,
  };
}

function buildSemesterErrors(values: SemesterFormValues) {
  const fieldErrors: FieldErrors<keyof SemesterFormValues> = {};
  const startsAt = new Date(values.startsAt);
  const endsAt = new Date(values.endsAt);
  if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime())) {
    if (endsAt <= startsAt) {
      fieldErrors.endsAt = "End date must be after start date.";
    }
  }
  if (values.lumpSumDiscountAmountIrr > values.tuitionAmountIrr) {
    fieldErrors.lumpSumDiscountAmountIrr = "Discount exceeds tuition.";
  }
  if (values.installmentPlanEnabled) {
    if (!values.installmentCount || values.installmentCount < 2) {
      fieldErrors.installmentCount = "Minimum 2 installments.";
    }
  }
  return fieldErrors;
}

export async function createCourseAction(
  values: CourseFormValues
): Promise<ActionResult<keyof CourseFormValues>> {
  try {
    await ensureAdmin();
    const parsed = courseSchema.parse(values);
    const normalized = normalizeCourseValues(parsed);
    await createCourse(normalized);
    revalidatePath(COURSE_LIST_PATH);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const mapped = mapZodError<keyof CourseFormValues>(
        error,
        "Please fix the highlighted fields."
      );
      return { ok: false, error: mapped.error, fieldErrors: mapped.fieldErrors };
    }
    return { ok: false, error: "Failed to create course." };
  }
}

export async function updateCourseAction(
  courseId: string,
  values: CourseFormValues
): Promise<ActionResult<keyof CourseFormValues>> {
  try {
    await ensureAdmin();
    const parsed = courseSchema.parse(values);
    const normalized = normalizeCourseValues(parsed);
    await updateCourse(courseId, normalized);
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return { ok: false, error: "Course not found." };
    }
    if (error instanceof z.ZodError) {
      const mapped = mapZodError<keyof CourseFormValues>(
        error,
        "Please fix the highlighted fields."
      );
      return { ok: false, error: mapped.error, fieldErrors: mapped.fieldErrors };
    }
    return { ok: false, error: "Failed to update course." };
  }
}

export async function uploadCourseBannerAction(
  courseId: string,
  formData: FormData
): Promise<BannerActionResult> {
  try {
    const admin = await ensureAdmin();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Select an image to upload." };
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return { ok: false, error: "Invalid image file." };
    }
    if (file.size > BANNER_MAX_BYTES) {
      return { ok: false, error: "Image must be 10MB or smaller." };
    }
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      return { ok: false, error: "Course not found." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await createReadyImageMediaAsset({
      ownerUserId: admin.id,
      buffer,
      declaredMime: file.type,
      visibility: "public",
      sizeBytes: file.size,
    });
    await prisma.course.update({
      where: { id: courseId },
      data: { bannerMediaAssetId: media.id },
    });
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true, mediaId: media.id };
  } catch (error) {
    if (error instanceof ImageAssetProcessingError) {
      return { ok: false, error: "Only JPG, PNG, WEBP, or HEIC images are allowed." };
    }
    return { ok: false, error: "Failed to upload banner." };
  }
}

export async function removeCourseBannerAction(courseId: string): Promise<BannerActionResult> {
  try {
    await ensureAdmin();
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      return { ok: false, error: "Course not found." };
    }
    await prisma.course.update({
      where: { id: courseId },
      data: { bannerMediaAssetId: null },
    });
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "Failed to remove banner." };
  }
}

export async function publishCourseAction(courseId: string) {
  try {
    await ensureAdmin();
    await publishCourse(courseId);
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return { ok: false, error: "Course not found." } as const;
    }
    return { ok: false, error: "Failed to publish course." } as const;
  }
}

export async function unpublishCourseAction(courseId: string) {
  try {
    await ensureAdmin();
    await unpublishCourse(courseId);
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return { ok: false, error: "Course not found." } as const;
    }
    return { ok: false, error: "Failed to unpublish course." } as const;
  }
}

export async function archiveCourseAction(courseId: string) {
  try {
    await ensureAdmin();
    await archiveCourse(courseId);
    revalidatePath(COURSE_LIST_PATH);
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return { ok: false, error: "Course not found." } as const;
    }
    return { ok: false, error: "Failed to archive course." } as const;
  }
}

export async function createSemesterAction(
  courseId: string,
  values: SemesterFormValues
): Promise<ActionResult<keyof SemesterFormValues>> {
  try {
    await ensureAdmin();
    const parsed = semesterSchema.parse(values);
    const extraErrors = buildSemesterErrors(values);
    if (Object.keys(extraErrors).length > 0) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: extraErrors,
      };
    }
    const normalized = normalizeSemesterValues(parsed);
    await createSemester(courseId, {
      title: normalized.title,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt,
      tuitionAmountIrr: normalized.tuitionAmountIrr,
      lumpSumDiscountAmountIrr: normalized.lumpSumDiscountAmountIrr,
      installmentPlanEnabled: normalized.installmentPlanEnabled,
      installmentCount: normalized.installmentCount,
      capacity: normalized.capacity,
      status: normalized.status,
    });
    revalidatePath(`/admin/courses/${courseId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return { ok: false, error: "Course not found." };
    }
    if (error instanceof z.ZodError) {
      const mapped = mapZodError<keyof SemesterFormValues>(
        error,
        "Please fix the highlighted fields."
      );
      return { ok: false, error: mapped.error, fieldErrors: mapped.fieldErrors };
    }
    return { ok: false, error: "Failed to create semester." };
  }
}

export async function updateSemesterAction(
  courseId: string,
  semesterId: string,
  values: SemesterFormValues
): Promise<ActionResult<keyof SemesterFormValues>> {
  try {
    await ensureAdmin();
    const parsed = semesterSchema.parse(values);
    const extraErrors = buildSemesterErrors(values);
    if (Object.keys(extraErrors).length > 0) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: extraErrors,
      };
    }
    const normalized = normalizeSemesterValues(parsed);
    await updateSemester(semesterId, {
      title: normalized.title,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt,
      tuitionAmountIrr: normalized.tuitionAmountIrr,
      lumpSumDiscountAmountIrr: normalized.lumpSumDiscountAmountIrr,
      installmentPlanEnabled: normalized.installmentPlanEnabled,
      installmentCount: normalized.installmentCount,
      capacity: normalized.capacity,
      status: normalized.status,
    });
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/admin/courses/${courseId}/semesters/${semesterId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof SemesterNotFoundError) {
      return { ok: false, error: "Semester not found." };
    }
    if (error instanceof z.ZodError) {
      const mapped = mapZodError<keyof SemesterFormValues>(
        error,
        "Please fix the highlighted fields."
      );
      return { ok: false, error: mapped.error, fieldErrors: mapped.fieldErrors };
    }
    return { ok: false, error: "Failed to update semester." };
  }
}

export async function addScheduleDayAction(
  values: ScheduleDayValues
): Promise<ActionResult<keyof ScheduleDayValues>> {
  try {
    await ensureAdmin();
    const parsed = scheduleDaySchema.parse(values);
    const result = await upsertScheduleDay(parsed.semesterId, parsed.dayOfWeek);
    if (!result.created) {
      return { ok: false, error: "Day already exists." };
    }
    revalidatePath(`/admin/courses/${parsed.courseId}`);
    revalidatePath(`/admin/courses/${parsed.courseId}/semesters/${parsed.semesterId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const mapped = mapZodError<keyof ScheduleDayValues>(error, "Invalid schedule day.");
      return { ok: false, error: mapped.error, fieldErrors: mapped.fieldErrors };
    }
    return { ok: false, error: "Failed to add day." };
  }
}

export async function removeScheduleDayAction(
  courseId: string,
  semesterId: string,
  scheduleDayId: string
) {
  try {
    await ensureAdmin();
    await removeScheduleDay(semesterId, scheduleDayId);
    revalidatePath(`/admin/courses/${courseId}/semesters/${semesterId}`);
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof ScheduleDayNotFoundError) {
      return { ok: false, error: "Day not found." } as const;
    }
    return { ok: false, error: "Failed to remove day." } as const;
  }
}

export async function addScheduleSlotAction(
  values: ScheduleSlotValues
): Promise<ActionResult<"startMinute" | "endMinute" | "title">> {
  try {
    await ensureAdmin();
    const parsed = scheduleSlotSchema.parse(values);
    if (parsed.endMinute <= parsed.startMinute) {
      return {
        ok: false,
        error: "Invalid time range.",
        fieldErrors: { endMinute: "End time must be after start time." },
      };
    }
    await addSlot(parsed.semesterId, parsed.scheduleDayId, {
      title: parsed.title ?? null,
      startMinute: parsed.startMinute,
      endMinute: parsed.endMinute,
    });
    revalidatePath(`/admin/courses/${parsed.courseId}/semesters/${parsed.semesterId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ScheduleOverlapError) {
      return { ok: false, error: "Time overlaps another slot." };
    }
    if (error instanceof ScheduleDayNotFoundError) {
      return { ok: false, error: "Schedule day not found." };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Invalid slot data." };
    }
    return { ok: false, error: "Failed to add slot." };
  }
}

export async function updateScheduleSlotAction(
  values: ScheduleSlotValues
): Promise<ActionResult<"startMinute" | "endMinute" | "title">> {
  try {
    await ensureAdmin();
    const parsed = scheduleSlotSchema.parse(values);
    if (!parsed.slotId) {
      return { ok: false, error: "Slot not found." };
    }
    if (parsed.endMinute <= parsed.startMinute) {
      return {
        ok: false,
        error: "Invalid time range.",
        fieldErrors: { endMinute: "End time must be after start time." },
      };
    }
    await updateSlot(parsed.semesterId, parsed.slotId, {
      title: parsed.title ?? null,
      startMinute: parsed.startMinute,
      endMinute: parsed.endMinute,
    });
    revalidatePath(`/admin/courses/${parsed.courseId}/semesters/${parsed.semesterId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ScheduleOverlapError) {
      return { ok: false, error: "Time overlaps another slot." };
    }
    if (error instanceof ScheduleSlotNotFoundError) {
      return { ok: false, error: "Slot not found." };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Invalid slot data." };
    }
    return { ok: false, error: "Failed to update slot." };
  }
}

export async function removeScheduleSlotAction(
  courseId: string,
  semesterId: string,
  slotId: string
) {
  try {
    await ensureAdmin();
    await removeSlot(semesterId, slotId);
    revalidatePath(`/admin/courses/${courseId}/semesters/${semesterId}`);
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof ScheduleSlotNotFoundError) {
      return { ok: false, error: "Slot not found." } as const;
    }
    return { ok: false, error: "Failed to remove slot." } as const;
  }
}
