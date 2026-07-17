"use client";

import Image from "next/image";
import { useMemo } from "react";

const ORANGE = "#FF7F19";

type AwardEntry = {
  title: string;
  workTitle?: string | null;
  place?: string | null;
  awardDate?: string | null;
};

type AwardsSlideProps = {
  awards?: AwardEntry[];
};

function formatAwardDate(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})(?:-(0[1-9]|1[0-2]))?$/);
  if (!match) return trimmed;

  const [, year, month] = match;
  return month ? `${year}/${month}` : year;
}

function buildSubtitle(award: AwardEntry) {
  const parts = [];
  if (award.place?.trim()) parts.push(award.place.trim());
  const formatted = formatAwardDate(award.awardDate);
  if (formatted) parts.push(formatted);
  return parts.join(" / ");
}

export function AwardsSlide({ awards }: AwardsSlideProps) {
  const normalized = useMemo(
    () =>
      (awards ?? [])
        .map((a) => ({
          title: a.title.trim(),
          workTitle: a.workTitle?.trim() || "",
          place: a.place?.trim() || "",
          awardDate: a.awardDate?.trim() || "",
        }))
        .filter((x) => x.title),
    [awards],
  );

  return (
    <div
      className="relative w-full max-w-full min-w-0 px-3 sm:px-4 md:px-[55px]"
      style={{
        fontFamily: "IRANSans, sans-serif",
        direction: "rtl",
      }}
    >
      {/* Title */}
      <h1
        className="m-0 mt-2 text-center text-[clamp(22px,6vw,32px)] font-black text-black md:mt-[35px] md:text-[32px]"
      >
        جوایز و افتخارات
      </h1>

      {/* No awards */}
      {normalized.length === 0 ? (
        <p
          className="mt-6 text-center text-[14px] text-[#7C7C7C] md:mt-[120px]"
        >
          جایزه‌ای ثبت نشده است.
        </p>
      ) : (
        <div
          className="mt-8 flex w-full min-w-0 flex-col gap-8 md:mt-[140px] md:w-[680px] md:gap-[40px]"
        >
          {normalized.map((award, index) => {
            const subtitle = buildSubtitle(award);

            return (
              <div key={index} style={{ width: "100%" }}>
                {/* Title Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Image
                    src="/cineflash/profile/trophy.svg"
                    width={26}
                    height={26}
                    alt="award icon"
                  />

                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: ORANGE,
                    }}
                  >
                    {award.title}
                  </span>

                  {award.workTitle ? (
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 400,
                        color: "#7C7C7C",
                      }}
                    >
                      - {award.workTitle}
                    </span>
                  ) : null}
                </div>

                {/* Subtitle */}
                <div
                  className="mt-2 text-[16px] text-[#7C7C7C]"
                >
                  {subtitle}
                </div>

                {/* Divider – except after the last item */}
                {index < normalized.length - 1 && (
                  <div
                    className="mt-[25px] h-0 w-full border border-black/30 md:w-[544px]"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
