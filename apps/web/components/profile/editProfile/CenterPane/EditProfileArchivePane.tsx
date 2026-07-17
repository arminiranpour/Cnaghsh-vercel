"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

import { ArchiveModal } from "@/components/common/ArchiveModal";
import ProfileCard from "@/components/profiles/ProfileCard";
import { MovieCard, type MovieCardItem } from "@/app/(public)/movies/_components/movie-card";
import { EDIT_PROFILE_MOBILE_BOTTOM_NAV_H } from "@/components/profile/editProfile/constants";


const profileIcon = "/cineflash/Profile/editProfile/archieve/profiles.svg";
const booksIcon = "/cineflash/Profile/editProfile/archieve/books.svg";
const monologueIcon = "/cineflash/Profile/editProfile/archieve/monologues.svg";
const moviesIcon = "/cineflash/Profile/editProfile/archieve/movies.svg";

const numberFormatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const formatCount = (value: number) => `${numberFormatter.format(Math.max(0, value))} مورد`;

type ArchiveCounts = {
  profiles: number;
  movies: number;
  books: number;
  monologues: number;
};

type EditProfileArchivePaneProps = {
  counts: ArchiveCounts;
};

type ArchiveType = "profiles" | "movies";

type ArchivedProfileItem = {
  id: string;
  stageName: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  avatarUrl: string | null;
};

type ArchiveApiResponse<T> = {
  items: T[];
};

