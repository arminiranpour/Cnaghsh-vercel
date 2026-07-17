"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { VIDEO_ACCEPT } from "@/lib/media/formats";

type CourseIntroVideoUploaderProps = {
  courseId: string;
  introVideoMediaAssetId: string | null;
  videoUrl: string | null;
  isHls: boolean;
};

const ACCEPTED_TYPES = VIDEO_ACCEPT;

const resolveErrorMessage = (error: string | undefined, fallback: string) => {
  if (!error) {
    return fallback;
  }
  switch (error) {
    case "FILE_REQUIRED":
      return "Select a video to upload.";
    case "FILE_TOO_LARGE":
      return "Video file is too large.";
    case "UNSUPPORTED_MEDIA_TYPE":
      return "Only MP4, MOV, WEBM, or MKV videos are allowed.";
    case "TRANSCODE_DISABLED":
      return "Video processing is not available right now.";
    case "UNAUTHORIZED":
      return "You are not allowed to upload this video.";
    case "COURSE_NOT_FOUND":
      return "Course not found.";
    default:
      return fallback;
  }
};

export function CourseIntroVideoUploader({
  courseId,
  introVideoMediaAssetId,
  videoUrl,
  isHls,
}: CourseIntroVideoUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isHls) {
      return;
    }
    let active = true;
    let hlsInstance: import("hls.js").default | null = null;

    const setup = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
        return;
      }
      const hlsModule = await import("hls.js");
      if (!active) {
        return;
      }
      const Hls = hlsModule.default;
      if (!Hls.isSupported()) {
        return;
      }
      hlsInstance = new Hls({ enableWorker: true });
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
        hlsInstance?.loadSource(videoUrl);
      });
    };

    void setup();

    return () => {
      active = false;
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [isHls, videoUrl]);

  const handleUpload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast({ variant: "destructive", description: "Select a video to upload." });
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const response = await fetch(`/api/admin/courses/${courseId}/intro-video`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "Failed to upload video."),
        });
        return;
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      toast({ description: "Video updated." });
      router.refresh();
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/courses/${courseId}/intro-video`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        toast({
          variant: "destructive",
          description: resolveErrorMessage(payload?.error, "Failed to remove video."),
        });
        return;
      }
      toast({ description: "Video removed." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Course Intro Video</h2>
        <p className="text-sm text-muted-foreground">Upload an MP4, MOV, WEBM, or MKV video.</p>
      </div>
      {videoUrl ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={isHls ? undefined : videoUrl}
            controls
            className="h-48 w-full rounded-md border border-border object-cover"
          />
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Open video in new tab
          </a>
        </div>
      ) : introVideoMediaAssetId ? (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          Video uploaded but not publicly accessible.
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          No video uploaded.
        </div>
      )}
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleUpload}>
        <div className="space-y-2">
          <Label htmlFor="course-intro-video">Intro Video</Label>
          <Input
            id="course-intro-video"
            name="file"
            type="file"
            accept={ACCEPTED_TYPES}
            ref={inputRef}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading..." : "Upload & Set Video"}
        </Button>
        {introVideoMediaAssetId ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleRemove}>
            Remove Video
          </Button>
        ) : null}
      </form>
    </div>
  );
}
