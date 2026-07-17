"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { VIDEO_ACCEPT } from "@/lib/media/formats";
import { cn } from "@/lib/utils";
import type { UploadResponse } from "@/lib/media/types";

const ACCEPTED_TYPES = VIDEO_ACCEPT;
const POLL_INTERVAL_MS = 3000;

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

type VideoUploadFieldProps = {
  label: string;
  description?: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};

const formatBytes = (value?: number | null) => {
  if (!value || Number.isNaN(value)) {
    return null;
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export function VideoUploadField({
  label,
  description,
  value,
  onValueChange,
  onBusyChange,
  disabled = false,
}: VideoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingMediaIdRef = useRef<string | null>(null);
  const finalizeUrlRef = useRef<string | null>(null);
  const finalizePromiseRef = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<VideoUploadState>(() =>
    value ? { phase: "ready", mediaId: value, progress: 100 } : { phase: "idle", mediaId: null },
  );

  const isBusy = state.phase === "uploading" || state.phase === "processing";

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

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
    setState((prev) => {
      if (value && prev.mediaId === value && prev.phase === "ready") {
        return prev;
      }
      if (value) {
        return {
          phase: "ready",
          mediaId: value,
          fileName: prev.fileName,
          fileSize: prev.fileSize,
          progress: 100,
          error: null,
          status: "ready",
        } satisfies VideoUploadState;
      }
      if (!value && prev.mediaId) {
        return { phase: "idle", mediaId: null } satisfies VideoUploadState;
      }
      return prev;
    });
  }, [value]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollingMediaIdRef.current = null;
  }, []);

  const handleRemove = useCallback(() => {
    if (state.phase === "uploading") {
      return;
    }
    stopPolling();
    finalizeUrlRef.current = null;
    finalizePromiseRef.current = null;
    setState({ phase: "idle", mediaId: null });
    onValueChange(null);
  }, [state.phase, stopPolling, onValueChange]);

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
        setState((prev) => ({ ...prev, progress: percentage }));
      };
      xhr.onerror = () => {
        reject(new Error("UPLOAD_FAILED"));
      };
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

  const finalizeSignedPut = useCallback(async (mediaId: string, targetUrl: string) => {
    console.info(`[VideoUpload] finalizing mediaId=${mediaId} url=${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    let payload: { ok?: boolean; status?: string; messageFa?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; status?: string };
    } catch {
      payload = null;
    }
    if (!response.ok || !payload?.ok) {
      console.error(`[VideoUpload] finalize failed mediaId=${mediaId} status=${response.status}`, payload);
      throw new Error(payload?.messageFa ?? "تأیید نهایی آپلود ناموفق بود.");
    }
    console.info(
      `[VideoUpload] finalize completed mediaId=${mediaId} status=${payload.status ?? "unknown"}`,
    );
  }, []);

  const triggerFinalize = useCallback(
    async (mediaId: string, reason: "initial" | "status", explicitTarget?: string) => {
      const target = explicitTarget ?? finalizeUrlRef.current ?? `/api/media/${mediaId}/finalize`;
      finalizeUrlRef.current = target;
      if (finalizePromiseRef.current) {
        return finalizePromiseRef.current;
      }
      const promise = (async () => {
        try {
          console.info(`[VideoUpload] trigger finalize (${reason}) mediaId=${mediaId}`);
          await finalizeSignedPut(mediaId, target);
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
    (mediaId: string) => {
      const poll = async () => {
        try {
          const response = await fetch(`/api/media/${mediaId}/status`, {
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
            setState((prev) => ({
              ...prev,
              phase: "ready",
              mediaId,
              status: payload.status,
              fileSize: payload.sizeBytes ?? prev.fileSize ?? null,
              error: null,
              progress: 100,
            }));
            onValueChange(mediaId);
            return;
          }

          if (payload.status === "failed") {
            stopPolling();
            setState((prev) => ({
              ...prev,
              phase: "failed",
              mediaId,
              status: payload.status,
              error: payload.errorMessage ?? "پردازش ویدیو با خطا روبه‌رو شد.",
            }));
            return;
          }

          if (payload.status === "uploaded" && payload.needsFinalize) {
            void triggerFinalize(mediaId, "status").catch((error) => {
              stopPolling();
              setState((prev) => ({
                ...prev,
                phase: "failed",
                mediaId,
                error:
                  error instanceof Error
                    ? error.message
                    : "تأیید نهایی آپلود ناموفق بود.",
              }));
            });
          }

          setState((prev) => ({
            ...prev,
            phase: "processing",
            mediaId,
            status: payload.status,
            fileSize: payload.sizeBytes ?? prev.fileSize ?? null,
            error: null,
          }));
          pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (error) {
          stopPolling();
          setState((prev) => ({
            ...prev,
            phase: "failed",
            mediaId,
            error: "بررسی وضعیت ویدیو ناموفق بود.",
          }));
        }
      };

      stopPolling();
      pollingMediaIdRef.current = mediaId;
      void poll();
    },
    [onValueChange, stopPolling, triggerFinalize],
  );

  const startUpload = useCallback(
    async (file: File) => {
      setState({
        phase: "uploading",
        mediaId: null,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        error: null,
      });
      finalizeUrlRef.current = null;
      finalizePromiseRef.current = null;
      onValueChange(null);

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
          setState((prev) => ({
            ...prev,
            phase: "failed",
            error: "بارگذاری ویدیو ناموفق بود.",
            mediaId: null,
          }));
          return;
        }

        if (!payload?.ok) {
          setState((prev) => ({
            ...prev,
            phase: "failed",
            error: payload?.messageFa ?? "بارگذاری ویدیو امکان‌پذیر نبود.",
            mediaId: null,
          }));
          return;
        }

        const { mediaId, mode, signedUrl } = payload;
        const finalizeUrl = payload.next?.finalizeUrl;

        setState((prev) => ({ ...prev, mediaId, error: null }));

        if (mode === "signed-put") {
          if (!signedUrl) {
            throw new Error("MISSING_SIGNED_URL");
          }
          const finalizeTarget = finalizeUrl ?? `/api/media/${mediaId}/finalize`;
          await uploadToSignedUrl(signedUrl, file);
          await triggerFinalize(mediaId, "initial", finalizeTarget);
        }

        setState((prev) => ({ ...prev, mediaId, progress: 100, phase: "processing" }));
        pollStatus(mediaId);
      } catch (error) {
        finalizeUrlRef.current = null;
        finalizePromiseRef.current = null;
        setState((prev) => ({
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
    [onValueChange, pollStatus, triggerFinalize, uploadToSignedUrl],
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

  const statusLabel = useMemo(() => {
    if (state.error) {
      return state.error;
    }
    switch (state.phase) {
      case "uploading":
        return "در حال آپلود...";
      case "processing":
        return state.status === "uploaded"
          ? "در صف پردازش..."
          : "در حال پردازش ویدیو...";
      case "ready":
        return "ویدیو آماده پخش است.";
      case "failed":
        return "بارگذاری یا پردازش ناموفق بود.";
      default:
        return "هنوز ویدیویی انتخاب نشده است.";
    }
  }, [state.error, state.phase, state.status]);

  const fileLabel = state.fileName
    ? state.fileName
    : state.mediaId
      ? `شناسه ویدیو: ${state.mediaId}`
      : "فایلی انتخاب نشده است";

  const fileSizeLabel = formatBytes(state.fileSize ?? null);

  return (
    <div className="space-y-3" dir="rtl">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <div className="space-y-3">
          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground" dir="ltr">
                {fileLabel}
              </span>
              {fileSizeLabel ? (
                <span className="text-xs text-muted-foreground">{fileSizeLabel}</span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 text-xs",
                state.phase === "failed" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </p>
            {state.phase === "uploading" ? (
              <div className="mt-3 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${state.progress ?? 0}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {state.mediaId ? "انتخاب ویدیو جدید" : "انتخاب ویدیو"}
            </Button>
            {state.mediaId ? (
              <Button
                type="button"
                variant="outline"
                disabled={disabled || state.phase === "uploading"}
                onClick={handleRemove}
              >
                حذف ویدیو
              </Button>
            ) : null}
            {state.phase === "failed" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                تلاش دوباره
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  );
}
