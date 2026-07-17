"use client";

import { useState } from "react";
import type { Prisma } from "@prisma/client";
import { LeftRail } from "@/components/profile/LeftRail/LeftRail";
import { CenterPane } from "@/components/profile/CenterPane/CenterPane";
import { RightPane } from "@/components/profile/RightPane/RightPane";
import type { AccentEntry } from "@/lib/profile/accents";
import type { LanguageSkill } from "@/lib/profile/languages";
import type { MediaPlaybackKind } from "@/lib/media/urls";

export type ProfileTabId = "personal" | "gallery" | "videos" | "audio" | "awards";

export type ProfileVideoData = {
  mediaId: string;
  url: string;
  posterUrl?: string | null;
  title?: string;
  playbackKind?: MediaPlaybackKind;
};

export type PublicProfileData = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  age?: number | null;
  bio?: string | null;
  cityName?: string | null;
  likesCount: number;
  rating: number;
  skillLevel: number;
  isSavedByMe?: boolean;
  skills: string[];
  languages: LanguageSkill[];
  accents?: AccentEntry[];
  gallery: { url: string }[];
  degrees?: { degreeLevel: string; major: string }[];
  experience?: Prisma.JsonValue | null;
  voices?: { mediaId: string; url: string; title?: string | null; duration?: number | null; fileName?: string | null }[];
  videos?: ProfileVideoData[];
  awards?: {
    id?: string;
    title: string;
    workTitle?: string | null;
    place?: string | null;
    awardDate?: string | null;
  }[];
};


type ProfilePageClientProps = {
  profile: PublicProfileData;
  isOwner: boolean;
};

export function ProfilePageClient({ profile, isOwner }: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>("personal");

  return (
    <>
      <LeftRail activeTab={activeTab} onTabChange={setActiveTab} />
      <CenterPane activeTab={activeTab} profile={profile} isOwner={isOwner} onTabChange={setActiveTab} />
      <RightPane profile={profile} isOwner={isOwner} />
    </>
  );
}
