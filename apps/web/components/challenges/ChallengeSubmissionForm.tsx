"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";

import { CHALLENGE_SUBMISSION_FORM_STATE_EVENT } from "@/components/challenges/challengeSubmissionFormEvents";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatChallengeMediaLimit } from "@/lib/challenges/constants";
import { saveChallengeSubmissionAction } from "@/lib/challenges/actions";
import { VIDEO_ACCEPT } from "@/lib/media/formats";
import type { UploadResponse } from "@/lib/media/types";

type ChallengeSubmissionFormProps = {
  challengeId: string;
  formId: string;
  initialMediaId?: string | null;
  initialDescription?: string | null;
  mediaLengthLimitSec?: number | null;
  statusLabel: string;
};

type UploadPhase = "idle" | "uploading" | "processing" | "ready" | "failed";

type MediaStatusResponse = {
  ok?: boolean;
  mediaId: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  errorMessage?: string | null;
  durationSec?: number | null;
  sizeBytes?: number | null;
  needsFinalize?: boolean;
};

type VideoUploadState = {
  phase: UploadPhase;
  mediaId: string | null;
  fileName?: string;
  fileSize?: number | null;
  progress?: number;
  error?: string | null;
  status?: MediaStatusResponse["status"];
};

const ACCEPTED_TYPES = VIDEO_ACCEPT;
const POLL_INTERVAL_MS = 3000;
const MAX_SIZE_LABEL = "حداکثر حجم: ۴۰ مگابایت";



