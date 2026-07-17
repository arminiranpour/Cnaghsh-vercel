/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ACCEPT } from "@/lib/media/formats";

type ChallengeCoverUploaderProps = {
  challengeId: string;
  coverUrl: string | null;
  coverMediaAssetId: string | null;
};

const ACCEPTED_TYPES = IMAGE_ACCEPT;

const resolveErrorMessage = (error: string | undefined, fallback: string) => {
  if (!error) {
    return fallback;
  }

  switch (error) {
    case "FILE_REQUIRED":
      return "یک تصویر انتخاب کنید.";
    case "FILE_TOO_LARGE":
      return "حجم تصویر بیش از حد مجاز است.";
    case "UNSUPPORTED_MEDIA_TYPE":
      return "فقط فرمت‌های JPG، PNG، WEBP و HEIC مجاز هستند.";
    case "UNAUTHORIZED":
      return "اجازه دسترسی ندارید.";
    case "CHALLENGE_NOT_FOUND":
      return "چالش پیدا نشد.";
    default:
      return fallback;
  }
};

export function ChallengeCoverUploader({
  challengeId,
  coverUrl,
  coverMediaAssetId,
}: ChallengeCoverUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", description: "یک تصویر انتخاب کنید." });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const response = await fetch(`/api/admin/challenges/${challengeId}/cover`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "بارگذاری تصویر ناموفق بود."),
        });
        return;
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      toast({ description: "کاور چالش به‌روزرسانی شد." });
      router.refresh();
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/challenges/${challengeId}/cover`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "حذف تصویر ناموفق بود."),
        });
        return;
      }

      toast({ description: "کاور حذف شد." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-6" dir="rtl">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">کاور چالش</h2>
        <p className="text-sm text-muted-foreground">یک تصویر عمومی برای کارت و صفحه جزئیات انتخاب کنید.</p>
      </div>

      {coverUrl ? (
        <img
          src={coverUrl}
          alt="کاور چالش"
          className="h-40 w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          هنوز تصویری برای این چالش ثبت نشده است.
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3" onSubmit={handleUpload}>
        <div className="space-y-2">
          <Label htmlFor="challenge-cover">فایل تصویر</Label>
          <Input id="challenge-cover" name="file" type="file" accept={ACCEPTED_TYPES} ref={inputRef} />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "در حال بارگذاری..." : "بارگذاری کاور"}
        </Button>
        {coverMediaAssetId ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleRemove}>
            حذف کاور
          </Button>
        ) : null}
      </form>
    </div>
  );
}
