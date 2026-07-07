/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import addImage from "./add-image.png";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import type { ProfileTabId } from "@/components/profile/ProfilePageClient";
import { AudioWaveform } from "@/components/profile/CenterPane/AudioSlide";
import { EDIT_PROFILE_MOBILE_BOTTOM_NAV_H } from "@/components/profile/editProfile/constants";
import type { WaveformAudioPlayerHandle } from "@/components/ui/WaveformAudioPlayer";
import { useToast } from "@/components/ui/use-toast";
import type { City } from "@/lib/location/cities";
import { LANGUAGE_LEVEL_MAX, type LanguageSkill } from "@/lib/profile/languages";
import { SKILLS, type SkillKey } from "@/lib/profile/skills";
import type { UploadErrorResponse, UploadInitResponse } from "@/lib/media/types";
import type {
  AccentEntry,
  CourseEntry,
  ExperienceData,
  ExperienceEntry,
  PortfolioEditInitialValues,
  ResumeEntry,
} from "@/lib/profile/portfolio-edit";
import {
  updateAccents,
  updateDegrees,
  deleteImage,
  updateGallery,
  updateExperience,
  updateLanguages,
  updateSkills,
  updateAwards,
  updateVideos,
  updateVoices,
  uploadImage,
  upsertPersonalInfo,
} from "@/lib/profile/profile-actions";

type ProvinceOption = {
  id: string;
  name: string;
};

type AudioAttachment = {
  mediaId: string;
  url: string;
  duration?: number | null;
};

type AudioRowEntry = {
  title: string;
  audio: AudioAttachment;
};

type AudioRowItem = AudioRowEntry & {
  key: string;
  source: "voice" | "language" | "accent";
  sourceId: string;
};

type VideoAttachment = {
  mediaId: string;
  url?: string | null;
};

type LanguageEntryState = {
  id: string;
  label: string;
  level: number | null;
  audio?: AudioAttachment | null;
};

type AccentEntryState = {
  id: string;
  title: string;
  audio?: AudioAttachment | null;
};

type SkillEntryState = {
  id: string;
  value: SkillKey | "";
};

type VideoEntryState = {
  id: string;
  title: string;
  recordedMonth: string;
  recordedYear: string;
  mediaId?: string;
  url?: string | null;
};

type VoiceEntryState = {
  id: string;
  title: string;
  audio?: AudioAttachment | null;
};

type AwardEntryState = {
  id: string;
  awardId: string | null;
  title: string;
  workTitle: string;
  festivalTitle: string;
  awardYear: string;
};

type ResumeEntryState = ResumeEntry & { id: string };
type CourseEntryState = CourseEntry & { id: string };
type DegreeEntryState = {
  id: string;
  degreeLevel: string;
  major: string;
};
type ExperienceCategoryKey = keyof ExperienceData;
type ExperienceEntryState = ExperienceEntry & { id: string };

type GalleryAsset = {
  url: string;
  slot?: "headshotFront" | "profileSide" | "profileThreeQuarter" | "fullBody" | "other";
};

type GallerySlotId =
  | "headshotFront"
  | "profileSide"
  | "profileThreeQuarter"
  | "fullBody"
  | "other-0"
  | "other-1"
  | "other-2";

type PortfolioEditCenterPaneProps = {
  initialValues: PortfolioEditInitialValues;
  cities: City[];
  provinces: ProvinceOption[];
  onCancel: () => void;
  onSaved: () => void;
};

const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const VIDEO_MAX_DURATION_SEC = 120;
const POLL_INTERVAL_MS = 3000;
const DASH_BORDER_COLOR = "#D9D9D9";
const DASH_BORDER_LENGTH = 16;
const DASH_BORDER_GAP = 12;
const DASH_BORDER_THICKNESS = 0.5;
const DEGREE_LEVEL_OPTIONS = [
  "دیپلم",
  "کاردانی",
  "کارشناسی",
  "کارشناسی ارشد",
  "دکترا",
  "سایر",
];
const EDIT_TABS = [
  { id: "personal", label: "اطلاعات شخصی" },
  { id: "gallery", label: "گالری تصاویر" },
  { id: "videos", label: "ویدئوها" },
  { id: "audio", label: "فایل‌های صوتی" },
  { id: "awards", label: "افتخارات" },
] as const satisfies ReadonlyArray<{ id: ProfileTabId; label: string }>;
const EXPERIENCE_SECTION_CONFIG: Array<{
  key: ExperienceCategoryKey;
  label: string;
}> = [
  { key: "theatre", label: "تئاتر" },
  { key: "shortFilm", label: "فیلم کوتاه" },
  { key: "tv", label: "تلویزیون" },
  { key: "cinema", label: "سینمایی" },
];
const MAX_OTHER_IMAGES = 3;
const NOTE_TEXT =
  "اطلاعات خواسته شده همان چیزهایی هستن که عوامل برای انتخاب بازیگر بیش‌تر توجه می‌کنند. هرچی اطلاعات کامل‌تر باشه، شانس انتخاب شدن بیشتر می‌شه. یادت باشه که داری مسیر حرفه‌ای خودت رو دقیق‌تر می‌کنی.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolvePlaybackBase = () => {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase && envBase.length > 0) {
    return envBase.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
};

const toAbsolutePlaybackUrl = (value: string) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = resolvePlaybackBase();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
};

