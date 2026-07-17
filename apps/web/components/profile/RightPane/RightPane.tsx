"use client";

import Image from "next/image";
import type { PublicProfileData } from "@/components/profile/ProfilePageClient";
import { LANGUAGE_LEVEL_MAX } from "@/lib/profile/languages";

const GREEN = "#3BBF35";
const GRAY_BORDER = "#DDDDDD";

const DEFAULT_SKILLS = ["کمدی", "صداپیشگی", "پانتومیم", "خواندن دوبله"];

type RightPaneProps = {
  profile: PublicProfileData;
  isOwner: boolean;
};

function formatNumber(value: number | undefined | null): string {
  if (typeof value !== "number") {
    return "";
  }
  return value.toLocaleString("fa-IR");
}

export function RightPane({ profile, isOwner }: RightPaneProps) {
  const avatarSrc =
    profile.avatarUrl && profile.avatarUrl.trim()
      ? profile.avatarUrl
      : "/cineflash/profile/example.jpg";
  const skills = profile.skills.length ? profile.skills : DEFAULT_SKILLS;
  const languages = profile.languages
    .map((lang) => ({
      label: lang.label,
      level: Math.min(Math.max(lang.level, 0), LANGUAGE_LEVEL_MAX),
    }))
    .filter((lang) => lang.label && lang.level > 0);
  const accents = (profile.accents ?? [])
    .map((accent) => ({
      title: accent.title.trim(),
      level:
        typeof accent.level === "number"
          ? Math.min(Math.max(accent.level, 0), LANGUAGE_LEVEL_MAX)
          : 0,
    }))
    .filter((accent) => accent.title);
  const degrees = (profile.degrees ?? [])
    .map((degree) => ({
      degreeLevel: (degree?.degreeLevel ?? "").trim(),
      major: (degree?.major ?? "").trim(),
    }))
    .filter((degree) => degree.degreeLevel || degree.major);
  const ageLabel = profile.age ? `سن ${formatNumber(profile.age)} سال` : "سن نامشخص";
  const locationLabel = profile.cityName ?? "شهر نامشخص";

  return (
    <section
      aria-label="پنل کناری پروفایل"
      style={{
        position: "absolute",
        left: 1095,
        top: 315,
        width: 265,
        height: 804,
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
        overflow: "visible",
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      {/* تصویر پروفایل */}
      <div
        style={{
          position: "absolute",
          width: 169,
          height: 169,
          left: "50%",
          top: -100,
          transform: "translateX(-50%)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}
      >
        <Image
          src={avatarSrc}
          alt={profile.displayName}
          width={169}
          height={169}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* نام بازیگر */}
      <h2
        style={{
          position: "absolute",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          color: "#FF7F19",
          whiteSpace: "nowrap",
        }}
      >
        {profile.displayName}
      </h2>

      {/* سن */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 13,
          fontWeight: 500,
          color: "#000000",
          whiteSpace: "nowrap",
        }}
      >
        {ageLabel}
      </div>

      {/* دکمه پیشرفته */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: "50%",
          transform: "translateX(-50%)",
          width: 85,
          height: 26,
          borderRadius: 16,
          backgroundColor: "#FF7F19",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        پیشرفته
      </div>

      {/* ستاره امتیاز */}
      <div
        style={{
          position: "absolute",
          top: 208,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* TODO: replace placeholder rating/count with real data from backend once available */}
        <span
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: "#FF7F19",
          }}
        >
          ۲۵۳۹
        </span>
        <Image
          src="/cineflash/profile/editProfile/rightPane/star.svg"
          alt="star"
          width={19}
          height={18}
        />
      </div>

      {/* باکس طوسی اطلاعات جزئی */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: (265 - 209) / 2,
          width: 209,
          borderRadius: 11,
          backgroundColor: "#EFEFEF",
          padding: "18px 16px",
          boxSizing: "border-box",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        {/* موقعیت */}
        <div
          style={{
            display: "flex",
            color: "#000000",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 6,
            marginBottom: 12,
          }}
        >
          <Image
            src="/cineflash/profile/editProfile/rightPane/location.svg"
            alt="location"
            width={12}
            height={12}
          />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{locationLabel}</span>
        </div>

        <div
          style={{
            height: 1,
            backgroundColor: GRAY_BORDER,
            marginBottom: 12,
          }}
        />
        {degrees.length > 0 ? (
          <>

            {/* تحصیلات */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                color: "#000000",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <Image
                src="/cineflash/profile/editProfile/rightPane/education.svg"
                alt="education"
                width={22}
                height={22}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                تحصیلات
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 18,
              }}
            >
              {degrees.map((degree, index) => {
                const details = [
                  degree.degreeLevel ? ` ${degree.degreeLevel}` : null,
                  degree.major ? ` ${degree.major}` : null,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={`${degree.degreeLevel}-${degree.major}-${index}`}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      color: "#000000",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 1,
                        backgroundColor: "#000000",
                      }}
                    />
                    <span>{details}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
            <div
              style={{
                height: 1,
                backgroundColor: GRAY_BORDER,
                margin: "10px 0 12px",
              }}
            />
        {/* مهارت‌ها */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            color: "#000000",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <Image
            src="/cineflash/profile/editProfile/rightPane/skills.svg"
            alt="skills"
            width={13}
            height={13}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            مهارت‌ها
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 12,
          }}
        >
          {skills.map((skill) => (
            <div
              key={skill}
              style={{
                display: "flex",
                flexDirection: "row",
                 color: "#000000",

                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 1,
                  backgroundColor: "#000000",
                }}
              />
              <span>{skill}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            height: 1,
            backgroundColor: GRAY_BORDER,
            margin: "12px 0",
          }}
        />

        {/* زبان‌ها */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
           color: "#000000",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <Image
            src="/cineflash/profile/editProfile/rightPane/language.svg"
            alt="language"
            width={13}
            height={13}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            زبان
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 14,
          }}
        >
          {languages.map((lang) => (
            <div
              key={lang.label}
              style={{
                display: "flex",
                flexDirection: "row",
                color: "#000000",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  minWidth: 50,
                }}
              >
                {lang.label}
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row-reverse",
                  gap: 4,
                }}
              >
                {Array.from({ length: LANGUAGE_LEVEL_MAX }).map((_, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "999px",
                      backgroundColor:
                        idx < lang.level ? "#000000" : "#C6C6C6",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {accents.length > 0 ? (
          <>
            <div
              style={{
                height: 1,
                backgroundColor: GRAY_BORDER,
                margin: "10px 0 12px",
              }}
            />

            {/* لهجه */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                  color: "#000000",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <Image
                src="/cineflash/profile/editProfile/rightPane/accent.svg"
                alt="accent"
                width={13}
                height={13}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                لهجه
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginBottom: 18,
              }}
            >
              {accents.map((accent, index) => (
                <div
                  key={`${accent.title}-${index}`}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    color: "#000000",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      minWidth: 50,
                    }}
                  >
                    {accent.title}
                  </span>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row-reverse",
                      gap: 4,
                    }}
                  >
                    {Array.from({ length: LANGUAGE_LEVEL_MAX }).map((_, idx) => (
                      <span
                        key={idx}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "999px",
                          backgroundColor:
                            idx < accent.level ? "#000000" : "#C6C6C6",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {!isOwner ? (
          <button
            type="button"
            style={{
              width: 144,
              height: 29,
              borderRadius: 19,
              border: "none",
              backgroundColor: GREEN,
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
            }}
          >
            انتخاب این بازیگر
          </button>
        ) : null}
      </div>
   
      {/* ــــــــــــــــــــــــــــــــــــــــــــــــ
          اسپیسِر نامرئی برای زیاد کردن ارتفاع صفحه
          ــــــــــــــــــــــــــــــــــــــــــــــــ */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 880,        // کمی پایین‌تر از انتهای کارت
          left: 0,
          right: 0,
          height: 220,     // هرچقدر فضای اضافه می‌خوای اینو کم/زیاد کن
          pointerEvents: "none",
          background: "transparent",
        }}
      />
    </section>
  );
}
