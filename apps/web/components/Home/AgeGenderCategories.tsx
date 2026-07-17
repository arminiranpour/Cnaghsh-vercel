"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Category = {
  id: string;
  labelLine1: string;
  labelLine2: string;
  iconSrc: string;
  href: string;
};

const categoryIconDefaultFilter =
  "invert(60%) sepia(0) saturate(0) hue-rotate(180deg) brightness(0.9)";
const categoryIconHoverFilter =
  "brightness(0) saturate(100%) invert(63%) sepia(97%) saturate(1777%) hue-rotate(350deg) brightness(101%) contrast(101%)";

const categories: Category[] = [
  {
    id: "adult-male",
    labelLine1: "بازیگران بزرگسال آقا",
    labelLine2: "",
    iconSrc: "/cineflash/home/categories/bazigar_bozorgsal_agha.svg",
    href: "/categories/adult-male",
  },
  {
    id: "adult-female",
    labelLine1: "بازیگران بزرگسال خانم",
    labelLine2: "",
    iconSrc: "/cineflash/home/categories/actress_18629734.svg",
    href: "/categories/adult-female",
  },
  {
    id: "boys",
    labelLine1: "بازیگران کودک",
    labelLine2: "و نوجوان پسر",
    iconSrc: "/cineflash/home/categories/Child Pic.svg",
    href: "/categories/boys",
  },
  {
    id: "girls",
    labelLine1: "بازیگران کودک",
    labelLine2: "و نوجوان دختر",
    iconSrc: "/cineflash/home/categories/Child Pic.svg",
    href: "/categories/girls",
  },
];

export default function AgeGenderCategories() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section
      dir="rtl"
      className="w-full flex justify-center mt-12 sm:mt-16 lg:mt-20"
    >
      <div
        className="
          grid w-full max-w-[1526px] px-4 sm:px-6
          grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
          gap-y-10 gap-x-10 sm:gap-x-14 lg:gap-x-20
        "
      >
        {categories.map((cat) => {
          const isHovered = hovered === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => router.push(cat.href)}
              onMouseEnter={() => setHovered(cat.id)}
              onMouseLeave={() => setHovered(null)}
              className="flex w-full max-w-[220px] flex-col items-center justify-self-center text-center transition-all duration-300"
              style={{
                cursor: "pointer",
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              {/* آیکن */}
              <div
                className="relative h-[110px] w-[110px] transition-[filter] duration-300 sm:h-[130px] sm:w-[130px] lg:h-[141px] lg:w-[141px]"
              >
                <Image
                  src={cat.iconSrc}
                  alt={cat.labelLine1}
                  fill
                  unoptimized
                  style={{
                    objectFit: "contain",
                    filter: isHovered
                      ? categoryIconHoverFilter
                      : categoryIconDefaultFilter,
                    transform: cat.id === "adult-female" ? "scale(1.39)" : "scale(1)",
                    transition: "filter 0.3s ease, transform 0.3s ease",
                  }}
                  sizes="141px"
                />
              </div>

              {/* متن زیر آیکن */}
              <div
                className="font-iransans mt-4 text-center text-[14px] font-normal leading-[1.4] transition-all duration-300 sm:mt-5 sm:text-[16px] lg:text-[18px]"
                style={{
                  fontFamily: "IRANSans",
                  background: isHovered
                    ? "linear-gradient(90deg, #FFC919 0%, #FF7F19 100%)"
                    : "none",
                  WebkitBackgroundClip: isHovered ? "text" : "unset",
                  WebkitTextFillColor: isHovered ? "transparent" : "#969696",
                  color: isHovered ? "transparent" : "#969696",
                  whiteSpace: "pre-line",
                  transition: "all 0.4s ease",
                }}
              >
                <div>{cat.labelLine1}</div>
                {cat.labelLine2 && <div>{cat.labelLine2}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