const getAudioPlaybackUrl = (mediaId: string) => {
  return toAbsolutePlaybackUrl(`/api/media/${mediaId}/file`);
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const pad2 = (value: string) => value.padStart(2, "0");
const formatAudioDuration = (duration?: number | null) => {
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return "--:--";
  }
  const totalSeconds = Math.max(0, Math.round(duration));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(String(minutes))}:${pad2(String(seconds))}`;
};

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

const normalizeDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (char) => DIGIT_MAP[char] ?? char);

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const div = (value: number, base: number) => Math.trunc(value / base);
const mod = (value: number, base: number) => value - div(value, base) * base;
const PERSIAN_NUMBER_FORMATTER = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const formatPersianNumber = (value: number) => PERSIAN_NUMBER_FORMATTER.format(value);

const jalCal = (jy: number) => {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  if (jy < jp || jy >= breaks[breaks.length - 1]) {
    throw new Error("Invalid Jalali year");
  }

  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }
  return { leap, gy, march };
};

const isLeapJalaliYear = (jy: number) => jalCal(jy).leap === 0;

const j2d = (jy: number, jm: number, jd: number) => {
  const { gy, march } = jalCal(jy);
  return (
    g2d(gy, 3, march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
};

const d2j = (jdn: number) => {
  const { gy } = d2g(jdn);
  let jy = gy - 621;
  const { march } = jalCal(jy);
  const jdn1f = g2d(gy, 3, march);
  let k = jdn - jdn1f;
  let jm;
  let jd;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (jalCal(jy).leap === 1) {
      k += 1;
    }
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
};

const g2d = (gy: number, gm: number, gd: number) => {
  let jdn =
    div(1461 * (gy + div(gm - 8, 6) + 100100), 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  jdn = jdn - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return jdn;
};

const d2g = (jdn: number) => {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
};

const toGregorian = (jy: number, jm: number, jd: number) => d2g(j2d(jy, jm, jd));
const toJalali = (gy: number, gm: number, gd: number) => d2j(g2d(gy, gm, gd));

const getJalaliDaysInMonth = (jy: number, jm: number) => {
  if (jm <= 6) {
    return 31;
  }
  if (jm <= 11) {
    return 30;
  }
  return isLeapJalaliYear(jy) ? 30 : 29;
};

const getCurrentJalaliYear = () => {
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    timeZone: "UTC",
  });
  const parts = formatter.formatToParts(new Date());
  const yearPart = parts.find((part) => part.type === "year")?.value ?? "";
  const normalized = normalizeDigits(yearPart);
  return Number(normalized) || 1400;
};

const resolveGallerySlots = (entries: GalleryAsset[]) => {
  const result: {
    headshotFront: GalleryAsset | null;
    profileSide: GalleryAsset | null;
    profileThreeQuarter: GalleryAsset | null;
    fullBody: GalleryAsset | null;
    other: GalleryAsset[];
  } = {
    headshotFront: null,
    profileSide: null,
    profileThreeQuarter: null,
    fullBody: null,
    other: [],
  };

  const unassigned: GalleryAsset[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry.url !== "string") {
      continue;
    }

    const url = entry.url.trim();
    if (!url) {
      continue;
    }

    const asset: GalleryAsset = { url, slot: entry.slot };

    switch (entry.slot) {
      case "headshotFront":
        if (!result.headshotFront) result.headshotFront = asset;
        else unassigned.push(asset);
        break;
      case "profileSide":
        if (!result.profileSide) result.profileSide = asset;
        else unassigned.push(asset);
        break;
      case "profileThreeQuarter":
        if (!result.profileThreeQuarter) result.profileThreeQuarter = asset;
        else unassigned.push(asset);
        break;
      case "fullBody":
        if (!result.fullBody) result.fullBody = asset;
        else unassigned.push(asset);
        break;
      case "other":
        result.other.push(asset);
        break;
      default:
        unassigned.push(asset);
    }
  }

  const fallbackSlots = [
    "headshotFront",
    "profileSide",
    "profileThreeQuarter",
    "fullBody",
  ] as const;

  for (const slot of fallbackSlots) {
    if (!result[slot] && unassigned.length > 0) {
      const next = unassigned.shift();
      if (next) {
        result[slot] = { ...next, slot };
      }
    }
  }

  result.other = [...result.other, ...unassigned].slice(0, MAX_OTHER_IMAGES);

  return result;
};

async function uploadAudioFile(file: File): Promise<AudioAttachment> {
  const initResponse = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name || "audio",
      contentType: file.type || "audio/mpeg",
      sizeBytes: file.size,
    }),
  });

  const initPayload = (await initResponse.json()) as UploadInitResponse | UploadErrorResponse;

  if (!initResponse.ok || !("ok" in initPayload) || !initPayload.ok) {
    const message =
      (initPayload as UploadErrorResponse)?.messageFa ?? "خطا در شروع آپلود فایل صوتی.";
    throw new Error(message);
  }

  const mediaId = initPayload.mediaId;
  const signedUrl = initPayload.signedUrl;
  const checkStatusUrl = initPayload.next?.checkStatusUrl ?? `/api/media/${mediaId}/status`;
  const finalizeUrl = initPayload.next?.finalizeUrl ?? `/api/media/${mediaId}/finalize`;

  if (!mediaId || !signedUrl) {
    throw new Error("اطلاعات آپلود ناقص است.");
  }

  const putResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error("بارگذاری فایل صوتی ناموفق بود.");
  }

  const finalizeResponse = await fetch(finalizeUrl, {
    method: "POST",
    cache: "no-store",
  });

  if (!finalizeResponse.ok) {
    const payload = (await finalizeResponse.json().catch(() => null)) as { messageFa?: string } | null;
    throw new Error(payload?.messageFa ?? "تأیید نهایی آپلود ناموفق بود.");
  }

  const pollUntilReady = async () => {
    while (true) {
      const response = await fetch(checkStatusUrl, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        status?: string;
        errorMessage?: string | null;
        durationSec?: number | null;
      };

      if (!response.ok || !payload?.ok || !payload.status) {
        throw new Error("وضعیت آپلود قابل دریافت نیست.");
      }

      if (payload.status === "ready") {
        return {
          duration: typeof payload.durationSec === "number" ? payload.durationSec : null,
        };
      }

      if (payload.status === "failed") {
        throw new Error(payload.errorMessage || "پردازش فایل صوتی ناموفق بود.");
      }

      await sleep(POLL_INTERVAL_MS);
    }
  };

  const { duration } = await pollUntilReady();

  return {
    mediaId,
    url: getAudioPlaybackUrl(mediaId),
    duration,
  };
}

async function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

async function uploadVideoFile(
  file: File,
  durationSec?: number | null,
): Promise<VideoAttachment> {
  const metadata: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    estimatedDurationSec?: number;
  } = {
    fileName: file.name || "video",
    contentType: file.type || "video/mp4",
    sizeBytes: file.size,
  };

  if (typeof durationSec === "number" && Number.isFinite(durationSec)) {
    metadata.estimatedDurationSec = Math.ceil(durationSec);
  }

  const initResponse = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(metadata),
  });

  const initPayload = (await initResponse.json()) as UploadInitResponse | UploadErrorResponse;

  if (!initResponse.ok || !("ok" in initPayload) || !initPayload.ok) {
    const message =
      (initPayload as UploadErrorResponse)?.messageFa ?? "خطا در شروع آپلود ویدئو.";
    throw new Error(message);
  }

  const mediaId = initPayload.mediaId;
  const signedUrl = initPayload.signedUrl;
  const checkStatusUrl = initPayload.next?.checkStatusUrl ?? `/api/media/${mediaId}/status`;
  const finalizeUrl = initPayload.next?.finalizeUrl ?? `/api/media/${mediaId}/finalize`;

  if (!mediaId) {
    throw new Error("اطلاعات آپلود ناقص است.");
  }

  if (initPayload.mode !== "signed-put" || !signedUrl) {
    throw new Error("روش آپلود پشتیبانی نمی‌شود.");
  }

  const putResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error("بارگذاری ویدئو ناموفق بود.");
  }

  const finalizeResponse = await fetch(finalizeUrl, {
    method: "POST",
    cache: "no-store",
  });

  if (!finalizeResponse.ok) {
    const payload = (await finalizeResponse.json().catch(() => null)) as { messageFa?: string } | null;
    throw new Error(payload?.messageFa ?? "تأیید نهایی آپلود ناموفق بود.");
  }

  const pollUntilReady = async () => {
    while (true) {
      const response = await fetch(checkStatusUrl, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        status?: string;
        errorMessage?: string | null;
      };

      if (!response.ok || !payload?.ok || !payload.status) {
        throw new Error("وضعیت آپلود قابل دریافت نیست.");
      }

      if (payload.status === "ready") {
        return;
      }

      if (payload.status === "failed") {
        throw new Error(payload.errorMessage || "پردازش ویدئو ناموفق بود.");
      }

      await sleep(POLL_INTERVAL_MS);
    }
  };

  await pollUntilReady();

  return {
    mediaId,
  };
}

const buildDashedBorderStyle = (radius: number): CSSProperties => ({
  backgroundImage: `
    repeating-linear-gradient(90deg, ${DASH_BORDER_COLOR} 0 ${DASH_BORDER_LENGTH}px, transparent ${DASH_BORDER_LENGTH}px ${DASH_BORDER_LENGTH + DASH_BORDER_GAP}px),
    repeating-linear-gradient(90deg, ${DASH_BORDER_COLOR} 0 ${DASH_BORDER_LENGTH}px, transparent ${DASH_BORDER_LENGTH}px ${DASH_BORDER_LENGTH + DASH_BORDER_GAP}px),
    repeating-linear-gradient(0deg, ${DASH_BORDER_COLOR} 0 ${DASH_BORDER_LENGTH}px, transparent ${DASH_BORDER_LENGTH}px ${DASH_BORDER_LENGTH + DASH_BORDER_GAP}px),
    repeating-linear-gradient(0deg, ${DASH_BORDER_COLOR} 0 ${DASH_BORDER_LENGTH}px, transparent ${DASH_BORDER_LENGTH}px ${DASH_BORDER_LENGTH + DASH_BORDER_GAP}px)
  `,
  backgroundPosition: "0 0, 0 100%, 0 0, 100% 0",
  backgroundSize: `100% ${DASH_BORDER_THICKNESS}px, 100% ${DASH_BORDER_THICKNESS}px, ${DASH_BORDER_THICKNESS}px 100%, ${DASH_BORDER_THICKNESS}px 100%`,
  backgroundRepeat: "repeat-x, repeat-x, repeat-y, repeat-y",
  borderRadius: `${radius}px`,
});

function LevelDots({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-row-reverse items-center gap-1">
      {Array.from({ length: LANGUAGE_LEVEL_MAX }).map((_, index) => {
        const level = index + 1;
        const isActive = value !== null && level <= value;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            disabled={disabled}
            className={`h-2.5 w-2.5 rounded-full transition ${
              isActive ? "bg-[#5C5A5A]" : "bg-[#D9D9D9]"
            }`}
          />
        );
      })}
    </div>
  );
}

function AudioUploadField({
  value,
  onChange,
  onUploadStart,
  onUploadEnd,
  onError,
  disabled,
}: {
  value?: AudioAttachment | null;
  onChange: (value: AudioAttachment | null) => void;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!file.type.startsWith("audio/")) {
        onError("لطفاً یک فایل صوتی انتخاب کنید.");
        return;
      }

      if (file.size > AUDIO_MAX_BYTES) {
        onError("حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشد.");
        return;
      }

      setIsUploading(true);
      onUploadStart();

      try {
        const result = await uploadAudioFile(file);
        onChange(result);
      } catch (error) {
        onError(error instanceof Error ? error.message : "آپلود فایل صوتی ناموفق بود.");
      } finally {
        setIsUploading(false);
        onUploadEnd();
      }
    },
    [onChange, onError, onUploadEnd, onUploadStart],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7A7A7A]">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="flex h-[30px] w-full items-center justify-center rounded-full bg-[#EDEDED] px-3 text-[11px] text-[#6B6B6B]"
      >
        {isUploading ? "در حال آپلود..." : "بارگذاری فایل صوتی +"}
      </button>
      {value ? (
        <>
          <span className="text-[#4B4B4B]">فایل صوتی انتخاب شد</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled || isUploading}
            className="text-[#D56732]"
          >
            حذف
          </button>
        </>
      ) : null}
    </div>
  );
}

function AudioRow({
  entry,
  isActive,
  onDelete,
  onPlayStateChange,
}: {
  entry: AudioRowEntry;
  isActive: boolean;
  onDelete: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const waveformRef = useRef<WaveformAudioPlayerHandle | null>(null);

  const title = entry.title.trim() || "فایل صوتی بدون عنوان";
  const durationLabel = formatAudioDuration(entry.audio.duration);

  const handleToggle = () => {
    waveformRef.current?.togglePlay();
  };

  const handlePlayStateChange = (nextIsPlaying: boolean) => {
    setIsPlaying(nextIsPlaying);
    onPlayStateChange(nextIsPlaying);
  };

  return (
    <div className="rounded-[16px] border border-[#E8E8E8] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-4">
                <button
          type="button"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#D56732]"
          aria-label="حذف فایل صوتی"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
        <div className="flex items-center justify-end gap-3">
          <span
            className={`text-[14px] font-semibold ${
              isActive ? "text-[#FF7F19]" : "text-black"
            }`}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: isPlaying ? "#FF7F19" : "#B1ADAD" }}
          >
            {isPlaying ? (
              <div className="flex gap-1">
                <span className="h-4 w-[3px] bg-white" />
                <span className="h-4 w-[3px] bg-white" />
              </div>
            ) : (
              <span className="ml-0.5 h-0 w-0 border-y-[7px] border-y-transparent border-l-[11px] border-l-white" />
            )}
          </button>
        </div>

      </div>
      <div
        className={`mt-3 flex items-center gap-3 rounded-full border px-4 py-2 ${
          isActive ? "border-[#FF7F19]" : "border-[#E8E8E8]"
        }`}
      >
        <div className="flex-1">
          <AudioWaveform
            ref={waveformRef}
            src={entry.audio.url}
            onPlayStateChange={handlePlayStateChange}
            className="w-full"
          />
        </div>
        <span className="shrink-0 text-[11px] text-[#A9A9A9]">
          {durationLabel}
        </span>
      </div>
    </div>
  );
}

function AudioUploadCard({
  entry,
  inputClass,
  sectionTitleClass,
  onChangeTitle,
  onChangeAudio,
  onCancel,
  onUploadStart,
  onUploadEnd,
  onError,
  disabled,
}: {
  entry: VoiceEntryState;
  inputClass: string;
  sectionTitleClass: string;
  onChangeTitle: (value: string) => void;
  onChangeAudio: (audio: AudioAttachment | null) => void;
  onCancel: () => void;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-[#E3E3E3] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-2">
            <label className={`${sectionTitleClass} block`}>عنوان</label>
            <input
              className={inputClass}
              placeholder="عنوان"
              value={entry.title}
              onChange={(event) => onChangeTitle(event.target.value)}
              disabled={disabled}
              maxLength={100}
            />
          </div>
          <AudioUploadField
            value={entry.audio}
            onChange={onChangeAudio}
            onUploadStart={onUploadStart}
            onUploadEnd={onUploadEnd}
            onError={onError}
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="text-[12px] text-[#D56732]"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}

function AddAudioBar({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="dash-pill flex h-[36px] w-full items-center justify-center rounded-full text-[16px] text-[#B5B5B5]"
    >
      +
    </button>
  );
}

function AddAwardBar({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[36px] w-full items-center justify-center rounded-[15px] text-[16px] text-[#B5B5B5]"
      style={buildDashedBorderStyle(15)}
    >
      +
    </button>
  );
}

function VideoUploadCard({
  value,
  monthOptions,
  yearOptions,
  uploadPhase,
  onPickFile,
  onRemove,
  onChangeTitle,
  onChangeMonth,
  onChangeYear,
  disabled,
}: {
  value: VideoEntryState;
  monthOptions: number[];
  yearOptions: number[];
  uploadPhase: "idle" | "uploading" | "processing";
  onPickFile: () => void;
  onRemove: () => void;
  onChangeTitle: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onChangeYear: (value: string) => void;
  disabled?: boolean;
}) {
  const hasVideo = Boolean(value.mediaId || value.url);
  const statusLabel =
    uploadPhase === "processing"
      ? "در حال پردازش ویدئو..."
      : uploadPhase === "uploading"
        ? "در حال بارگذاری ویدئو..."
        : hasVideo
          ? "ویدئو بارگذاری شد"
          : "فایل ویدئو را بارگذاری کنید";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-[15px] text-[#5C5A5A]">عنوان</label>
        <input
          className="h-[35px] w-[245px] rounded-full bg-[#EFEFEF] px-4 text-[12px] text-[#7A7A7A] placeholder:text-[#7A7A7A] focus:outline-none"
          value={value.title}
          onChange={(event) => onChangeTitle(event.target.value)}
          disabled={disabled}
        />
      </div>


        <div className="space-y-2">
          <label className="text-[15px] text-[#5C5A5A]">تاریخ ضبط</label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/images/flash-down.png"
                alt=""
                className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
              />
              <select
                className="h-[35px] w-[90px] appearance-none rounded-full bg-[#EFEFEF] pl-8 pr-4 text-[12px] text-[#7A7A7A] focus:outline-none"
                value={value.recordedMonth}
                onChange={(event) => onChangeMonth(event.target.value)}
                disabled={disabled}
              >
                <option value="">ماه</option>
                {monthOptions.map((month) => (
                  <option key={month} value={String(month)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <img
                src="/images/flash-down.png"
                alt=""
                className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
              />
              <select
                className="h-[35px] w-[110px] appearance-none rounded-full bg-[#EFEFEF] pl-8 pr-4 text-[12px] text-[#7A7A7A] focus:outline-none"
                value={value.recordedYear}
                onChange={(event) => onChangeYear(event.target.value)}
                disabled={disabled}
              >
                <option value="">سال</option>
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onPickFile}
        disabled={disabled}
        className="flex h-[191px] w-full items-center justify-center rounded-[15px] bg-[#F3F3F3]"
        style={buildDashedBorderStyle(10)}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-[43px] w-[43px] items-center justify-center rounded-[12px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
            <svg
              width="22"
              height="16"
              viewBox="0 0 22 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6.8 12.5H16.2C18.4 12.5 20 11 20 9.1C20 7.5 18.9 6.2 17.4 5.9C17.2 3.4 15.2 1.5 12.6 1.5C10.6 1.5 8.9 2.6 8.1 4.3C7.9 4.3 7.7 4.3 7.5 4.3C5.3 4.3 3.5 6 3.5 8.1C3.5 10.2 5.1 12 6.8 12.5Z"
                stroke="#A6A6A6"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <path
                d="M11 6.4V10.6"
                stroke="#A6A6A6"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <path
                d="M9.2 8.2L11 6.4L12.8 8.2"
                stroke="#A6A6A6"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[11px] text-[#5C5A5A]">{statusLabel}</p>
          <p className="text-[9px] text-[#7A7A7A]">حداکثر حجم: ۴۰ مگابایت</p>
          <p className="text-[9px] text-[#7A7A7A]">حداکثر مدت: ۲ دقیقه</p>
        </div>
      </button>

      {uploadPhase === "idle" ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={hasVideo ? "text-[12px] text-[#D56732]" : "text-[12px] text-[#B5B5B5]"}
        >
          {hasVideo ? "حذف ویدئو" : "انصراف"}
        </button>
      ) : null}
    </div>
  );
}

function AddVideoBar({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[36px] w-full items-center justify-center rounded-[15px] text-[16px] text-[#B5B5B5]"
      style={buildDashedBorderStyle(15)}
    >
      +
    </button>
  );
}

function EditProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: ProfileTabId;
  onChange: (tab: ProfileTabId) => void;
}) {
  return (
<div className="mt-4 w-full bg-white pt-4" dir="rtl">
  <div className="relative flex flex-wrap items-center justify-center gap-4 px-4 pb-3 text-[12px] font-semibold md:justify-between md:px-[112px] md:text-[14px]">
    {/* Gray base line (constant) */}
    <div className="absolute inset-x-4 bottom-[13px] h-px bg-[#B4B4B4] md:inset-x-[112px]" />

    {EDIT_TABS.map((tab) => {
      const isActive = tab.id === activeTab;

      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className="relative pb-2"
        >
          <span className={isActive ? "font-bold text-[#FF7F19]" : "text-[#B4B4B4]"}>
            {tab.label}
          </span>

          {/* Orange underline exactly on gray line */}
          {isActive && (
            <span className="absolute inset-x-0 bottom-0 h-px pb-[3px] bg-[#FF7F19]" />
          )}
        </button>
      );
    })}
  </div>
</div>


  );
}

function GalleryImageSlot({
  title,
  value,
  onPick,
  onDelete,
  disabled,
}: {
  title?: string;
  value?: GalleryAsset | null;
  onPick: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  const hasValue = Boolean(value?.url);

  return (
    <div className="flex flex-col items-start gap-2 text-left">
      {title ? <span className="text-[15px] text-[#5C5A5A]">{title}</span> : null}

      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={title ?? "انتخاب تصویر"}
        className={`relative flex w-full aspect-[165/181] items-center justify-center rounded-[13px] md:h-[181px] md:w-[165px] ${
          hasValue ? "overflow-hidden" : "border-[1px] border-dashed border-[#808080]"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {hasValue ? (
          <>
            <img src={value?.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute right-2 top-2 flex flex-col gap-1">
              <span className="h-1 w-1 rounded-full bg-white/80" />
              <span className="h-1 w-1 rounded-full bg-white/80" />
              <span className="h-1 w-1 rounded-full bg-white/80" />
            </div>
            {onDelete ? (
              <span
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!disabled) {
                    onDelete();
                  }
                }}
                onKeyDown={(event) => {
                  if (disabled) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onDelete();
                  }
                }}
                aria-disabled={disabled}
                aria-label="حذف تصویر"
                className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] text-[#D12424] shadow"
              >
                حذف
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute bottom-2 right-2 text-[11px] text-white">عنوان تصویر...</span>
          </>
        ) : (
        <Image
          src={addImage}
          alt=""
          className="h-8 w-8 opacity-40"
          width={32}
          height={32}
        />

        )}
      </button>
    </div>
  );
}


