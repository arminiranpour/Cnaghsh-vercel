/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { buildResponsiveImageSrcSet } from "@/lib/media/responsive-images";

type CourseCardProps = {
  id: string;
  title: string;
  imageUrl: string | null;
};

export default function CourseCard({ id, title, imageUrl }: CourseCardProps) {
  return (
    <div
      className="overflow-hidden shadow-lg"
      style={{
        borderRadius: "30px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "#1a1a1a",
      }}
      dir="rtl"
    >
    <div className="relative h-full w-full overflow-hidden bg-[#1a1a1a]">

        {imageUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={imageUrl}
              srcSet={buildResponsiveImageSrcSet(imageUrl)}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              alt={title}
              loading="lazy"
              className="max-h-full max-w-full object-contain"
              style={{ display: "block" }}
            />
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: "#2a2a2a" }}
          >
            <p className="text-sm text-gray-400">بدون تصویر</p>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "transparent",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            width: "100%",
          }}
        >
          <p
            className="flex-1 text-sm text-white"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
          >
            {title}
          </p>

          <Link
            href={`/courses/${id}`}
            className="rounded-[32px] bg-white px-6 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
            style={{ whiteSpace: "nowrap" }}
          >
            ثبت نام
          </Link>
        </div>
      </div>
    </div>
  );
}
