"use client";

import Image from "next/image";
import type { Prisma } from "@prisma/client";

const ORANGE = "#F58A1F";

const CARD_WIDTH = 320;
const CARD_HEIGHT = 176;

const bulletDotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "999px",
  backgroundColor: "#5C5A5A",
  flexShrink: 0,
};

const bulletTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: "#5C5A5A",
  lineHeight: 1.9,
};

type ExperienceItem = {
  role: string;
  work: string;
};

export type ExperienceData = {
  theatre?: ExperienceItem[] | null;
  shortFilm?: ExperienceItem[] | null;
  cinema?: ExperienceItem[] | null;
  tv?: ExperienceItem[] | null;
};

const isExperienceItem = (entry: unknown): entry is ExperienceItem =>
  !!entry &&
  typeof entry === "object" &&
  "role" in entry &&
  typeof (entry as { role?: unknown }).role === "string" &&
  "work" in entry &&
  typeof (entry as { work?: unknown }).work === "string";

const EXPERIENCE_SECTIONS: { key: keyof ExperienceData; title: string }[] = [
  { key: "shortFilm", title: "فیلم کوتاه" },
  { key: "theatre", title: "تئاتر" },
  { key: "tv", title: "تلویزیون" },
  { key: "cinema", title: "سینمایی" },
];

const EXPERIENCE_CARD_META: Record<
  keyof ExperienceData,
  {
    left: number;
    top: number;
    backgroundColor: string;
    titleColor: string;
    iconSrc: string;
    iconAlt: string;
    iconWidth: number;
    iconHeight: number;
  }
> = {
  shortFilm: {
    left: 65,
    top: 345,
    backgroundColor: "rgba(10, 63, 53, 0.1)",
    titleColor: "#0A3F35",
    iconSrc: "/cineflash/profile/whatIveDone/shortfilm.svg",
    iconAlt: "فیلم کوتاه",
    iconWidth: 28,
    iconHeight: 28,
  },
  theatre: {
    left: 65 + CARD_WIDTH + 30,
    top: 345,
    backgroundColor: "rgba(255, 127, 25, 0.1)",
    titleColor: ORANGE,
    iconSrc: "/cineflash/profile/whatIveDone/theatre.svg",
    iconAlt: "تئاتر",
    iconWidth: 38,
    iconHeight: 38,
  },
  tv: {
    left: 65,
    top: 345 + CARD_HEIGHT + 30,
    backgroundColor: "rgba(255, 127, 25, 0.1)",
    titleColor: ORANGE,
    iconSrc: "/cineflash/profile/whatIveDone/tv.svg",
    iconAlt: "تلویزیون",
    iconWidth: 28,
    iconHeight: 28,
  },
  cinema: {
    left: 65 + CARD_WIDTH + 30,
    top: 345 + CARD_HEIGHT + 30,
    backgroundColor: "rgba(10, 63, 53, 0.1)",
    titleColor: "#0A3F35",
    iconSrc: "/cineflash/profile/whatIveDone/cinema.svg",
    iconAlt: "سینمایی",
    iconWidth: 28,
    iconHeight: 28,
  },
};

type PersonalInfoSlideProps = {
  bio?: string | null;
  // Prisma JSON fields may arrive as a parsed object or JSON string.
  experience?: Prisma.JsonValue | null;
};

const DEFAULT_BIO =
  "چند جمله راجب خودت بگو. مثلا اینکه چه‌جور آدمی هستی، چه‌جور کارهایی دوست داری انجام بدی، چه‌جور نقش‌هایی رو دوست داری بازی کنی و ...";

export function PersonalInfoSlide({ bio, experience }: PersonalInfoSlideProps) {
  const bioToRender = bio && bio.trim() ? bio : DEFAULT_BIO;

  let experienceData: ExperienceData = {};

  if (experience) {
    if (typeof experience === "string") {
      try {
        const parsed = JSON.parse(experience);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          experienceData = parsed as ExperienceData;
        }
      } catch {
        experienceData = {};
      }
    } else if (typeof experience === "object" && !Array.isArray(experience)) {
      experienceData = experience as ExperienceData;
    }
  }


  return (
    <div
      className="relative w-full max-w-full min-w-0 md:h-full"
      style={{
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      {/* درباره من */}
      <h1
        className="m-0 mt-2 flex w-full items-center justify-center text-center text-[clamp(22px,6vw,32px)] font-black text-black md:absolute md:left-[620px] md:top-[35px] md:mt-0 md:h-[47px] md:w-auto md:text-[32px] md:whitespace-nowrap"
      >
        درباره من
      </h1>

      <div
        className="mt-4 w-full text-justify text-[13px] font-[450] leading-[1.9] text-[#5C5A5A] whitespace-pre-line md:absolute md:left-[75px] md:top-[107px] md:mt-0 md:w-[662px] md:overflow-hidden"
      >
        <p className="m-0">{bioToRender}</p>
      </div>

      {/* تیتر کارهایی که انجام دادم */}
      <h2
        className="m-0 mt-6 flex w-full items-center justify-center text-center text-[clamp(20px,5.5vw,30px)] font-bold text-black md:absolute md:left-[468px] md:top-[273px] md:mt-0 md:h-[47px] md:w-[271px] md:text-[30px] md:whitespace-nowrap"
      >
        کارهایی که انجام دادم:
      </h2>

      <div className="mt-4 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:mt-0 md:block">
        {EXPERIENCE_SECTIONS.map((section) => {
          const card = EXPERIENCE_CARD_META[section.key];
          const rawItems = experienceData?.[section.key];
          const items = Array.isArray(rawItems) ? rawItems.filter(isExperienceItem) : [];

          return (
            <div
              key={section.key}
              className="static w-full min-w-0 rounded-[24px] p-4 sm:p-5 md:absolute md:h-[176px] md:w-[320px] md:p-0"
              style={{
                left: card.left,
                top: card.top,
                backgroundColor: card.backgroundColor,
              }}
            >
              <div
                className="flex items-center gap-2 text-[18px] font-bold md:absolute md:top-[22px] md:right-[32px]"
                style={{ color: card.titleColor }}
              >
                <Image
                  className="shrink-0"
                  src={card.iconSrc}
                  alt={card.iconAlt}
                  width={card.iconWidth}
                  height={card.iconHeight}
                />
                <span>{section.title}</span>
              </div>

              <div className="mt-3 w-full md:absolute md:top-[62px] md:right-[56px] md:mt-0 md:w-[224px]">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <div key={`${section.key}-${idx}`}>
                      <div
                        className="flex min-w-0 items-center gap-2"
                        style={{ marginBottom: idx < items.length - 1 ? 4 : 0 }}
                      >
                        <span style={bulletDotStyle} />
                        <span className="min-w-0" style={bulletTextStyle}>
                          {item.role} / {item.work}
                        </span>
                      </div>

                      {idx < items.length - 1 ? (
                        <div
                          style={{
                            height: 1,
                            backgroundColor: "rgba(0,0,0,0.15)",
                            margin: "10px 12px 10px 0",
                          }}
                        />
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div style={{ minHeight: 20 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
