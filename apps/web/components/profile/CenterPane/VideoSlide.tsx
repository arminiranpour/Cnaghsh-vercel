"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { ProfileVideoData } from "@/components/profile/ProfilePageClient";

const VideoPlayer = dynamic(() => import("@/components/media/VideoPlayer"), { ssr: false });

type VideosSlideProps = {
  videos?: ProfileVideoData[];
};

export function VideosSlide({ videos }: VideosSlideProps) {
  const normalizedVideos = useMemo(
    () => (videos ?? []).filter((video) => video?.mediaId && video.url),
    [videos],
  );
  const slots = Array.from({ length: 6 }, (_, index) => normalizedVideos[index]);

  const showEmptyState = normalizedVideos.length === 0;

  return (
    <div
      className="relative w-full max-w-full min-w-0 md:h-full"
      style={{
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      <h1
        className="m-0 mt-2 flex w-full items-center justify-center text-center text-[clamp(22px,6vw,32px)] font-black text-black md:absolute md:left-[630px] md:top-[35px] md:mt-0 md:h-[47px] md:w-auto md:text-[32px] md:whitespace-nowrap"
      >
        ویدئو ها
      </h1>

      {normalizedVideos.length === 0 ? (
        <p
          className="mt-3 text-[14px] text-[#666666] md:absolute md:left-[55px] md:top-[90px] md:mt-0"
        >
          هنوز ویدئویی ثبت نشده است.
        </p>
      ) : null}

      <div
        className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:absolute md:left-[55px] md:top-[120px] md:mt-0 md:h-[584px] md:w-[680px] md:grid-cols-3 md:grid-rows-2 md:gap-x-[18px] md:gap-y-[22px]"
      >
        {slots.map((video, index) => {
          const title = video?.title?.trim() || "ویدئو";
          const badge = video ? `#${index + 1}` : "جای خالی";
          const placeholderText = showEmptyState ? "ویدیویی برای نمایش وجود ندارد" : "ویدئو اضافه کنید";
          return (
            <div
              key={`${video?.mediaId ?? "placeholder"}-${index}`}
              className="relative w-full min-w-0 overflow-hidden rounded-[12px] bg-[#C89E2B] aspect-video md:aspect-auto md:h-full"
            >
              {video ? (
                <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
                  <VideoPlayer
                    mediaId={video.mediaId}
                    manifestUrl={video.url}
                    playbackKind={video.playbackKind ?? "public-direct"}
                    posterUrl={video.posterUrl ?? undefined}
                    fillParent
                    autoPlayMuted
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    backgroundColor: "#C89E2B",
                    zIndex: 1,
                    textAlign: "center",
                    padding: "0 12px",
                  }}
                >
                  {placeholderText}
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: "100%",
                  height: 190,
                  background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />

              <span
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 16,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  zIndex: 3,
                }}
              >
                {title}
              </span>

              <span
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 16,
                  color: "#fff",
                  fontSize: 12,
                  opacity: 0.8,
                  zIndex: 3,
                }}
              >
                {badge}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