export function ChallengeSubmissionForm({
  challengeId,
  formId,
  initialMediaId,
  initialDescription,
  mediaLengthLimitSec,
}: ChallengeSubmissionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [description, setDescription] = useState(initialDescription ?? "");
  const [mediaId, setMediaId] = useState<string | null>(initialMediaId ?? null);
  const [isVideoBusy, setIsVideoBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeUrlRef = useRef<string | null>(null);
  const finalizePromiseRef = useRef<Promise<void> | null>(null);
  const [uploadState, setUploadState] = useState<VideoUploadState>(() =>
    initialMediaId
      ? { phase: "ready", mediaId: initialMediaId, progress: 100, status: "ready" }
      : { phase: "idle", mediaId: null },
  );

  const isUploadBusy = uploadState.phase === "uploading" || uploadState.phase === "processing";

  useEffect(() => {
    setIsVideoBusy(isUploadBusy);
  }, [isUploadBusy]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CHALLENGE_SUBMISSION_FORM_STATE_EVENT, {
        detail: {
          formId,
          isPending,
          isVideoBusy,
        },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent(CHALLENGE_SUBMISSION_FORM_STATE_EVENT, {
          detail: {
            formId,
            isPending: false,
            isVideoBusy: false,
          },
        }),
      );
    };
  }, [formId, isPending, isVideoBusy]);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (uploadRequestRef.current) {
        uploadRequestRef.current.abort();
        uploadRequestRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setUploadState((prev) => {
      if (mediaId && prev.mediaId === mediaId && prev.phase === "ready") {
        return prev;
      }
      if (mediaId) {
        return {
          phase: "ready",
          mediaId,
          fileName: prev.fileName,
          fileSize: prev.fileSize,
          progress: 100,
          error: null,
          status: "ready",
        };
      }
      if (!mediaId && prev.mediaId) {
        return { phase: "idle", mediaId: null };
      }
      return prev;
    });
  }, [mediaId]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const uploadToSignedUrl = useCallback((url: string, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadRequestRef.current = xhr;
      xhr.open("PUT", url, true);
      if (file.type) {
        xhr.setRequestHeader("Content-Type", file.type);
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        const percentage = Math.round((event.loaded / event.total) * 100);
        setUploadState((prev) => ({ ...prev, progress: percentage }));
      };
      xhr.onerror = () => reject(new Error("UPLOAD_FAILED"));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP_${xhr.status}`));
        }
      };
      xhr.send(file);
    });
  }, []);

  const finalizeSignedPut = useCallback(async (nextMediaId: string, targetUrl: string) => {
    const response = await fetch(targetUrl, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    let payload: { ok?: boolean; messageFa?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; messageFa?: string };
    } catch {
      payload = null;
    }
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.messageFa ?? "تأیید نهایی آپلود ناموفق بود.");
    }
    return nextMediaId;
  }, []);

  const triggerFinalize = useCallback(
    async (nextMediaId: string, reason: "initial" | "status", explicitTarget?: string) => {
      const target = explicitTarget ?? finalizeUrlRef.current ?? `/api/media/${nextMediaId}/finalize`;
      finalizeUrlRef.current = target;
      if (finalizePromiseRef.current) {
        return finalizePromiseRef.current;
      }
      const promise = (async () => {
        try {
          void reason;
          await finalizeSignedPut(nextMediaId, target);
        } finally {
          finalizePromiseRef.current = null;
        }
      })();
      finalizePromiseRef.current = promise;
      return promise;
    },
    [finalizeSignedPut],
  );

  const pollStatus = useCallback(
    (nextMediaId: string) => {
      const poll = async () => {
        try {
          const response = await fetch(`/api/media/${nextMediaId}/status`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error("STATUS_ERROR");
          }

          const payload = (await response.json()) as MediaStatusResponse;
          if (!payload?.ok) {
            throw new Error("STATUS_ERROR");
          }

          if (payload.status !== "uploaded") {
            finalizeUrlRef.current = null;
          }

          if (payload.status === "ready") {
            stopPolling();
            setMediaId(nextMediaId);
            setUploadState((prev) => ({
              ...prev,
              phase: "ready",
              mediaId: nextMediaId,
              status: payload.status,
              fileSize: payload.sizeBytes ?? prev.fileSize ?? null,
              error: null,
              progress: 100,
            }));
            return;
          }

          if (payload.status === "failed") {
            stopPolling();
            setUploadState((prev) => ({
              ...prev,
              phase: "failed",
              mediaId: nextMediaId,
              status: payload.status,
              error: payload.errorMessage ?? "پردازش ویدیو با خطا روبه‌رو شد.",
            }));
            return;
          }

          if (payload.status === "uploaded" && payload.needsFinalize) {
            void triggerFinalize(nextMediaId, "status").catch((error) => {
              stopPolling();
              setUploadState((prev) => ({
                ...prev,
                phase: "failed",
                mediaId: nextMediaId,
                error: error instanceof Error ? error.message : "تأیید نهایی آپلود ناموفق بود.",
              }));
            });
          }

          setUploadState((prev) => ({
            ...prev,
            phase: "processing",
            mediaId: nextMediaId,
            status: payload.status,
            fileSize: payload.sizeBytes ?? prev.fileSize ?? null,
            error: null,
          }));
          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } catch {
          stopPolling();
          setUploadState((prev) => ({
            ...prev,
            phase: "failed",
            mediaId: nextMediaId,
            error: "بررسی وضعیت ویدیو ناموفق بود.",
          }));
        }
      };

      stopPolling();
      void poll();
    },
    [stopPolling, triggerFinalize],
  );

  const startUpload = useCallback(
    async (file: File) => {
      setUploadState({
        phase: "uploading",
        mediaId: null,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        error: null,
      });
      finalizeUrlRef.current = null;
      finalizePromiseRef.current = null;
      setMediaId(null);

      try {
        const response = await fetch("/api/media/upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });

        const payload = (await response.json()) as UploadResponse;

        if (!response.ok) {
          setUploadState((prev) => ({
            ...prev,
            phase: "failed",
            error: "بارگذاری ویدیو ناموفق بود.",
            mediaId: null,
          }));
          return;
        }

        if (!payload?.ok) {
          setUploadState((prev) => ({
            ...prev,
            phase: "failed",
            error: payload?.messageFa ?? "بارگذاری ویدیو امکان‌پذیر نبود.",
            mediaId: null,
          }));
          return;
        }

        const nextMediaId = payload.mediaId;
        const finalizeUrl = payload.next?.finalizeUrl;

        setUploadState((prev) => ({ ...prev, mediaId: nextMediaId, error: null }));

        if (payload.mode === "signed-put") {
          if (!payload.signedUrl) {
            throw new Error("اطلاعات آپلود ناقص است.");
          }
          const finalizeTarget = finalizeUrl ?? `/api/media/${nextMediaId}/finalize`;
          await uploadToSignedUrl(payload.signedUrl, file);
          await triggerFinalize(nextMediaId, "initial", finalizeTarget);
        }

        setUploadState((prev) => ({
          ...prev,
          mediaId: nextMediaId,
          progress: 100,
          phase: "processing",
        }));
        pollStatus(nextMediaId);
      } catch (error) {
        finalizeUrlRef.current = null;
        finalizePromiseRef.current = null;
        setUploadState((prev) => ({
          ...prev,
          phase: "failed",
          mediaId: null,
          error:
            error instanceof Error
              ? error.message
              : "بارگذاری ویدیو با مشکل مواجه شد. لطفاً دوباره تلاش کنید.",
        }));
      } finally {
        uploadRequestRef.current = null;
        finalizePromiseRef.current = null;
      }
    },
    [pollStatus, triggerFinalize, uploadToSignedUrl],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      stopPolling();
      if (uploadRequestRef.current) {
        uploadRequestRef.current.abort();
        uploadRequestRef.current = null;
      }
      void startUpload(file);
    },
    [startUpload, stopPolling],
  );

  const handleOpenPicker = useCallback(() => {
    if (isPending || isUploadBusy) {
      return;
    }
    fileInputRef.current?.click();
  }, [isPending, isUploadBusy]);

  const statusMessage = useMemo(() => {
    if (uploadState.error) {
      return uploadState.error;
    }

    switch (uploadState.phase) {
      case "uploading":
        return `در حال آپلود ویدیو${uploadState.progress ? ` (${uploadState.progress}٪)` : "..."}`;
      case "processing":
        return "ویدیو در حال پردازش است...";
      case "ready":
        return "ویدیو با موفقیت آپلود شد.";
      case "failed":
        return "آپلود ویدیو ناموفق بود.";
      default:
        return "ویدیو را این جا رها کرده یا از طریق فایل، بارگزاری کنید.";
    }
  }, [uploadState.error, uploadState.phase, uploadState.progress]);

  const durationLabel = `حداکثر مدت: ${formatChallengeMediaLimit(mediaLengthLimitSec)}`;
  const hasUploadedVideo = uploadState.phase === "ready" && Boolean(mediaId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await saveChallengeSubmissionAction(challengeId, {
        submissionMediaAssetId: mediaId ?? undefined,
        description,
      });

      if (!result.ok) {
        toast({
          variant: "destructive",
          description: result.error,
        });
        return;
      }

      toast({ description: "اثر شما با موفقیت ثبت شد." });
      router.refresh();
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-10 py-[55px]" dir="rtl">
      <div className="space-y-2">
        <p className="text-base text-black">ویدئوی خودت رو در باکس پایین آپلود کن.</p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={isPending || isUploadBusy}
          className="flex h-[191px] w-full items-center justify-center rounded-[15px] border-2 border-dashed border-[#BDBDBD] bg-transparent disabled:cursor-not-allowed"
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
                <path d="M11 6.4V10.6" stroke="#A6A6A6" strokeWidth="1.1" strokeLinecap="round" />
                <path
                  d="M9.2 8.2L11 6.4L12.8 8.2"
                  stroke="#A6A6A6"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p
              className={`text-[11px] ${
                uploadState.phase === "failed"
                  ? "text-destructive"
                  : hasUploadedVideo
                    ? "text-[#3C7A44]"
                    : "text-[#5C5A5A]"
              }`}
            >
              {statusMessage}
            </p>
            <p className="text-[9px] text-[#7A7A7A]">{MAX_SIZE_LABEL}</p>
            <p className="text-[9px] text-[#7A7A7A]">{durationLabel}</p>
            {uploadState.fileName ? (
              <p className="max-w-[240px] truncate text-[9px] text-[#8A8A8A]" dir="ltr">
                {uploadState.fileName}
              </p>
            ) : null}
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending || isUploadBusy}
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-black" htmlFor="challenge-description">
          توضیحات
        </label>
        <Textarea
          id="challenge-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          placeholder="اگر توضیحی درباره اجرا یا فایل ارسالی دارید اینجا بنویسید."
          className="rounded-[18px] border-0 bg-[#F3F3F3] leading-7 text-[#7A7A7A]"
        />
      </div>

    </form>
  );
}
