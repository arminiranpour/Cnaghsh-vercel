"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AUDIO_ACCEPT } from "@/lib/media/formats";
import type { UploadErrorResponse, UploadInitResponse } from "@/lib/media/types";

import { updateVoices } from "@/lib/profile/profile-actions";

type VoiceEntry = {
  mediaId: string;
  url: string;
  title?: string | null;
  duration?: number | null;
};

type VoicesFormProps = {
  initialVoices: VoiceEntry[];
};

const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000;

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

export function VoicesForm({ initialVoices }: VoicesFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [voices, setVoices] = useState<VoiceEntry[]>(() =>
    (initialVoices ?? []).map((voice) => ({
      ...voice,
      url: toAbsolutePlaybackUrl(voice.url),
    })),
  );
  const [isPending, startTransition] = useTransition();
  const [isUploadBusy, setIsUploadBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState<number>(Date.now());

  const isBusy = isPending || isUploadBusy;

  const normalizedVoices = useMemo(
    () => voices.filter((voice) => voice.mediaId && voice.url),
    [voices],
  );

  const handleTitleChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setVoices((prev) =>
        prev.map((entry, idx) =>
          idx === index ? { ...entry, title: value } : entry,
        ),
      );
      setFormError(null);
    };

  const removeVoice = (index: number) => {
    setVoices((prev) => prev.filter((_, idx) => idx !== index));
    setFormError(null);
  };

  const pollUntilReady = useCallback(async (statusUrl: string) => {
    while (true) {
      const response = await fetch(statusUrl, { cache: "no-store" });
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
          duration:
            typeof payload.durationSec === "number"
              ? payload.durationSec
              : null,
        };
      }

      if (payload.status === "failed") {
        throw new Error(
          payload.errorMessage || "پردازش فایل صوتی ناموفق بود.",
        );
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }, []);

  const getAudioPlaybackUrl = (mediaId: string) => {
    return toAbsolutePlaybackUrl(`/api/media/${mediaId}/file`);
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setUploadInputKey(Date.now());
      event.target.value = "";

      if (!file) return;

      if (!file.type.startsWith("audio/")) {
        setFormError("لطفاً یک فایل صوتی انتخاب کنید.");
        return;
      }

      if (file.size > AUDIO_MAX_BYTES) {
        setFormError("حجم فایل صوتی نباید بیشتر از ۱۰ مگابایت باشد.");
        return;
      }

      setIsUploadBusy(true);
      setFormError(null);

      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("contentType", file.type || "audio/mpeg");

        const initResponse = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        const initPayload = (await initResponse.json()) as
          | UploadInitResponse
          | UploadErrorResponse;

        if (!initResponse.ok || !("ok" in initPayload) || !initPayload.ok) {
          const message =
            (initPayload as UploadErrorResponse)?.messageFa ??
            "خطا در شروع آپلود فایل صوتی.";
          throw new Error(message);
        }

        const mediaId = initPayload.mediaId;
        const checkStatusUrl =
          initPayload.next?.checkStatusUrl ??
          `/api/media/${mediaId}/status`;

        if (!mediaId) {
          throw new Error("اطلاعات آپلود ناقص است.");
        }

        const { duration } = await pollUntilReady(checkStatusUrl);

        // FIXED — no manifest; direct file URL
        const url = getAudioPlaybackUrl(mediaId);

        setVoices((prev) => {
          if (prev.some((e) => e.mediaId === mediaId)) return prev;
          return [
            ...prev,
            {
              mediaId,
              url,
              title: "",
              duration: typeof duration === "number" ? duration : null,
            },
          ];
        });

        toast({
          title: "فایل صوتی اضافه شد.",
          description:
            "پس از ذخیره تغییرات، در پروفایل نمایش داده می‌شود.",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "آپلود فایل صوتی با مشکل مواجه شد.";
        setFormError(message);
      } finally {
        setIsUploadBusy(false);
      }
    },
    [pollUntilReady, toast],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = normalizedVoices.map((v) => ({
      mediaId: v.mediaId.trim(),
      url: v.url.trim(),
      title: v.title?.trim() || "",
      duration: typeof v.duration === "number" ? v.duration : null,
    }));

    const formData = new FormData();
    formData.set("voices", JSON.stringify(payload));

    startTransition(() => {
      updateVoices(formData)
        .then((result) => {
          if (result.ok) {
            setFormError(null);
            toast({
              title: "فایل‌های صوتی ذخیره شد.",
              description: "لیست فایل‌های صوتی با موفقیت به‌روزرسانی شد.",
            });
            router.refresh();
          } else {
            setFormError(
              result.error ?? "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
            );
          }
        })
        .catch(() => {
          setFormError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        });
    });
  };

  return (
    <form className="space-y-6" dir="rtl" onSubmit={handleSubmit}>
      <div className="space-y-4">
        {normalizedVoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            فایل صوتی ثبت نشده است.
          </p>
        ) : (
          normalizedVoices.map((voice, index) => {
            const titleId = `voice-title-${voice.mediaId}-${index}`;
            return (
              <div
                key={`${voice.mediaId}-${index}`}
                className="grid gap-4 rounded-md border border-border p-4 shadow-sm lg:grid-cols-[1fr,240px,auto]"
              >
                <div className="space-y-2">
                  <Label>پخش فایل</Label>
                  <audio controls src={voice.url} className="w-full">
                    مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
                  </audio>
                  {voice.duration ? (
                    <p className="text-xs text-muted-foreground">
                      مدت زمان تقریبی: {Math.round(voice.duration)} ثانیه
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={titleId}>عنوان (اختیاری)</Label>
                  <Input
                    id={titleId}
                    value={voice.title ?? ""}
                    onChange={handleTitleChange(index)}
                    maxLength={200}
                    placeholder="مثلاً نمونه صدای ترکی"
                    disabled={isBusy}
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVoice(index)}
                    disabled={isBusy}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3 rounded-md border border-dashed border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="voice-file">افزودن فایل صوتی جدید</Label>
          <Input
            key={uploadInputKey}
            id="voice-file"
            type="file"
            accept={AUDIO_ACCEPT}
            onChange={handleFileChange}
            disabled={isBusy}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            حداکثر حجم مجاز: ۱۰ مگابایت.
          </p>
        </div>
      </div>

      {formError ? (
        <p className="text-sm text-destructive">{formError}</p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={isBusy}>
          {isPending ? "در حال ذخیره..." : "ذخیره فایل‌های صوتی"}
        </Button>
      </div>
    </form>
  );
}
