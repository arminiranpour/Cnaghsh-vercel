/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_ACCEPT } from "@/lib/media/formats";

type ChallengeInstructionVideoUploaderProps = {
  challengeId: string;
  instructionVideoMediaAssetId: string | null;
  videoUrl: string | null;
};

const ACCEPTED_TYPES = VIDEO_ACCEPT;

const resolveErrorMessage = (error: string | undefined, fallback: string) => {
  if (!error) {
    return fallback;
  }

  switch (error) {
    case "FILE_REQUIRED":
      return "یک ویدیو انتخاب کنید.";
    case "FILE_TOO_LARGE":
      return "حجم ویدیو بیش از حد مجاز است.";
    case "UNSUPPORTED_MEDIA_TYPE":
      return "فقط ویدیوهای MP4، MOV، WEBM و MKV مجاز هستند.";
    case "TRANSCODE_DISABLED":
      return "پردازش ویدیو در حال حاضر در دسترس نیست.";
    case "UNAUTHORIZED":
      return "اجازه دسترسی ندارید.";
    case "CHALLENGE_NOT_FOUND":
      return "چالش پیدا نشد.";
    default:
      return fallback;
  }
};

export function ChallengeInstructionVideoUploader({
  challengeId,
  instructionVideoMediaAssetId,
  videoUrl,
}: ChallengeInstructionVideoUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", description: "یک ویدیو انتخاب کنید." });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const response = await fetch(`/api/admin/challenges/${challengeId}/instruction-video`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "بارگذاری ویدیو ناموفق بود."),
        });
        return;
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      toast({ description: "ویدیوی راهنما به‌روزرسانی شد." });
      router.refresh();
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/challenges/${challengeId}/instruction-video`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "حذف ویدیو ناموفق بود."),
        });
        return;
      }

      toast({ description: "ویدیوی راهنما حذف شد." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-6" dir="rtl">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">ویدیوی راهنما</h2>
        <p className="text-sm text-muted-foreground">
          این ویدیو به صورت عمومی در صفحه چالش نمایش داده می‌شود.
        </p>
      </div>

      {videoUrl ? (
        <div className="space-y-2">
          <video src={videoUrl} controls className="h-48 w-full rounded-md border border-border object-cover" />
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            باز کردن ویدیو در صفحه جدید
          </a>
        </div>
      ) : instructionVideoMediaAssetId ? (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          ویدیو بارگذاری شده و در حال پردازش است.
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          هنوز ویدیوی راهنما ثبت نشده است.
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3" onSubmit={handleUpload}>
        <div className="space-y-2">
          <Label htmlFor="challenge-instruction-video">فایل ویدیو</Label>
          <Input
            id="challenge-instruction-video"
            name="file"
            type="file"
            accept={ACCEPTED_TYPES}
            ref={inputRef}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "در حال بارگذاری..." : "بارگذاری ویدیو"}
        </Button>
        {instructionVideoMediaAssetId ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleRemove}>
            حذف ویدیو
          </Button>
        ) : null}
      </form>
    </div>
  );
}
