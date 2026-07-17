/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ACCEPT } from "@/lib/media/formats";

import { removeCourseBannerAction, uploadCourseBannerAction } from "../actions";

type CourseBannerUploaderProps = {
  courseId: string;
  bannerUrl: string | null;
  bannerMediaAssetId: string | null;
};

const ACCEPTED_TYPES = IMAGE_ACCEPT;

export function CourseBannerUploader({
  courseId,
  bannerUrl,
  bannerMediaAssetId,
}: CourseBannerUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", description: "Select a banner image." });
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadCourseBannerAction(courseId, formData);
      if (!result.ok) {
        toast({ variant: "destructive", description: result.error });
        return;
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      toast({ description: "Banner updated." });
      router.refresh();
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeCourseBannerAction(courseId);
      if (!result.ok) {
        toast({ variant: "destructive", description: result.error });
        return;
      }
      toast({ description: "Banner removed." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Course Banner</h2>
        <p className="text-sm text-muted-foreground">
          Upload a JPG, PNG, WEBP, or HEIC image.
        </p>
      </div>
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Course banner"
          className="h-40 w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          No banner uploaded.
        </div>
      )}
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleUpload}>
        <div className="space-y-2">
          <Label htmlFor="banner">Banner Image</Label>
          <Input
            id="banner"
            name="file"
            type="file"
            accept={ACCEPTED_TYPES}
            ref={inputRef}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading..." : "Upload & Set Banner"}
        </Button>
        {bannerMediaAssetId ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleRemove}>
            Remove Banner
          </Button>
        ) : null}
      </form>
    </div>
  );
}
