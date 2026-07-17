"use client";

import Image from "next/image";

const DEFAULT_STAR_SRC =
  "/cineflash/home/Bazigaran/vecteezy_set-of-star-rotate-game-sprite-animation-ui-rate_14320508 [Converted] 1.svg";
const DEFAULT_PROFILE_SRC = "/cineflash/home/Bazigaran/11392 1.svg";

type FeaturedCardProps = {
  name: string;
  age?: number | null;
  avatarUrl?: string | null;
  level?: string | null;
  rating?: number | null;
  frameSrc?: string;
  starSrc?: string;
};

export default function Card({
  name,
  age,
  avatarUrl,
  level = "حرفه‌ای",
  rating = 4.5,
  starSrc = DEFAULT_STAR_SRC,
}: FeaturedCardProps) {
  const faNumber = new Intl.NumberFormat("fa-IR");
  const avatarSrc = avatarUrl && avatarUrl.trim()
    ? avatarUrl
    : DEFAULT_PROFILE_SRC;
  const ratingLabel =
    typeof rating === "number" ? faNumber.format(rating) : null;

  const ageLabel =
    typeof age === "number"
      ? `سن: ${faNumber.format(age)} سال`
      : "سن ثبت نشده";

  return (
    <div
      className="relative h-full w-full"
      style={{ direction: "rtl" }}
    >
      <div
        className="
          relative flex flex-col items-center justify-start text-center
          w-full h-full
        "
      >
        <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-[#8C8C8C] bg-transparent" />

        <div
          className="absolute overflow-hidden"
          style={{
            top: "4.2%",
            left: "6.3%",
            width: "87.4%",
            height: "53.3%",
            borderRadius: "15px",
          }}
        >
          <Image
            src={avatarSrc}
            alt={name}
            fill
            unoptimized
            sizes="230px"
            style={{ objectFit: "cover" }}
          />
        </div>

        {ratingLabel || level ? (
          <div
            className="absolute flex w-full items-center justify-between px-[14.3%]"
            style={{
              top: "60.9%",
              left: 0,
            }}
          >
            {ratingLabel ? (
              <div className="flex items-center gap-[1.8%] text-[#FFB200]">
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: "4.3%",
                    height: "3.5%",
                    minWidth: "12px",
                    minHeight: "11px",
                  }}
                >
                  <Image
                    src={starSrc}
                    alt="ستاره"
                    fill
                    unoptimized
                    sizes="20px"
                    style={{ objectFit: "contain" }}
                  />
                </div>

                <div
                  className="flex items-center justify-center font-iransans"
                  style={{
                    fontSize: "clamp(10px, 3.8vw, 12px)",
                    fontWeight: 500,
                    lineHeight: "1.2",
                    color: "#FF9A1A",
                  }}
                >
                  {ratingLabel}
                </div>
              </div>
            ) : (
              <div />
            )}

            {level ? (
              <div
                className="flex items-center justify-center rounded-full bg-[#FF7F19] font-iransans"
                style={{
                  width: "16.8%",
                  height: "4.5%",
                  minWidth: "47px",
                  minHeight: "14px",
                }}
              >
                <span
                  style={{
                    fontFamily: "IRANSans",
                    fontSize: "clamp(8px, 3.2vw, 10px)",
                    color: "#ffffff",
                    lineHeight: "1",
                    fontWeight: 500,
                  }}
                >
                  {level}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className="absolute w-full text-center"
          style={{ bottom: "16%", left: 0 }}
        >
          <div
            style={{
              fontFamily: "IRANSans",
              fontSize: "clamp(14px, 5.8vw, 18px)",
              fontWeight: 800,
              color: "#111111",
              lineHeight: "1.2",
            }}
          >
            {name}
          </div>

          <div
            style={{
              marginTop: "1.9%",
              fontFamily: "IRANSans",
              fontSize: "clamp(9px, 3.5vw, 11px)",
              fontWeight: 400,
              color: "#111111",
            }}
          >
            {ageLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
