/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { MapPin, CalendarDays } from "lucide-react";

import { formatJalaliDateRangeNoYear } from "@/lib/datetime/jalali";
import { buildResponsiveImageSrcSet } from "@/lib/media/responsive-images";

type ChallengeCardProps = {
  id: string;
  title: string;
  location: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  imageUrl: string | null;
};

export function ChallengeCard({
  id,
  title,
  location,
  summary,
  startDate,
  endDate,
  imageUrl,
}: ChallengeCardProps) {
  return (
    <article
      className="overflow-hidden rounded-[22px] bg-[#E8E8E8] shadow-[0_22px_50px_rgba(0,0,0,0.08)]"
      dir="rtl"
    >
      <Link href={`/challenges/${id}`} className="block">
        <div className="relative h-[190px] w-full overflow-hidden bg-[#ded6ce]">
          {imageUrl ? (
            <img
              src={imageUrl}
              srcSet={buildResponsiveImageSrcSet(imageUrl)}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-black/50">
              بدون تصویر
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-4 px-5 py-5">
        <div className="space-y-2">
          <Link href={`/challenges/${id}`} className="block">
            <h2 className="line-clamp-2 text-lg font-bold text-black">
              {title}
            </h2>
          </Link>

          <div className="flex w-full items-center max-w-[320px] justify-between text-xs text-[#6F6F6F]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {formatJalaliDateRangeNoYear(startDate, endDate)}
            </span>

            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {location}
            </span>
          </div>
        </div>

        <p className="line-clamp-3 text-sm leading-7 text-[#656565]">
          {summary}
        </p>

        <div className="pt-1 flex justify-center items-center">
          <Link
            href={`/challenges/${id}`}
            className="inline-flex  rounded-full bg-[#FF7F19] px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            ثبت نام در رویداد
          </Link>
        </div>
      </div>
    </article>
  );
}