export function EditProfileArchivePane({ counts }: EditProfileArchivePaneProps) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<ArchiveType | null>(null);
  const [profiles, setProfiles] = useState<ArchivedProfileItem[]>([]);
  const [movies, setMovies] = useState<MovieCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalTitle = activeType === "profiles" ? "پروفایل‌ها" : activeType === "movies" ? "فیلم‌ها" : "";
  const activeItems = activeType === "profiles" ? profiles : movies;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setActiveType(null);
      setIsLoading(false);
      setError(null);
    }
  };

  const openArchive = (type: ArchiveType) => {
    setActiveType(type);
    setOpen(true);
  };

  useEffect(() => {
    if (!open || !activeType) return;

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const endpoint = activeType === "profiles"
          ? "/api/me/archive/profiles"
          : "/api/me/archive/movies";

        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as ArchiveApiResponse<ArchivedProfileItem | MovieCardItem>;
        const items = Array.isArray(data.items) ? data.items : [];

        if (cancelled) return;

        if (activeType === "profiles") {
          setProfiles(items as ArchivedProfileItem[]);
        } else {
          setMovies(items as MovieCardItem[]);
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          setError("خطا در دریافت اطلاعات.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, activeType]);

  const isProfilesActive = open && activeType === "profiles";
  const isMoviesActive = open && activeType === "movies";

  return (
    <>
      <section
        aria-label="آرشیو"
        className="fixed left-0 right-0 bottom-0 top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] z-40 w-screen overflow-x-hidden overflow-y-auto bg-white pb-[calc(var(--edit-profile-bottom-nav-h)+env(safe-area-inset-bottom))] shadow-[0_10px_30px_rgba(0,0,0,0.10)] md:absolute md:left-[273px] md:right-auto md:top-[315px] md:h-[595px] md:w-[748px] md:overflow-hidden md:rounded-[20px] md:pb-0"
        style={{ "--edit-profile-bottom-nav-h": `${EDIT_PROFILE_MOBILE_BOTTOM_NAV_H}px` } as CSSProperties & {
          "--edit-profile-bottom-nav-h": string;
        }}
        dir="rtl"
      >
        <div className="flex min-w-0 flex-col px-4 pt-4 md:h-full md:px-[44px] md:pt-[28px]">
          <h2 className="text-right text-[30px] font-bold text-black">آرشیو من</h2>

          <div className="mt-8 grid grid-cols-2 gap-4 md:mt-12 md:grid-cols-3 md:gap-6">
            <ArchiveTile
              label="پروفایل‌ها"
              count={counts.profiles}
              iconSrc={profileIcon}
              className="md:col-start-1"
              variant={isProfilesActive ? "active" : "inactive"}
              onClick={() => openArchive("profiles")}
            />
            <ArchiveTile
              label="کتاب‌ها"
              count={counts.books}
              iconSrc={booksIcon}
              className="md:col-start-2"
            />
            <ArchiveTile
              label="مونولوگ‌ها"
              count={counts.monologues}
              iconSrc={monologueIcon}
              className="md:col-start-3"
            />
            <ArchiveTile
              label="فیلم‌ها"
              count={counts.movies}
              iconSrc={moviesIcon}
              className="md:col-start-1 md:row-start-2"
              variant={isMoviesActive ? "active" : "inactive"}
              onClick={() => openArchive("movies")}
            />
          </div>
        </div>
      </section>

      <ArchiveModal
        open={open && Boolean(activeType)}
        onOpenChange={handleOpenChange}
        title={modalTitle}
        bodyClassName="max-h-[65vh] overflow-y-auto"
      >
        {!activeType ? null : isLoading ? (
          <p className="text-right text-sm text-muted-foreground">در حال بارگذاری...</p>
        ) : error ? (
          <p className="text-right text-sm text-red-500">{error}</p>
        ) : activeItems.length === 0 ? (
          <p className="text-right text-base font-medium text-foreground">موردی ذخیره نشده است.</p>
        ) : activeType === "profiles" ? (
          <div className="grid grid-cols-1 gap-6 place-items-center sm:grid-cols-2 md:grid-cols-3" dir="rtl">
            {profiles.map((item) => {
              const displayName = resolveDisplayName(item);

              return (
                <Link
                  key={item.id}
                  href={`/profiles/${item.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ width: "100%", maxWidth: "230px", height: "325px" }}
                >
                  <ProfileCard
                    name={displayName}
                    age={item.age ?? null}
                    avatarUrl={item.avatarUrl ?? null}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 place-items-center sm:grid-cols-2 md:grid-cols-3" dir="rtl">
            {movies.map((item) => (
              <MovieCard key={item.id} movie={item} />
            ))}
          </div>
        )}
      </ArchiveModal>
    </>
  );
}

type ArchiveTileProps = {
  label: string;
  count: number;
  iconSrc: string;
  className?: string;
  variant?: "active" | "inactive";
  onClick?: () => void;
};

function ArchiveTile({
  label,
  count,
  iconSrc,
  className,
  variant = "inactive",
  onClick,
}: ArchiveTileProps) {
  const isActive = variant === "active";

  const baseClassName = `group relative h-[112px] w-full max-w-[186px] overflow-hidden rounded-[18px] rounded-tl-[42px] px-4 py-3 transition-colors ${
    isActive ? "bg-[#FF7F19]" : "bg-[#EAEAEA] hover:bg-[#FF7F19]"
  } ${className ?? ""}`;

  const tileContent = (
    <>
      <Image
        src={iconSrc}
        alt=""
        width={120}
        height={120}
        className={`absolute left-[-20px] top-1/2 bottom-[-10px] -translate-y-1/2 opacity-20 transition ${
          isActive ? "brightness-0 invert" : "group-hover:brightness-0 group-hover:invert"
        }`}
      />

      <div
        className={`relative z-10 text-right transition-colors ${
          isActive ? "text-white" : "text-[#7C7C7C] group-hover:text-white"
        }`}
      >
        <div className="text-[14px] font-bold">{label}</div>
        <div className="mt-1 text-[11px] font-semibold">{formatCount(count)}</div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClassName} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        aria-haspopup="dialog"
      >
        {tileContent}
      </button>
    );
  }

  return <div className={baseClassName}>{tileContent}</div>;
}

function resolveDisplayName(item: {
  stageName: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  if (item.stageName && item.stageName.trim()) {
    return item.stageName.trim();
  }
  const parts = [item.firstName ?? "", item.lastName ?? ""]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(" ") || "پروفایل";
}