function EditProfileGalleryPane({
  headshotFront,
  profileSide,
  profileThreeQuarter,
  fullBody,
  otherImages,
  onPick,
  onDelete,
  onSave,
  isBusy,
  error,
}: {
  headshotFront: GalleryAsset | null;
  profileSide: GalleryAsset | null;
  profileThreeQuarter: GalleryAsset | null;
  fullBody: GalleryAsset | null;
  otherImages: Array<GalleryAsset | null>;
  onPick: (slot: GallerySlotId) => void;
  onDelete: (slot: GallerySlotId, url?: string | null) => void;
  onSave: () => void;
  isBusy?: boolean;
  error?: string | null;
}) {
  return (
    <div className="px-4 pb-10 pt-4 text-[12px] text-[#5C5A5A] md:px-[82px] md:pt-6">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 justify-items-stretch sm:grid-cols-2 md:grid-cols-3 md:gap-6 md:justify-items-start">
          <GalleryImageSlot
            title="تصویر تمام‌رخ"
            value={headshotFront}
            onPick={() => onPick("headshotFront")}
            onDelete={() => onDelete("headshotFront", headshotFront?.url ?? null)}
            disabled={isBusy}
          />
          <GalleryImageSlot
            title="تصویر نیم‌رخ"
            value={profileSide}
            onPick={() => onPick("profileSide")}
            onDelete={() => onDelete("profileSide", profileSide?.url ?? null)}
            disabled={isBusy}
          />
          <GalleryImageSlot
            title="تصویر سه‌رخ"
            value={profileThreeQuarter}
            onPick={() => onPick("profileThreeQuarter")}
            onDelete={() => onDelete("profileThreeQuarter", profileThreeQuarter?.url ?? null)}
            disabled={isBusy}
          />
        </div>

        <div className="flex justify-start">
          <GalleryImageSlot
            title="تصویر قدی"
            value={fullBody}
            onPick={() => onPick("fullBody")}
            onDelete={() => onDelete("fullBody", fullBody?.url ?? null)}
            disabled={isBusy}
          />
        </div>

        <div className="space-y-3">
          <div className="text-[15px] font-normal text-black">تصاویر دیگر</div>

          <div className="grid grid-cols-1 gap-4 justify-items-stretch sm:grid-cols-2 md:grid-cols-3 md:gap-6 md:justify-items-start">
            {otherImages.map((image, index) => (
              <GalleryImageSlot
                key={`other-${index}`}
                value={image}
                onPick={() => onPick(`other-${index}` as GallerySlotId)}
                onDelete={() =>
                  onDelete(`other-${index}` as GallerySlotId, image?.url ?? null)
                }
                disabled={isBusy}
              />
            ))}
          </div>
        </div>

      </div>

      {error ? (
        <div className="mt-6 rounded-[7px] bg-[#FFE6E6] px-4 py-2 text-[12px] text-[#D12424]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onSave}
          disabled={isBusy}
          className="flex h-[44px] w-full max-w-[220px] flex-row-reverse items-center justify-center gap-2 rounded-full bg-[#FF7F19] text-[15px] font-bold text-white md:w-[177px]"
        >
          <span>ذخیره و صفحه بعد</span>
          <img
            src="/images/vecteezy_arrow-small-left_33295051.png"
            alt=""
            className="h-4 w-4"
            loading="lazy"
          />
        </button>
      </div>
    </div>
  );
}

export function PortfolioEditCenterPane({
  initialValues,
  cities,
  provinces,
  onCancel,
  onSaved,
}: PortfolioEditCenterPaneProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("personal");
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const activeVideoIdRef = useRef<string | null>(null);
  const [activeGallerySlot, setActiveGallerySlot] = useState<GallerySlotId | null>(null);

  const initialGallerySlots = resolveGallerySlots(initialValues.gallery ?? []);
  const [videos, setVideos] = useState<VideoEntryState[]>(() => {
    const initialVideos = (
      initialValues as PortfolioEditInitialValues & {
        videos?: Array<{
          mediaId?: string | null;
          url?: string | null;
          title?: string | null;
          recordedMonth?: string | number | null;
          recordedYear?: string | number | null;
        }>;
      }
    ).videos;

    if (!Array.isArray(initialVideos) || initialVideos.length === 0) {
      return [];
    }

    return initialVideos
      .filter((entry) => Boolean(entry?.mediaId || entry?.url))
      .map((entry) => ({
        id: createId(),
        title: entry.title ?? "",
        recordedMonth: entry.recordedMonth ? String(entry.recordedMonth) : "",
        recordedYear: entry.recordedYear ? String(entry.recordedYear) : "",
        mediaId: entry.mediaId ?? undefined,
        url: entry.url ?? undefined,
      }));
  });
  const [voices, setVoices] = useState<VoiceEntryState[]>(() => {
    const initialVoices = initialValues.voices;

    if (!Array.isArray(initialVoices) || initialVoices.length === 0) {
      return [];
    }

    return initialVoices
      .filter((entry) => Boolean(entry?.mediaId && entry?.url))
      .map((entry) => ({
        id: createId(),
        title: entry.title ?? "",
        audio: {
          mediaId: entry.mediaId,
          url: entry.url,
          duration: entry.duration ?? null,
        },
      }));
  });
  const [awards, setAwards] = useState<AwardEntryState[]>(() => {
    const initialAwards = initialValues.awards;

    if (!Array.isArray(initialAwards) || initialAwards.length === 0) {
      return [];
    }

    return initialAwards.map((entry) => ({
      id: createId(),
      awardId: entry.id ?? null,
      title: entry.title ?? "",
      workTitle: entry.workTitle ?? "",
      festivalTitle: entry.place ?? "",
      awardYear: entry.awardDate ? entry.awardDate.trim().slice(0, 4) : "",
    }));
  });
  const [videoUploadPhase, setVideoUploadPhase] = useState<"idle" | "uploading" | "processing">(
    "idle",
  );
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [phone, setPhone] = useState(initialValues.phone ?? "");
  const [bio, setBio] = useState(initialValues.bio);

  const [birthDate, setBirthDate] = useState(() => {
    if (!initialValues.birthDate) {
      return { year: "", month: "", day: "" };
    }
    const [gy, gm, gd] = initialValues.birthDate.split("-").map((value) => Number(value));
    if (!gy || !gm || !gd) {
      return { year: "", month: "", day: "" };
    }
    const jalali = toJalali(gy, gm, gd);
    return {
      year: String(jalali.jy ?? ""),
      month: String(jalali.jm ?? ""),
      day: String(jalali.jd ?? ""),
    };
  });

  const [cityId, setCityId] = useState(initialValues.cityId);
  const [selectedProvinceId, setSelectedProvinceId] = useState(() => {
    const currentCity = cities.find((city) => city.id === initialValues.cityId);
    return currentCity?.provinceId ?? "";
  });

  const [skills, setSkills] = useState<SkillEntryState[]>(() =>
    initialValues.skills.map((skill) => ({ id: createId(), value: skill })),
  );

  const [languages, setLanguages] = useState<LanguageEntryState[]>(() =>
    initialValues.languages.map((language) => ({
      id: createId(),
      label: language.label,
      level: Number.isFinite(language.level) ? language.level : null,
      audio:
        language.mediaId && language.url
          ? {
              mediaId: language.mediaId,
              url: language.url,
              duration: language.duration ?? null,
            }
          : null,
    })),
  );

  const [accents, setAccents] = useState<AccentEntryState[]>(() =>
    initialValues.accents.map((accent) => ({
      id: createId(),
      title: accent.title,
      audio:
        accent.mediaId && accent.url
          ? {
              mediaId: accent.mediaId,
              url: accent.url,
              duration: accent.duration ?? null,
            }
          : null,
    })),
  );

  const [resumeEntries, setResumeEntries] = useState<ResumeEntryState[]>(() =>
    initialValues.resume.map((entry) => ({
      id: createId(),
      ...entry,
    })),
  );

  const [courseEntries, setCourseEntries] = useState<CourseEntryState[]>(() =>
    initialValues.courses.map((entry) => ({
      id: createId(),
      ...entry,
    })),
  );
  const [experienceEntries, setExperienceEntries] = useState<
    Record<ExperienceCategoryKey, ExperienceEntryState[]>
  >(() => ({
    theatre: (initialValues.experienceBase.theatre ?? []).map((entry) => ({
      id: createId(),
      ...entry,
    })),
    shortFilm: (initialValues.experienceBase.shortFilm ?? []).map((entry) => ({
      id: createId(),
      ...entry,
    })),
    tv: (initialValues.experienceBase.tv ?? []).map((entry) => ({
      id: createId(),
      ...entry,
    })),
    cinema: (initialValues.experienceBase.cinema ?? []).map((entry) => ({
      id: createId(),
      ...entry,
    })),
  }));

  const [degreeEntries, setDegreeEntries] = useState<DegreeEntryState[]>(() => {
    const entries = initialValues.degrees.map((entry) => ({
      id: createId(),
      degreeLevel: entry.degreeLevel,
      major: entry.major,
    }));

    return entries.length > 0
      ? entries
      : [{ id: createId(), degreeLevel: "", major: "" }];
  });

  const [headshotFront, setHeadshotFront] = useState<GalleryAsset | null>(
    () => initialGallerySlots.headshotFront ?? null,
  );
  const [profileSide, setProfileSide] = useState<GalleryAsset | null>(
    () => initialGallerySlots.profileSide ?? null,
  );
  const [profileThreeQuarter, setProfileThreeQuarter] = useState<GalleryAsset | null>(
    () => initialGallerySlots.profileThreeQuarter ?? null,
  );
  const [fullBody, setFullBody] = useState<GalleryAsset | null>(
    () => initialGallerySlots.fullBody ?? null,
  );
  const [otherImages, setOtherImages] = useState<Array<GalleryAsset | null>>(() =>
    initialGallerySlots.other.slice(0, MAX_OTHER_IMAGES),
  );

  const isUploading = uploadingCount > 0;
  const isBusy = isPending || isUploading;

  useEffect(() => {
    setFormError(null);
    setGalleryError(null);
  }, [activeTab]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let year = current; year >= 1920; year -= 1) {
      years.push(year);
    }
    return years;
  }, []);

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const birthYearOptions = useMemo(() => {
    const current = getCurrentJalaliYear();
    const years: number[] = [];
    for (let year = current; year >= 1300; year -= 1) {
      years.push(year);
    }
    return years;
  }, []);

  const birthMonthOptions = useMemo(
    () => JALALI_MONTHS.map((label, index) => ({ value: index + 1, label })),
    [],
  );

  const birthDayOptions = useMemo(() => {
    const year = Number(birthDate.year);
    const month = Number(birthDate.month);
    const maxDays =
      year && month ? getJalaliDaysInMonth(year, month) : 31;
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  }, [birthDate.month, birthDate.year]);

  const filteredCities = useMemo(() => {
    if (!selectedProvinceId) {
      return cities;
    }
    return cities.filter((city) => city.provinceId === selectedProvinceId);
  }, [cities, selectedProvinceId]);

  useEffect(() => {
    const year = Number(birthDate.year);
    const month = Number(birthDate.month);
    const day = Number(birthDate.day);
    if (!year || !month || !day) {
      return;
    }
    const maxDays = getJalaliDaysInMonth(year, month);
    if (day > maxDays) {
      setBirthDate((prev) => ({ ...prev, day: "" }));
    }
  }, [birthDate.day, birthDate.month, birthDate.year]);

  const handleAddSkill = () => {
    setSkills((prev) => [...prev, { id: createId(), value: "" }]);
  };

  const handleRemoveSkill = (id: string) => {
    setSkills((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateSkillEntry = (id: string, value: SkillKey | "") => {
    setSkills((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, value } : entry)),
    );
  };

  const handleAddLanguage = () => {
    setLanguages((prev) => [
      ...prev,
      { id: createId(), label: "", level: null, audio: null },
    ]);
  };

  const handleAddAccent = () => {
    setAccents((prev) => [...prev, { id: createId(), title: "", audio: null }]);
  };

  const handleAddResume = () => {
    setResumeEntries((prev) => [
      ...prev,
      { id: createId(), type: "", title: "", position: "", role: "", director: "" },
    ]);
  };

  const handleAddCourse = () => {
    setCourseEntries((prev) => [...prev, { id: createId(), title: "", instructor: "" }]);
  };

  const handleAddExperienceEntry = (category: ExperienceCategoryKey) => {
    setExperienceEntries((prev) => ({
      ...prev,
      [category]: [...prev[category], { id: createId(), role: "", work: "" }],
    }));
  };

  const handleAddDegree = () => {
    setDegreeEntries((prev) => [
      ...prev,
      { id: createId(), degreeLevel: "", major: "" },
    ]);
  };

  const handleAddVoice = () => {
    if (isBusy) {
      return;
    }
    setVoices((prev) => [...prev, { id: createId(), title: "", audio: null }]);
  };

  const handleAddAward = () => {
    if (isBusy) {
      return;
    }
    setAwards((prev) => [
      ...prev,
      {
        id: createId(),
        awardId: null,
        title: "",
        workTitle: "",
        festivalTitle: "",
        awardYear: "",
      },
    ]);
  };

  const handleAddVideo = () => {
    if (isBusy) {
      return;
    }
    setVideos((prev) => [
      ...prev,
      { id: createId(), title: "", recordedMonth: "", recordedYear: "" },
    ]);
  };

  const handlePickVideoFile = (videoId: string) => {
    if (isBusy) {
      return;
    }
    setActiveVideoId(videoId);
    activeVideoIdRef.current = videoId;
    videoInputRef.current?.click();
  };

  const updateResumeEntry = (id: string, patch: Partial<ResumeEntry>) => {
    setResumeEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateCourseEntry = (id: string, patch: Partial<CourseEntry>) => {
    setCourseEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateExperienceEntry = (
    category: ExperienceCategoryKey,
    id: string,
    patch: Partial<ExperienceEntry>,
  ) => {
    setExperienceEntries((prev) => ({
      ...prev,
      [category]: prev[category].map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  };

  const updateDegreeEntry = (id: string, patch: Partial<DegreeEntryState>) => {
    setDegreeEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateLanguageEntry = (id: string, patch: Partial<LanguageEntryState>) => {
    setLanguages((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateAccentEntry = (id: string, patch: Partial<AccentEntryState>) => {
    setAccents((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateVoiceEntry = (id: string, patch: Partial<VoiceEntryState>) => {
    setVoices((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const updateAwardEntry = (id: string, patch: Partial<AwardEntryState>) => {
    setAwards((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const audioRowItems = useMemo(() => {
    const items: AudioRowItem[] = [];
    const seen = new Set<string>();

    const pushItem = (item: AudioRowItem) => {
      if (!item.audio.mediaId || !item.audio.url) {
        return;
      }
      if (seen.has(item.audio.mediaId)) {
        return;
      }
      seen.add(item.audio.mediaId);
      items.push(item);
    };

    voices.forEach((entry) => {
      const audio = entry.audio;
      if (!audio || !audio.mediaId || !audio.url) {
        return;
      }
      pushItem({
        key: `voice-${entry.id}`,
        title: entry.title,
        audio,
        source: "voice",
        sourceId: entry.id,
      });
    });

    languages.forEach((entry) => {
      const audio = entry.audio;
      if (!audio || !audio.mediaId || !audio.url) {
        return;
      }
      pushItem({
        key: `language-${entry.id}`,
        title: entry.label,
        audio,
        source: "language",
        sourceId: entry.id,
      });
    });

    accents.forEach((entry) => {
      const audio = entry.audio;
      if (!audio || !audio.mediaId || !audio.url) {
        return;
      }
      pushItem({
        key: `accent-${entry.id}`,
        title: entry.title,
        audio,
        source: "accent",
        sourceId: entry.id,
      });
    });

    return items;
  }, [accents, languages, voices]);

  const voiceUploadEntries = useMemo(
    () => voices.filter((entry) => !entry.audio?.mediaId || !entry.audio?.url),
    [voices],
  );

  const updateVideoEntry = (id: string, patch: Partial<VideoEntryState>) => {
    setVideos((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const clearGallerySlot = useCallback(
    (slot: GallerySlotId) => {
      if (slot === "headshotFront") {
        setHeadshotFront(null);
        return;
      }
      if (slot === "profileSide") {
        setProfileSide(null);
        return;
      }
      if (slot === "profileThreeQuarter") {
        setProfileThreeQuarter(null);
        return;
      }
      if (slot === "fullBody") {
        setFullBody(null);
        return;
      }
      if (slot.startsWith("other-")) {
        const index = Number(slot.split("-")[1]);
        if (!Number.isNaN(index)) {
          setOtherImages((prev) => {
            const next = [...prev];
            next[index] = null;
            return next.slice(0, MAX_OTHER_IMAGES);
          });
        }
      }
    },
    [setFullBody, setHeadshotFront, setOtherImages, setProfileSide, setProfileThreeQuarter],
  );

  const handlePickGallerySlot = (slot: GallerySlotId) => {
    if (isBusy) {
      return;
    }
    setActiveGallerySlot(slot);
    galleryInputRef.current?.click();
  };

  const handleDeleteGallerySlot = useCallback(
    async (slot: GallerySlotId, url?: string | null) => {
      if (isBusy) {
        return;
      }
      if (!url) {
        clearGallerySlot(slot);
        return;
      }
      setGalleryError(null);
      setUploadingCount((prev) => prev + 1);
      try {
        const formData = new FormData();
        formData.set("url", url);
        const result = await deleteImage(formData);
        if (!result.ok) {
          setGalleryError(result.error ?? "حذف تصویر ناموفق بود.");
          return;
        }
        clearGallerySlot(slot);
      } catch (error) {
        setGalleryError(error instanceof Error ? error.message : "حذف تصویر ناموفق بود.");
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1));
      }
    },
    [clearGallerySlot, isBusy, setGalleryError, setUploadingCount],
  );

  const handleDeleteVoice = (voiceId: string) => {
    if (isBusy) {
      return;
    }
    setVoices((prev) => prev.filter((entry) => entry.id !== voiceId));
    setActiveAudioId((prev) => (prev === `voice-${voiceId}` ? null : prev));
  };

  const handleDeleteAward = (awardId: string) => {
    if (isBusy) {
      return;
    }
    setAwards((prev) => prev.filter((entry) => entry.id !== awardId));
  };

  const handleDeleteAudioRow = (item: AudioRowItem) => {
    if (isBusy) {
      return;
    }
    if (item.source === "voice") {
      handleDeleteVoice(item.sourceId);
      return;
    }
    if (item.source === "language") {
      updateLanguageEntry(item.sourceId, { audio: null });
    } else if (item.source === "accent") {
      updateAccentEntry(item.sourceId, { audio: null });
    }
    setActiveAudioId((prev) => (prev === item.key ? null : prev));
  };

  const handleDeleteVideo = (videoId: string) => {
    if (isBusy) {
      return;
    }
    setVideos((prev) => prev.filter((entry) => entry.id !== videoId));
    if (activeVideoIdRef.current === videoId) {
      activeVideoIdRef.current = null;
      setActiveVideoId(null);
      setVideoUploadPhase("idle");
    }
  };

  const handleGalleryFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !activeGallerySlot) {
        setActiveGallerySlot(null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setGalleryError("لطفاً یک تصویر انتخاب کنید.");
        setActiveGallerySlot(null);
        return;
      }

      setGalleryError(null);
      setUploadingCount((prev) => prev + 1);

      try {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadImage(formData);

        if (!result.ok || !result.url) {
          setGalleryError(result.error ?? "آپلود تصویر ناموفق بود.");
          return;
        }

        const asset: GalleryAsset = { url: result.url };

        if (activeGallerySlot === "headshotFront") {
          setHeadshotFront({ ...asset, slot: "headshotFront" });
        } else if (activeGallerySlot === "profileSide") {
          setProfileSide({ ...asset, slot: "profileSide" });
        } else if (activeGallerySlot === "profileThreeQuarter") {
          setProfileThreeQuarter({ ...asset, slot: "profileThreeQuarter" });
        } else if (activeGallerySlot === "fullBody") {
          setFullBody({ ...asset, slot: "fullBody" });
        } else if (activeGallerySlot.startsWith("other-")) {
          const index = Number(activeGallerySlot.split("-")[1]);
          if (!Number.isNaN(index)) {
            setOtherImages((prev) => {
              const next = [...prev];
              next[index] = { ...asset, slot: "other" };
              return next.slice(0, MAX_OTHER_IMAGES);
            });
          }
        }
      } catch (error) {
        setGalleryError(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود.");
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1));
        setActiveGallerySlot(null);
      }
    },
    [
      activeGallerySlot,
      setActiveGallerySlot,
      setFullBody,
      setGalleryError,
      setHeadshotFront,
      setOtherImages,
      setProfileSide,
      setProfileThreeQuarter,
      setUploadingCount,
    ],
  );

  const handleVideoFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!file.type.startsWith("video/")) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "لطفاً یک فایل ویدئو انتخاب کنید.",
        });
        return;
      }

      if (file.size > VIDEO_MAX_BYTES) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "حجم فایل ویدئو نباید بیشتر از ۴۰ مگابایت باشد.",
        });
        return;
      }

      const duration = await getVideoDuration(file);
      if (duration && duration > VIDEO_MAX_DURATION_SEC) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "مدت ویدئو نباید بیشتر از ۲ دقیقه باشد.",
        });
        return;
      }

      const targetId = activeVideoIdRef.current;
      if (!targetId) {
        return;
      }

      setVideoUploadPhase("uploading");
      setUploadingCount((prev) => prev + 1);

      try {
        const result = await uploadVideoFile(file, duration);
        setVideos((prev) =>
          prev.map((entry) =>
            entry.id === targetId
              ? { ...entry, mediaId: result.mediaId, url: result.url ?? undefined }
              : entry,
          ),
        );
      } catch (error) {
        toast({
          variant: "destructive",
          title: "خطا",
          description:
            error instanceof Error ? error.message : "آپلود ویدئو ناموفق بود.",
        });
      } finally {
        setVideoUploadPhase("idle");
        setUploadingCount((prev) => Math.max(0, prev - 1));
        setActiveVideoId(null);
        activeVideoIdRef.current = null;
      }
    },
    [setActiveVideoId, setUploadingCount, setVideos, setVideoUploadPhase, toast],
  );

  const buildGalleryPayload = useCallback(() => {
    const payload: GalleryAsset[] = [];

    if (headshotFront?.url) {
      payload.push({ url: headshotFront.url, slot: "headshotFront" });
    }
    if (profileSide?.url) {
      payload.push({ url: profileSide.url, slot: "profileSide" });
    }
    if (profileThreeQuarter?.url) {
      payload.push({ url: profileThreeQuarter.url, slot: "profileThreeQuarter" });
    }
    if (fullBody?.url) {
      payload.push({ url: fullBody.url, slot: "fullBody" });
    }

    otherImages
      .filter((entry): entry is GalleryAsset => Boolean(entry?.url))
      .slice(0, MAX_OTHER_IMAGES)
      .forEach((entry) => {
        payload.push({ url: entry.url, slot: "other" });
      });

    return payload;
  }, [fullBody, headshotFront, otherImages, profileSide, profileThreeQuarter]);

  const persistGallery = useCallback(async () => {
    const galleryFormData = new FormData();
    galleryFormData.set("gallery", JSON.stringify(buildGalleryPayload()));
    return updateGallery(galleryFormData);
  }, [buildGalleryPayload]);

  const handleGallerySave = () => {
    setGalleryError(null);
    startTransition(() => {
      (async () => {
        const galleryResult = await persistGallery();
        if (!galleryResult.ok) {
          setGalleryError(galleryResult.error ?? "ذخیره گالری ناموفق بود.");
          return;
        }

        toast({
          title: "اطلاعات ذخیره شد.",
          description: "گالری با موفقیت به‌روزرسانی شد.",
        });
        setActiveTab("videos");
        router.refresh();
      })().catch(() => {
        setGalleryError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      });
    });
  };

  const buildVideosPayload = useCallback(() => {
    const cleaned: { mediaId: string; title?: string; order?: number }[] = [];
    const seen = new Set<string>();

    for (const entry of videos) {
      const mediaId = entry.mediaId?.trim();
      if (!mediaId) {
        continue;
      }
      if (seen.has(mediaId)) {
        return null;
      }
      seen.add(mediaId);

      const title = entry.title.trim();
      cleaned.push({
        mediaId,
        ...(title ? { title } : {}),
        order: cleaned.length + 1,
      });
    }

    return cleaned;
  }, [videos]);

  const buildVoicesPayload = useCallback(() => {
    return voices
      .filter((entry) => entry.audio?.mediaId && entry.audio?.url)
      .map((entry) => ({
        mediaId: entry.audio?.mediaId ?? "",
        url: entry.audio?.url ?? "",
        title: entry.title.trim() ? entry.title.trim() : null,
        duration: entry.audio?.duration ?? null,
      }));
  }, [voices]);

  const buildAwardsPayload = useCallback(() => {
    return awards
      .map((entry) => ({
        id: entry.awardId ?? null,
        title: entry.title.trim(),
        workTitle: entry.workTitle.trim(),
        place: entry.festivalTitle.trim(),
        date: entry.awardYear.trim(),
      }))
      .filter((entry) => entry.title || entry.workTitle || entry.place || entry.date);
  }, [awards]);

  const handleVideosSave = () => {
    setFormError(null);
    const payload = buildVideosPayload();
    if (payload === null) {
      setFormError("هر ویدئو باید یکتا باشد.");
      return;
    }
    const formData = new FormData();
    formData.set("videos", JSON.stringify(payload));

    startTransition(() => {
      (async () => {
        const videosResult = await updateVideos(formData);
        if (!videosResult.ok) {
          setFormError(videosResult.error ?? "ذخیره ویدئوها ناموفق بود.");
          return;
        }

        toast({
          title: "اطلاعات ذخیره شد.",
          description: "ویدئوها با موفقیت به‌روزرسانی شد.",
        });
        setActiveTab("audio");
        router.refresh();
      })().catch(() => {
        setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      });
    });
  };

  const handleVoicesSave = () => {
    setFormError(null);
    const payload = buildVoicesPayload();
    const formData = new FormData();
    formData.set("voices", JSON.stringify(payload));

    startTransition(() => {
      (async () => {
        const voicesResult = await updateVoices(formData);
        if (!voicesResult.ok) {
          setFormError(voicesResult.error ?? "ذخیره فایل‌های صوتی ناموفق بود.");
          return;
        }

        toast({
          title: "اطلاعات ذخیره شد.",
          description: "فایل‌های صوتی با موفقیت به‌روزرسانی شد.",
        });
        setActiveTab("awards");
        router.refresh();
      })().catch(() => {
        setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      });
    });
  };

  const handleAwardsSave = () => {
    setFormError(null);
    const payload = buildAwardsPayload();
    if (payload.some((entry) => !entry.title)) {
      setFormError("عنوان جایزه الزامی است.");
      return;
    }
    const formData = new FormData();
    formData.set("awards", JSON.stringify(payload));

    startTransition(() => {
      (async () => {
        const awardsResult = await updateAwards(formData);
        if (!awardsResult.ok) {
          setFormError(awardsResult.error ?? "ذخیره افتخارات ناموفق بود.");
          return;
        }

        toast({
          title: "اطلاعات ذخیره شد.",
          description: "افتخارات با موفقیت به‌روزرسانی شد.",
        });
        onSaved();
        router.refresh();
      })().catch(() => {
        setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      });
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (activeTab === "gallery") {
      handleGallerySave();
      return;
    }
    if (activeTab === "videos") {
      handleVideosSave();
      return;
    }
    if (activeTab === "audio") {
      handleVoicesSave();
      return;
    }
    if (activeTab === "awards") {
      handleAwardsSave();
      return;
    }

    const cleanedFirstName = firstName.trim();
    const cleanedLastName = lastName.trim();

    if (!cleanedFirstName || !cleanedLastName) {
      setFormError("نام و نام خانوادگی الزامی است.");
      return;
    }

    if (
      (birthDate.year || birthDate.month || birthDate.day) &&
      (!birthDate.year || !birthDate.month || !birthDate.day)
    ) {
      setFormError("لطفاً تاریخ تولد را کامل وارد کنید.");
      return;
    }

    let birthDateString = "";
    if (birthDate.year && birthDate.month && birthDate.day) {
      try {
        const gregorian = toGregorian(
          Number(birthDate.year),
          Number(birthDate.month),
          Number(birthDate.day),
        );
        birthDateString = `${gregorian.gy}-${pad2(String(gregorian.gm))}-${pad2(
          String(gregorian.gd),
        )}`;
      } catch {
        setFormError("تاریخ تولد معتبر نیست.");
        return;
      }
    }

    const languagePayload: Array<LanguageSkill & Partial<AudioAttachment>> = [];
    const seenLanguages = new Set<string>();

    for (const entry of languages) {
      const label = entry.label.trim();
      const level = entry.level ?? null;

      if (!label || !level) {
        continue;
      }

      const key = label.toLowerCase();
      if (seenLanguages.has(key)) {
        setFormError("نام زبان‌ها باید یکتا باشد.");
        return;
      }

      seenLanguages.add(key);
      languagePayload.push({
        label,
        level,
        ...(entry.audio
          ? {
              mediaId: entry.audio.mediaId,
              url: entry.audio.url,
              duration: entry.audio.duration ?? null,
            }
          : {}),
      });
    }

    const accentPayload: AccentEntry[] = [];
    const seenAccents = new Set<string>();

    for (const entry of accents) {
      const title = entry.title.trim();
      if (!title) {
        continue;
      }

      const key = title.toLowerCase();
      if (seenAccents.has(key)) {
        setFormError("نام لهجه‌ها باید یکتا باشد.");
        return;
      }

      seenAccents.add(key);
      accentPayload.push({
        title,
        ...(entry.audio
          ? {
              mediaId: entry.audio.mediaId,
              url: entry.audio.url,
              duration: entry.audio.duration ?? null,
            }
          : {}),
      });
    }

    const cleanedSkills: SkillKey[] = [];
    const seenSkills = new Set<SkillKey>();

    for (const entry of skills) {
      if (!entry.value) {
        continue;
      }

      if (seenSkills.has(entry.value)) {
        setFormError("نام مهارت‌ها باید یکتا باشد.");
        return;
      }

      seenSkills.add(entry.value);
      cleanedSkills.push(entry.value);
    }

    const cleanedResume: ResumeEntry[] = resumeEntries
      .map((entry) => ({
        type: entry.type.trim(),
        title: entry.title.trim(),
        position: entry.position.trim(),
        role: entry.role.trim(),
        director: entry.director.trim(),
      }))
      .filter((entry) => Object.values(entry).some((value) => value));

    const cleanedCourses: CourseEntry[] = courseEntries
      .map((entry) => ({
        title: entry.title.trim(),
        instructor: entry.instructor.trim(),
      }))
      .filter((entry) => entry.title || entry.instructor);

    const cleanedExperienceBase = EXPERIENCE_SECTION_CONFIG.reduce<ExperienceData>(
      (accumulator, section) => {
        accumulator[section.key] = experienceEntries[section.key]
          .map((entry) => ({
            role: entry.role.trim(),
            work: entry.work.trim(),
          }))
          .filter((entry) => entry.role || entry.work);
        return accumulator;
      },
      {},
    );

    const hasPartialExperience = EXPERIENCE_SECTION_CONFIG.some((section) =>
      (cleanedExperienceBase[section.key] ?? []).some(
        (entry) => !entry.role || !entry.work,
      ),
    );

    if (hasPartialExperience) {
      setFormError("لطفاً نقش و نام اثر را برای همه موارد وارد کنید.");
      return;
    }

    const cleanedDegrees = degreeEntries
      .map((entry) => ({
        degreeLevel: entry.degreeLevel.trim(),
        major: entry.major.trim(),
      }))
      .filter((entry) => entry.degreeLevel || entry.major);

    const experiencePayload: ExperienceData & {
      resume: ResumeEntry[];
      courses: CourseEntry[];
    } = {
      ...cleanedExperienceBase,
      resume: cleanedResume,
      courses: cleanedCourses,
    };

    const personalFormData = new FormData();
    personalFormData.set("partial", "1");
    personalFormData.set("firstName", cleanedFirstName);
    personalFormData.set("lastName", cleanedLastName);
    personalFormData.set("cityId", cityId ?? "");
    personalFormData.set("bio", bio.trim());
    personalFormData.set("birthDate", birthDateString);

    const skillsFormData = new FormData();
    for (const skill of cleanedSkills) {
      skillsFormData.append("skills", skill);
    }

    const languagesFormData = new FormData();
    languagesFormData.set("languages", JSON.stringify(languagePayload));

    const accentsFormData = new FormData();
    accentsFormData.set("accents", JSON.stringify(accentPayload));

    const degreesFormData = new FormData();
    degreesFormData.set("degrees", JSON.stringify(cleanedDegrees));

    const experienceFormData = new FormData();
    experienceFormData.set("experience", JSON.stringify(experiencePayload));

    startTransition(() => {
      (async () => {
        const personalResult = await upsertPersonalInfo(personalFormData);
        if (!personalResult.ok) {
          const fieldMessage = personalResult.fieldErrors
            ? Object.values(personalResult.fieldErrors).find(Boolean)
            : null;
          setFormError(
            personalResult.error ?? fieldMessage ?? "ذخیره اطلاعات شخصی ناموفق بود.",
          );
          return;
        }

        const skillsResult = await updateSkills(skillsFormData);
        if (!skillsResult.ok) {
          setFormError(skillsResult.error ?? "ذخیره مهارت‌ها ناموفق بود.");
          return;
        }

        const degreesResult = await updateDegrees(degreesFormData);
        if (!degreesResult.ok) {
          setFormError(degreesResult.error ?? "ذخیره تحصیلات ناموفق بود.");
          return;
        }

        const languagesResult = await updateLanguages(languagesFormData);
        if (!languagesResult.ok) {
          setFormError(languagesResult.error ?? "ذخیره زبان‌ها ناموفق بود.");
          return;
        }

        const accentsResult = await updateAccents(accentsFormData);
        if (!accentsResult.ok) {
          setFormError(accentsResult.error ?? "ذخیره لهجه‌ها ناموفق بود.");
          return;
        }

        const experienceResult = await updateExperience(experienceFormData);
        if (!experienceResult.ok) {
          setFormError(experienceResult.error ?? "ذخیره رزومه ناموفق بود.");
          return;
        }

        const galleryResult = await persistGallery();
        if (!galleryResult.ok) {
          setFormError(galleryResult.error ?? "ذخیره گالری ناموفق بود.");
          return;
        }

        toast({
          title: "اطلاعات ذخیره شد.",
          description: "پورتفولیو با موفقیت به‌روزرسانی شد.",
        });
        onSaved();
        router.refresh();
      })().catch(() => {
        setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      });
    });
  };

  const inputClass =
    "h-[34px] w-full rounded-full bg-[#EFEFEF] px-4 text-[12px] text-[#6B6B6B] placeholder:text-[#B5B5B5] focus:outline-none";
  const selectClass = `${inputClass} appearance-none`;
  const sectionTitleClass = "text-[14px] font-semibold text-[#000000]";
  const hasAudioRows = audioRowItems.length > 0;
  const hasAwards = awards.length > 0;
  const canAddVoice = !isBusy;

  return (
    <section
      aria-label="فرم ویرایش پورتفولیو"
      className={`fixed left-0 right-0 bottom-0 top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] z-40 w-screen overflow-x-hidden overflow-y-auto bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)] md:absolute md:left-[273px] md:right-auto md:top-[315px] md:h-[804px] ${
        activeTab === "gallery" ? "md:w-[797px]" : "md:w-[797px]"
      } md:overflow-hidden md:rounded-[20px]`}
      style={{ "--edit-profile-bottom-nav-h": `${EDIT_PROFILE_MOBILE_BOTTOM_NAV_H}px` } as CSSProperties & {
        "--edit-profile-bottom-nav-h": string;
      }}
      dir="rtl"
    >
      <form
        className="w-full min-w-0 pb-[calc(var(--edit-profile-bottom-nav-h)+env(safe-area-inset-bottom))] md:h-full md:overflow-y-auto md:pb-10"
        data-header-scroll
        onSubmit={handleSubmit}
      >
        <div className="px-4 pt-4 md:px-[32px] md:pt-[22px]">
          <div className="flex items-center justify-between">
            <div className="text-[24px] font-black text-black md:text-[28px]">اطلاعات من</div>
          </div>
        </div>

        <EditProfileTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="px-4 md:px-[32px]">
          <div className="mt-4 mx-auto w-full max-w-[568px] rounded-[7px] bg-[#FF7F19]/20 px-4 py-3 text-right text-[12px] leading-6 text-[#FF7F19] md:w-[568px]">
            {NOTE_TEXT}
          </div>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleGalleryFileChange}
          disabled={isBusy}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoFileChange}
          disabled={isBusy}
        />

        {activeTab === "personal" ? (
        <div className="space-y-8 px-4 pb-8 pt-4 text-[12px] text-[#5C5A5A] md:px-[82px] md:pt-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className={sectionTitleClass}>نام و نام خانوادگی</label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="نام"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={isBusy}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="نام خانوادگی"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={isBusy}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={sectionTitleClass}>شماره تماس</label>
              <input
                className={inputClass}
                placeholder="شماره تماس"
                value={phone}
                onChange={(event) => {
                  const nextValue = normalizeDigits(event.target.value)
                    .replace(/\D/g, "")
                    .slice(0, 11);

                  if (
                    (nextValue.length >= 1 && nextValue[0] !== "0") ||
                    (nextValue.length >= 2 && !nextValue.startsWith("09"))
                  ) {
                    return;
                  }

                  setPhone(nextValue);
                }}
                dir="ltr"
                inputMode="numeric"
                maxLength={11}
                pattern="09[0-9]{9}"
              />
            </div>

            <div className="space-y-2">
              <label className={sectionTitleClass}>محل سکونت</label>
              <div className="grid grid-cols-1 justify-items-start gap-4 sm:grid-cols-2">
                <div className="relative w-full">
                  <img
                    src="/images/flash-down.png"
                    alt=""
                    className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                  />
                  <select
                    className={`${selectClass} pl-8 w-full`}
                    value={selectedProvinceId}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSelectedProvinceId(nextValue);
                      if (!nextValue) return;

                      const isCityInProvince = cities.some(
                        (city) => city.id === cityId && city.provinceId === nextValue,
                      );
                      if (!isCityInProvince) setCityId("");
                    }}
                    disabled={isBusy}
                  >
                    <option value="">استان</option>
                    {provinces.map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full">
                  <img
                    src="/images/flash-down.png"
                    alt=""
                    className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                  />
                  <select
                    className={`${selectClass} pl-8 w-full`}
                    value={cityId}
                    onChange={(event) => setCityId(event.target.value)}
                    disabled={isBusy}
                  >
                    <option value="">شهر</option>
                    {filteredCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={sectionTitleClass}>تاریخ تولد</label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="relative">
                  <img
                    src="/images/flash-down.png"
                    alt=""
                    className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                  />
                  <select
                    className={`${selectClass} pl-8`}
                    value={birthDate.day}
                    onChange={(event) => {
                      setBirthDate((prev) => ({ ...prev, day: event.target.value }));
                      setFormError(null);
                    }}
                    disabled={isBusy}
                  >
                    <option value="">روز</option>
                    {birthDayOptions.map((day) => (
                      <option key={day} value={String(day)}>
                        {formatPersianNumber(day)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <img
                    src="/images/flash-down.png"
                    alt=""
                    className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                  />
                  <select
                    className={`${selectClass} pl-8`}
                    value={birthDate.month}
                    onChange={(event) => {
                      setBirthDate((prev) => ({ ...prev, month: event.target.value }));
                      setFormError(null);
                    }}
                    disabled={isBusy}
                  >
                    <option value="">ماه</option>
                    {birthMonthOptions.map((month) => (
                      <option key={month.value} value={String(month.value)}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <img
                    src="/images/flash-down.png"
                    alt=""
                    className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                  />
                  <select
                    className={`${selectClass} pl-8`}
                    value={birthDate.year}
                    onChange={(event) => {
                      setBirthDate((prev) => ({ ...prev, year: event.target.value }));
                      setFormError(null);
                    }}
                    disabled={isBusy}
                  >
                    <option value="">سال</option>
                    {birthYearOptions.map((year) => (
                      <option key={year} value={String(year)}>
                        {formatPersianNumber(year)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className={sectionTitleClass}>رشته تحصیلی</label>
              <div className="space-y-[39px]">
                {degreeEntries.map((entry) => (
                  <input
                    key={entry.id}
                    className={inputClass}
                    placeholder="رشته تحصیلی"
                    value={entry.major}
                    onChange={(event) =>
                      updateDegreeEntry(entry.id, { major: event.target.value })
                    }
                    disabled={isBusy}
                    maxLength={100}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className={sectionTitleClass}>مدرک تحصیلی مرتبط</label>
              <div className="space-y-3">
                {degreeEntries.map((entry) => {
                  const options = entry.degreeLevel &&
                    !DEGREE_LEVEL_OPTIONS.includes(entry.degreeLevel)
                    ? [entry.degreeLevel, ...DEGREE_LEVEL_OPTIONS]
                    : DEGREE_LEVEL_OPTIONS;

                  return (
                    <div key={entry.id} className="space-y-2">
                      <div className="relative">
                        <img
                          src="/images/flash-down.png"
                          alt=""
                          className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                        />
                        <select
                          className={`${selectClass} pl-8`}
                          value={entry.degreeLevel}
                          onChange={(event) =>
                            updateDegreeEntry(entry.id, { degreeLevel: event.target.value })
                          }
                          disabled={isBusy}
                        >
                          <option value="">مدرک تحصیلی</option>
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDegreeEntries((prev) =>
                            prev.filter((item) => item.id !== entry.id),
                          )
                        }
                        className="text-right text-[12px] text-[#D56732]"
                        disabled={isBusy}
                      >
                        حذف ردیف
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 md:-mt-[28px]">
              <button
                type="button"
                onClick={handleAddDegree}
                disabled={isBusy}
                className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[22px] text-[#B5B5B5]"
              >
                +
              </button>
            </div>

            <div className="space-y-3">
              <label className={sectionTitleClass}>مهارت‌ها</label>
              {skills.length === 0 ? (
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={isBusy}
                  className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5]"
                >
                  +
                </button>
              ) : (
                <div className="space-y-3">
                  {skills.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <img
                          src="/images/flash-down.png"
                          alt=""
                          className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2"
                        />
                        <select
                          className={`${selectClass} w-full pl-8`}
                          value={entry.value}
                          onChange={(event) =>
                            updateSkillEntry(entry.id, event.target.value as SkillKey | "")
                          }
                          disabled={isBusy}
                        >
                          <option value="">عنوان</option>
                          {SKILLS.map((skill) => (
                            <option key={skill.key} value={skill.key}>
                              {skill.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(entry.id)}
                        disabled={isBusy}
                        className="text-[12px] text-[#D56732]"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    disabled={isBusy}
                    className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5]"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div aria-hidden="true" />
          </div>


          <div className="space-y-3">
            <label className={sectionTitleClass}>زبان</label>
            <div className="space-y-4">
              {languages.map((entry) => (
              <div
                key={entry.id}
                className="ml-0 rounded-[16px] border border-[#E3E3E3] bg-white px-4 py-3 md:ml-8"
              >

                  <div className="flex items-center justify-between gap-4">
                    {/* Right side: Title + Level */}
                    <div className="flex items-center gap-6">
                      {/* Title */}
                      <input
                        className={`${inputClass} w-full md:w-[360px]`}
                        placeholder="عنوان"
                        value={entry.label}
                        onChange={(event) =>
                          updateLanguageEntry(entry.id, { label: event.target.value })
                        }
                        disabled={isBusy}
                      />

                      {/* Level */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] w-[60px] text-[#7A7A7A]">میزان تسلط</span>
                        <LevelDots
                          value={entry.level}
                          onChange={(level) => updateLanguageEntry(entry.id, { level })}
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    {/* Left side: Delete */}
                    <button
                      type="button"
                      onClick={() =>
                        setLanguages((prev) => prev.filter((item) => item.id !== entry.id))
                      }
                      className="text-[12px] text-[#D56732]"
                      disabled={isBusy}
                    >
                      حذف
                    </button>
                  </div>

                  <div className="mt-3">
                    <AudioUploadField
                      value={entry.audio}
                      onChange={(audio) => updateLanguageEntry(entry.id, { audio })}
                      onUploadStart={() => setUploadingCount((prev) => prev + 1)}
                      onUploadEnd={() =>
                        setUploadingCount((prev) => (prev > 0 ? prev - 1 : 0))
                      }
                      onError={(message) => setFormError(message)}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddLanguage}
              disabled={isBusy}
              className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5] md:w-[600px]"
            >
              +
            </button>
          </div>

          <div className="space-y-3">
            <label className={sectionTitleClass}>لهجه</label>
            <div className="space-y-4">
              {accents.map((entry) => (
                <div
                  key={entry.id}
                  className="ml-0 rounded-[16px] border border-[#E3E3E3] bg-white px-4 py-3 md:ml-8"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <input
                      className={`${inputClass} w-full md:w-[360px]`}
                      placeholder="عنوان"
                      value={entry.title}
                      onChange={(event) =>
                        updateAccentEntry(entry.id, { title: event.target.value })
                      }
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAccents((prev) => prev.filter((item) => item.id !== entry.id))
                      }
                      className="text-[12px] text-[#D56732]"
                      disabled={isBusy}
                    >
                      حذف
                    </button>
                  </div>
                  <div className="mt-3">
                    <AudioUploadField
                      value={entry.audio}
                      onChange={(audio) => updateAccentEntry(entry.id, { audio })}
                      onUploadStart={() => setUploadingCount((prev) => prev + 1)}
                      onUploadEnd={() =>
                        setUploadingCount((prev) => (prev > 0 ? prev - 1 : 0))
                      }
                      onError={(message) => setFormError(message)}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddAccent}
              disabled={isBusy}
              className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5] md:w-[600px]"
            >
              +
            </button>
          </div>

          <div className="space-y-3">
            <label className={sectionTitleClass}>درباره من</label>
            <textarea
              className="h-[140px] w-full rounded-[16px] bg-[#EFEFEF] px-4 py-3 text-[12px] text-[#6B6B6B] placeholder:text-[#B5B5B5] focus:outline-none"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              disabled={isBusy}
              placeholder="متن درباره من"
            />
          </div>

          <div className="space-y-3">
            <label className={sectionTitleClass}>رزومه</label>
            <div className="space-y-4 rounded-[18px] border border-[#E3E3E3] bg-white p-4">
              {resumeEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="نوع اثر نمایشی"
                    value={entry.type}
                    onChange={(event) => updateResumeEntry(entry.id, { type: event.target.value })}
                    disabled={isBusy}
                  />
                  <input
                    className={inputClass}
                    placeholder="عنوان اثر"
                    value={entry.title}
                    onChange={(event) => updateResumeEntry(entry.id, { title: event.target.value })}
                    disabled={isBusy}
                  />
                  <input
                    className={inputClass}
                    placeholder="پوزیشن کاری"
                    value={entry.position}
                    onChange={(event) =>
                      updateResumeEntry(entry.id, { position: event.target.value })
                    }
                    disabled={isBusy}
                  />
                  <input
                    className={inputClass}
                    placeholder="عنوان نقش"
                    value={entry.role}
                    onChange={(event) => updateResumeEntry(entry.id, { role: event.target.value })}
                    disabled={isBusy}
                  />
                  <input
                    className={inputClass}
                    placeholder="نام کارگردان"
                    value={entry.director}
                    onChange={(event) =>
                      updateResumeEntry(entry.id, { director: event.target.value })
                    }
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setResumeEntries((prev) => prev.filter((item) => item.id !== entry.id))
                    }
                    className="text-right text-[12px] text-[#D56732]"
                    disabled={isBusy}
                  >
                    حذف ردیف
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddResume}
                disabled={isBusy}
                className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5]"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className={sectionTitleClass}>دوره‌های گذرانده شده</label>
            <div className="space-y-4">
              {courseEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="عنوان دوره"
                    value={entry.title}
                    onChange={(event) => updateCourseEntry(entry.id, { title: event.target.value })}
                    disabled={isBusy}
                  />
                  <input
                    className={inputClass}
                    placeholder="نام استاد/آموزگار"
                    value={entry.instructor}
                    onChange={(event) =>
                      updateCourseEntry(entry.id, { instructor: event.target.value })
                    }
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCourseEntries((prev) => prev.filter((item) => item.id !== entry.id))
                    }
                    className="text-right text-[12px] text-[#D56732]"
                    disabled={isBusy}
                  >
                    حذف ردیف
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddCourse}
                disabled={isBusy}
                className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5]"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className={sectionTitleClass}>کارهایی که انجام دادم</label>
            <div className="grid gap-4 md:grid-cols-2">
              {EXPERIENCE_SECTION_CONFIG.map((section) => (
                <div
                  key={section.key}
                  className="space-y-4 rounded-[18px] border border-[#E3E3E3] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-semibold text-[#000000]">
                      {section.label}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddExperienceEntry(section.key)}
                      disabled={isBusy}
                      className="text-[12px] text-[#F58A1F]"
                    >
                      افزودن مورد
                    </button>
                  </div>

                  {experienceEntries[section.key].length === 0 ? (
                    <p className="text-[12px] text-[#A0A0A0]">
                      هنوز موردی برای این بخش ثبت نشده است.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {experienceEntries[section.key].map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-[16px] bg-[#FAFAFA] px-3 py-3"
                        >
                          <div className="grid gap-3">
                            <input
                              className={inputClass}
                              placeholder="نقش"
                              value={entry.role}
                              onChange={(event) =>
                                updateExperienceEntry(section.key, entry.id, {
                                  role: event.target.value,
                                })
                              }
                              disabled={isBusy}
                              maxLength={191}
                            />
                            <input
                              className={inputClass}
                              placeholder="نام اثر"
                              value={entry.work}
                              onChange={(event) =>
                                updateExperienceEntry(section.key, entry.id, {
                                  work: event.target.value,
                                })
                              }
                              disabled={isBusy}
                              maxLength={191}
                            />
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setExperienceEntries((prev) => ({
                                  ...prev,
                                  [section.key]: prev[section.key].filter(
                                    (item) => item.id !== entry.id,
                                  ),
                                }))
                              }
                              disabled={isBusy}
                              className="text-[12px] text-[#D56732]"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAddExperienceEntry(section.key)}
                    disabled={isBusy}
                    className="flex h-[34px] w-full items-center justify-center rounded-full border border-dashed border-[#D1D1D1] text-[16px] text-[#B5B5B5]"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>

          {formError ? (
            <div className="rounded-[10px] bg-[#FFE6E6] px-4 py-2 text-[12px] text-[#D12424]">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="h-[38px] w-full max-w-[200px] rounded-full border border-[#C9C9C9] text-[12px] text-[#6B6B6B] sm:w-[140px]"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex h-[38px] w-full max-w-[240px] items-center justify-center gap-2 rounded-full text-[12px] font-semibold text-[#F58A1F] sm:w-[180px]"
            >
              <span>{isBusy ? "در حال ذخیره..." : "ذخیره و صفحه بعد"}</span>
              {!isBusy && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M19 12H5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 5L5 12L12 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

            </button>
          </div>
        </div>
        ) : null}

        {activeTab === "gallery" ? (
          <EditProfileGalleryPane
            headshotFront={headshotFront}
            profileSide={profileSide}
            profileThreeQuarter={profileThreeQuarter}
            fullBody={fullBody}
            otherImages={[
              otherImages[0] ?? null,
              otherImages[1] ?? null,
              otherImages[2] ?? null,
            ]}
            isBusy={isBusy}
            error={galleryError}
            onPick={handlePickGallerySlot}
            onDelete={handleDeleteGallerySlot}
            onSave={handleGallerySave}
          />
        ) : null}

        {activeTab === "videos" ? (
          <div className="px-4 pb-10 pt-4 text-[12px] text-[#5C5A5A] md:px-[82px] md:pt-6">
            <div className="mx-auto w-full max-w-[568px] space-y-4 md:w-[568px]">
              {videos.length === 0 ? (
                <AddVideoBar onClick={handleAddVideo} disabled={isBusy} />
              ) : (
                <>
                  {videos.map((entry) => (
                    <VideoUploadCard
                      key={entry.id}
                      value={entry}
                      monthOptions={monthOptions}
                      yearOptions={yearOptions}
                      uploadPhase={
                        activeVideoId === entry.id ? videoUploadPhase : "idle"
                      }
                      onPickFile={() => handlePickVideoFile(entry.id)}
                      onRemove={() => handleDeleteVideo(entry.id)}
                      onChangeTitle={(title) => updateVideoEntry(entry.id, { title })}
                      onChangeMonth={(recordedMonth) =>
                        updateVideoEntry(entry.id, { recordedMonth })
                      }
                      onChangeYear={(recordedYear) =>
                        updateVideoEntry(entry.id, { recordedYear })
                      }
                      disabled={isBusy}
                    />
                  ))}
                  <AddVideoBar onClick={handleAddVideo} disabled={isBusy} />
                </>
              )}
            </div>

            {formError ? (
              <div className="mt-6 rounded-[7px] bg-[#FFE6E6] px-4 py-2 text-[12px] text-[#D12424]">
                {formError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleVideosSave}
                disabled={isBusy}
                className="flex h-[44px] w-full max-w-[220px] flex-row-reverse items-center justify-center gap-2 rounded-full bg-[#FF7F19] text-[15px] font-bold text-white md:w-[177px]"
              >
                <span>ذخیره و صفحه بعد</span>
                <img
                  src="/images/vecteezy_arrow-small-left_33295051.png"
                  alt=""
                  className="h-4 w-4"
                  loading="lazy"
                />
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "audio" ? (
          <div className="px-4 pb-10 pt-4 text-[12px] text-[#5C5A5A] md:px-[82px] md:pt-6">
            <div className="mx-auto w-full max-w-[568px] space-y-4 md:w-[568px]">
              {!hasAudioRows && voiceUploadEntries.length === 0 ? (
                <AddAudioBar onClick={handleAddVoice} disabled={!canAddVoice} />
              ) : (
                <>
                  {audioRowItems.map((item) => (
                    <AudioRow
                      key={item.key}
                      entry={{ title: item.title, audio: item.audio }}
                      isActive={activeAudioId === item.key}
                      onDelete={() => handleDeleteAudioRow(item)}
                      onPlayStateChange={(isPlaying) =>
                        setActiveAudioId((prev) =>
                          isPlaying ? item.key : prev === item.key ? null : prev,
                        )
                      }
                    />
                  ))}
                  {voiceUploadEntries.map((entry) => (
                    <AudioUploadCard
                      key={entry.id}
                      entry={entry}
                      inputClass={inputClass}
                      sectionTitleClass={sectionTitleClass}
                      onChangeTitle={(title) => updateVoiceEntry(entry.id, { title })}
                      onChangeAudio={(audio) => updateVoiceEntry(entry.id, { audio })}
                      onCancel={() => handleDeleteVoice(entry.id)}
                      onUploadStart={() => setUploadingCount((prev) => prev + 1)}
                      onUploadEnd={() =>
                        setUploadingCount((prev) => (prev > 0 ? prev - 1 : 0))
                      }
                      onError={(message) => setFormError(message)}
                      disabled={isBusy}
                    />
                  ))}
                  {canAddVoice ? (
                    <AddAudioBar onClick={handleAddVoice} disabled={!canAddVoice} />
                  ) : null}
                </>
              )}
            </div>

            {formError ? (
              <div className="mt-6 rounded-[7px] bg-[#FFE6E6] px-4 py-2 text-[12px] text-[#D12424]">
                {formError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleVoicesSave}
                disabled={isBusy}
                className="flex h-[44px] w-full max-w-[220px] flex-row-reverse items-center justify-center gap-2 rounded-full bg-[#FF7F19] text-[15px] font-bold text-white md:w-[177px]"
              >
                <span>ذخیره و صفحه بعد</span>
                <img
                  src="/images/vecteezy_arrow-small-left_33295051.png"
                  alt=""
                  className="h-4 w-4"
                  loading="lazy"
                />
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "awards" ? (
          <div className="px-4 pb-10 pt-4 text-[12px] text-[#5C5A5A] md:px-[82px] md:pt-6">
            <div className="mx-auto w-full max-w-[568px] space-y-4 md:w-[568px]">
              {!hasAwards ? (
                <AddAwardBar onClick={handleAddAward} disabled={isBusy} />
              ) : (
                <>
                  {awards.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[16px] border border-[#E3E3E3] bg-white px-4 py-4"
                    >
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteAward(entry.id)}
                          disabled={isBusy}
                          className="text-[12px] text-[#D56732]"
                        >
                          حذف
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <input
                          className={inputClass}
                          placeholder="عنوان جایزه"
                          value={entry.title}
                          onChange={(event) =>
                            updateAwardEntry(entry.id, { title: event.target.value })
                          }
                          disabled={isBusy}
                          maxLength={200}
                        />
                        <input
                          className={inputClass}
                          placeholder="عنوان اثر"
                          value={entry.workTitle}
                          onChange={(event) =>
                            updateAwardEntry(entry.id, { workTitle: event.target.value })
                          }
                          disabled={isBusy}
                          maxLength={200}
                        />
                        <input
                          className={inputClass}
                          placeholder="عنوان جشنواره، مسابقه یا ..."
                          value={entry.festivalTitle}
                          onChange={(event) =>
                            updateAwardEntry(entry.id, {
                              festivalTitle: event.target.value,
                            })
                          }
                          disabled={isBusy}
                          maxLength={200}
                        />
                        <input
                          className={inputClass}
                          placeholder="سال اخذ جایزه"
                          value={entry.awardYear}
                          onChange={(event) =>
                            updateAwardEntry(entry.id, { awardYear: event.target.value })
                          }
                          disabled={isBusy}
                          inputMode="numeric"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  ))}
                  <AddAwardBar onClick={handleAddAward} disabled={isBusy} />
                </>
              )}
            </div>

            {formError ? (
              <div className="mt-6 rounded-[7px] bg-[#FFE6E6] px-4 py-2 text-[12px] text-[#D12424]">
                {formError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleAwardsSave}
                disabled={isBusy}
                className="flex h-[44px] w-full max-w-[240px] flex-row-reverse items-center justify-center gap-2 rounded-full bg-[#FF7F19] text-[15px] font-bold text-white md:w-[200px]"
              >
                <span>ذخیره نهایی اطلاعات</span>
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
