"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { iransans } from "@/app/fonts";

type CineMenuOverlayProps = {
  open: boolean;
  onClose: () => void;
};
type CineMenuOverlayContentProps = {
  mode?: "overlay" | "mobile";
  onNavigate?: () => void;
};
type MenuItem = {
  label: string;
  href: string;
  iconSrc: string;
};

const menuIconHoverFilter =
  "brightness(0) saturate(100%) invert(63%) sepia(97%) saturate(1777%) hue-rotate(350deg) brightness(101%) contrast(101%)";

const rightItems: MenuItem[] = [
  { label: "مقالات", href: "/articles", iconSrc: "/cineflash/home/Hamberger-Menu/resume_9564228 1.svg" },
  { label: "قوانین", href: "/rules", iconSrc: "/cineflash/home/Hamberger-Menu/rules.svg" },
  { label: "ارتباط با ما", href: "/contact", iconSrc: "/cineflash/home/Hamberger-Menu/contactUs.svg" },
  { label: "درباره سی‌نقش", href: "/about", iconSrc: "/cineflash/home/Hamberger-Menu/about_12180739 1.svg" },
];

const leftItems: MenuItem[] = [
  { label: "پادکست سی‌نقش", href: "/podcast", iconSrc: "/cineflash/home/Hamberger-Menu/vecteezy_podcast-line-icons-collection-illustration_55791644 [Converted] 1.svg" },
  { label: "کتاب", href: "/books", iconSrc: "/cineflash/home/Hamberger-Menu/book_151456 1.svg" },
  { label: "فیلم", href: "/movies", iconSrc: "/cineflash/home/Hamberger-Menu/film_1101794 1.svg" },
  { label: "تئاتر", href: "/theatre", iconSrc: "/cineflash/home/Hamberger-Menu/theater_1778558 1.svg" },
  { label: "مونولوگ", href: "/monologue", iconSrc: "/cineflash/home/Hamberger-Menu/psychologist_1084208 1.svg" },
];

export function CineMenuOverlayContent({
  mode = "overlay",
  onNavigate,
}: CineMenuOverlayContentProps) {
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const renderItem = (item: MenuItem, textSizeClass: string) => (
    <Link key={item.href} href={item.href} onClick={onNavigate}>
      <div
        className={`group flex items-center gap-3 border-b border-white/20 py-3 ${textSizeClass} cursor-pointer`}
        onMouseEnter={() => setHoveredHref(item.href)}
        onMouseLeave={() => setHoveredHref((current) => (current === item.href ? null : current))}
        onFocus={() => setHoveredHref(item.href)}
        onBlur={() => setHoveredHref((current) => (current === item.href ? null : current))}
      >
        <div className="relative w-[19px] h-[19px]">
          <Image
            src={item.iconSrc}
            alt=""
            fill
            className="object-contain transition-[filter] duration-200"
            style={{
              filter: hoveredHref === item.href ? menuIconHoverFilter : "none",
            }}
            unoptimized
          />
        </div>
        <span className="font-semibold transition-colors duration-200 group-hover:text-[#FF7F19]">
          {item.label}
        </span>
      </div>
    </Link>
  );

  if (mode === "mobile") {
    const allItems = [...leftItems, ...rightItems];
    return (
      <div className={`${iransans.className} flex flex-col gap-4`}>
        {allItems.map((item) => renderItem(item, "text-base"))}
      </div>
    );
  }

  return (
    <div
      className={`${iransans.className} grid grid-cols-1 gap-y-10 px-28 py-14 md:grid-cols-2 md:gap-x-28`}
    >
      {/* LEFT column */}
      <div className="flex flex-col gap-6">
        {leftItems.map((item) => renderItem(item, "text-lg"))}
      </div>

      {/* RIGHT column */}
      <div className="flex flex-col gap-6">
        {rightItems.map((item) => renderItem(item, "text-lg"))}
      </div>
    </div>
  );
}

export function CineMenuOverlay({ open, onClose }: CineMenuOverlayProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // absolute = positioned relative to the page scroll,
    // NOT full-screen fixed overlay
    <div
      dir="rtl"
      className="
        absolute
        left-1/2
        top-[180px]
        -translate-x-1/2
        z-[70]
      "
    >
      <div 
        ref={menuRef}
        className="mx-auto w-[1150px] max-w-[95vw] h-[530px] rounded-[40px] bg-[#2F3439]/95 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
        {/* Menu content */}
        <CineMenuOverlayContent mode="overlay" onNavigate={onClose} />

      </div>
    </div>
  );
}
