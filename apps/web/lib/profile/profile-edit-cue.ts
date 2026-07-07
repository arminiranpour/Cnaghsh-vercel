import type { ModerationProfileSnapshot } from "@/lib/profile/moderation";

type EditableProfileSnapshot = Pick<
  ModerationProfileSnapshot,
  | "firstName"
  | "lastName"
  | "stageName"
  | "age"
  | "birthDate"
  | "bio"
  | "avatarUrl"
  | "cityId"
  | "phone"
  | "address"
  | "gallery"
  | "skills"
  | "languages"
  | "accents"
  | "experience"
  | "degrees"
  | "voices"
  | "awards"
  | "videos"
  | "introVideoMediaId"
>;

const JSON_FIELD_KEYS = new Set<keyof EditableProfileSnapshot>([
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

const EDITABLE_FIELD_KEYS: Array<keyof EditableProfileSnapshot> = [
  "firstName",
  "lastName",
  "stageName",
  "age",
  "birthDate",
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

function normalizeJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeScalar(value: unknown): string | number | boolean | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return (value as string | number | boolean | null | undefined) ?? null;
}

export function didProfileEditableFieldsChange(
  previous: EditableProfileSnapshot | null,
  next: EditableProfileSnapshot | null,
): boolean {
  if (!next) {
    return false;
  }

  if (!previous) {
    return true;
  }

  for (const key of EDITABLE_FIELD_KEYS) {
    const oldValue = previous[key];
    const newValue = next[key];

    if (JSON_FIELD_KEYS.has(key)) {
      if (normalizeJson(oldValue) !== normalizeJson(newValue)) {
        return true;
      }
      continue;
    }

    if (normalizeScalar(oldValue) !== normalizeScalar(newValue)) {
      return true;
    }
  }

  return false;
}

export function shouldHighlightEditProfileIcon(
  profile: { hasProfileEdits?: boolean | null } | null | undefined,
): boolean {
  return !profile?.hasProfileEdits;
}
