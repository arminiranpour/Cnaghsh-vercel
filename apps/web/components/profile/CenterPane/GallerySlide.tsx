"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";

type GallerySlideProps = {
  images?: { url: string }[];
};

const SLOTS = [
  { left: 2, top: 0, width: 213, height: 216, color: "#FFCB1F" },
  { left: 226, top: 0, width: 270, height: 216, color: "#D79333" },
  { left: 509, top: 0, width: 173, height: 314, color: "#D8A35A" },
  { left: 0, top: 225, width: 173, height: 185, color: "#F36B08" },
  { left: 186, top: 225, width: 310, height: 141, color: "#FF9A22" },
  { left: 0, top: 419, width: 173, height: 165, color: "#D9AA63" },
  { left: 186, top: 381, width: 310, height: 202, color: "#CF8F30" },
  { left: 509, top: 337, width: 173, height: 250, color: "#FFC51D" },
] as const;

type GallerySlotStyle = CSSProperties & {
  "--slot-left": string;
  "--slot-top": string;
  "--slot-w": string;
  "--slot-h": string;
};

export function GallerySlide({ images }: GallerySlideProps) {
  const normalizedImages = images ?? [];

  // index of opened image in lightbox, or null if closed
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div
      className="relative w-full max-w-full min-w-0 md:h-full"
      style={{
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      {/* Title */}
      <h1
        className="m-0 mt-2 flex w-full items-center justify-center text-center text-[clamp(22px,6vw,32px)] font-black text-black md:absolute md:left-[655px] md:top-[35px] md:mt-0 md:h-[47px] md:w-auto md:text-[32px] md:whitespace-nowrap"
      >
        تصاویر
      </h1>

      {/* Gallery Container */}
      <div
        className="mt-4 grid w-full min-w-0 grid-cols-2 gap-3 rounded-[24px] bg-white p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 md:absolute md:left-[55px] md:top-[120px] md:mt-0 md:h-[587px] md:w-[682px] md:block md:gap-0 md:p-0"
      >
        {SLOTS.map((slot, index) => {
          const image = normalizedImages[index];
          const slotStyle: GallerySlotStyle = {
            aspectRatio: `${slot.width} / ${slot.height}`,
            backgroundColor: slot.color,
            cursor: image ? "pointer" : "default",
            "--slot-left": `${slot.left}px`,
            "--slot-top": `${slot.top}px`,
            "--slot-w": `${slot.width}px`,
            "--slot-h": `${slot.height}px`,
          };

          return (
            <div
              key={index}
              onClick={
                image ? () => setActiveIndex(index) : undefined
              }
              className="relative w-full overflow-hidden rounded-[12px] md:absolute md:left-[var(--slot-left)] md:top-[var(--slot-top)] md:w-[var(--slot-w)] md:h-[var(--slot-h)]"
              style={slotStyle}
            >
              {image && (
                <Image
                  src={image.url}
                  alt=""
                  fill
                  style={{
                    objectFit: "cover",
                    width: "100%",
                    height: "100%",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Lightbox overlay */}
      {activeIndex !== null && normalizedImages[activeIndex] && (
        <div
          onClick={() => setActiveIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Stop click from bubbling when clicking on the image / close button */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "80vw",
              height: "80vh",
              maxWidth: 900,
              maxHeight: 900,
            }}
          >
            <Image
              src={normalizedImages[activeIndex].url}
              alt=""
              fill
              style={{
                objectFit: "contain",
              }}
            />

            {/* Close button */}
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 36,
                height: 36,
                borderRadius: "999px",
                border: "none",
                backgroundColor: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
