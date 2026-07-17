"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { IMAGE_ACCEPT } from "@/lib/media/formats";
import { responsiveImageLoader } from "@/lib/media/responsive-images";

import { deleteImage, uploadImage } from "@/lib/profile/profile-actions";

type GalleryImage = {
  url: string;
};

type MediaGalleryProps = {
  images: GalleryImage[];
};

export function MediaGallery({ images }: MediaGalleryProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState<number>(Date.now());

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("لطفاً یک تصویر انتخاب کنید.");
      return;
    }

    startTransition(() => {
      uploadImage(formData)
        .then((result) => {
          if (result.ok) {
            setError(null);
            setUploadInputKey(Date.now());
            form.reset();
            toast({
              title: "تصویر بارگذاری شد.",
              description: "گالری با موفقیت به‌روزرسانی شد.",
            });
            router.refresh();
          } else {
            setError(result.error ?? "خطایی رخ داد.");
          }
        })
        .catch(() => {
          setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        });
    });
  };

  const handleDelete = (url: string) => {
    const formData = new FormData();
    formData.set("url", url);

    startTransition(() => {
      deleteImage(formData)
        .then((result) => {
          if (result.ok) {
            setError(null);
            toast({
              title: "تصویر حذف شد.",
              description: "گالری به‌روزرسانی شد.",
            });
            router.refresh();
          } else {
            setError(result.error ?? "خطایی رخ داد.");
          }
        })
        .catch(() => {
          setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        });
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <form className="space-y-4" onSubmit={handleUpload}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="gallery-file">
            افزودن تصویر جدید
          </label>
          <input
            key={uploadInputKey}
            id="gallery-file"
            name="file"
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={isPending}
            dir="ltr"
            className="block w-full text-sm"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "در حال بارگذاری..." : "آپلود تصویر"}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز تصویری در گالری ثبت نشده است.
          </p>
        ) : (
          images.map((image) => (
            <div
              key={image.url}
              className="space-y-3 rounded-md border border-border p-3 shadow-sm"
            >
              <div className="overflow-hidden rounded-md border border-border/50">
                <Image
                  src={image.url}
                  loader={responsiveImageLoader}
                  alt="تصویر گالری"
                  width={400}
                  height={280}
                  className="h-48 w-full object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {image.url}
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(image.url)}
                >
                  حذف تصویر
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
