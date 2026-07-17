/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ACCEPT } from "@/lib/media/formats";

const ACCEPTED_TYPES = IMAGE_ACCEPT;

type UploadResponse =
  | { ok: true; mediaId: string }
  | { ok: false; error: string };

type MoviePosterUploaderProps = {
  label: string;
  description?: string;
  value: string;
  initialPreviewUrl?: string | null;
  error?: string;
  onChange: (mediaId: string) => void;
};

export function MoviePosterUploader({
  label,
  description,
  value,
  initialPreviewUrl,
  error,
  onChange,
}: MoviePosterUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!value && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl, value]);

  const handleUpload = () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", description: "لطفاً یک تصویر انتخاب کنید." });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const response = await fetch("/api/admin/movies/posters", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as UploadResponse | null;

      const errorPayload = payload && !payload.ok ? payload : null;

      if (!response.ok || !payload || !payload.ok) {
        toast({
          variant: "destructive",
          description: errorPayload?.error ?? "بارگذاری تصویر ناموفق بود.",
        });
        return;
      }

      onChange(payload.mediaId);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(URL.createObjectURL(file));
      toast({ description: "تصویر بارگذاری شد." });
    });
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onChange("");
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {previewUrl || (value && initialPreviewUrl) ? (
        <img
          src={previewUrl ?? (value ? initialPreviewUrl ?? "" : "")}
          alt={label}
          className="h-40 w-full rounded-md border border-border object-cover"
        />
      ) : value ? (
        <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          تصویر انتخاب شده است.
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          هیچ تصویری انتخاب نشده است.
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={inputId}>فایل تصویر</Label>
          <Input id={inputId} name="file" type="file" accept={ACCEPTED_TYPES} ref={inputRef} />
        </div>
        <Button type="button" disabled={isPending} onClick={handleUpload}>
          {isPending ? "در حال بارگذاری..." : "بارگذاری تصویر"}
        </Button>
        {value ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleRemove}>
            حذف تصویر
          </Button>
        ) : null}
      </div>
    </div>
  );
}
