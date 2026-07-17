import { ACCENT_OPTIONS } from "./accents";
import { LANGUAGE_OPTIONS } from "./languages";

export const GENDER_FILTERS = [
  { value: "male", label: "مرد" },
  { value: "female", label: "زن" },
  { value: "other", label: "سایر" },
] as const;

export type GenderFilterValue = (typeof GENDER_FILTERS)[number]["value"];
export const GENDER_LABEL_MAP = new Map(GENDER_FILTERS.map((item) => [item.value, item.label] as const));

export const EDUCATION_FILTERS = [
  { value: "diploma", label: "دیپلم" },
  { value: "associate", label: "کاردانی" },
  { value: "bachelor", label: "کارشناسی" },
  { value: "master", label: "کارشناسی ارشد" },
  { value: "phd", label: "دکترا" },
  { value: "other", label: "سایر" },
] as const;

export type EducationFilterValue = (typeof EDUCATION_FILTERS)[number]["value"];
export const EDUCATION_LABEL_MAP = new Map(
  EDUCATION_FILTERS.map((item) => [item.value, item.label] as const),
);

export const LANGUAGE_FILTERS = LANGUAGE_OPTIONS.map((item) => ({
  value: item.key,
  label: item.label,
}));

export type LanguageFilterValue = (typeof LANGUAGE_FILTERS)[number]["value"];
export const LANGUAGE_LABEL_MAP = new Map(
  LANGUAGE_FILTERS.map((item) => [item.value, item.label] as const),
);

export const ACCENT_FILTERS: { value: string; label: string }[] = [...ACCENT_OPTIONS];

export const ACCENT_LABEL_MAP = new Map(ACCENT_FILTERS.map((item) => [item.value, item.label] as const));
