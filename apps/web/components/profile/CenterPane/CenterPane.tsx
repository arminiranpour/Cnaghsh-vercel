"use client";

import type { ReactNode } from "react";

import type { ProfileTabId, PublicProfileData } from "@/components/profile/ProfilePageClient";
import { PersonalInfoSlide } from "@/components/profile/CenterPane/PersonalInfoSlide";
import { GallerySlide } from "@/components/profile/CenterPane/GallerySlide";
import { VideosSlide } from "@/components/profile/CenterPane/VideoSlide";
import { AwardsSlide } from "@/components/profile/CenterPane/AwardsSlide";
import { AudioSlide } from "@/components/profile/CenterPane/AudioSlide";
import { TopActions } from "./TopActions";


type CenterPaneProps = {
  activeTab: ProfileTabId;
  profile: PublicProfileData;
  children?: ReactNode;
  canEdit?: boolean;
  shouldHighlightEditButton?: boolean;
  onEditClick?: () => void;
};

export function CenterPane({
  activeTab,
  profile,
  children,
  canEdit,
  shouldHighlightEditButton,
  onEditClick,
}: CenterPaneProps) {
  return (
    <section
      aria-label="محتوای اصلی پروفایل"
      style={{
        position: "absolute",
        left: 273, 
        top: 315,  
        width: 797, 
        height: 804, 
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
        overflow: "hidden",
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      <TopActions
        canEdit={canEdit}
        shouldHighlightEditButton={shouldHighlightEditButton}
        onEditClick={onEditClick}
        profileId={profile.id}
        initialSaved={profile.isSavedByMe}
        initialLikesCount={profile.likesCount}
      />
      <div className="w-full min-w-0 px-3 pt-2 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-4 md:px-0 md:pt-0 md:pb-0 md:h-full">
        {children}
        {activeTab === "personal" ? (
          <PersonalInfoSlide bio={profile.bio} experience={profile.experience} />
        ) : null}
        {activeTab === "gallery" ? <GallerySlide images={profile.gallery} /> : null}
        {activeTab === "videos" ? <VideosSlide videos={profile.videos} /> : null}
        {activeTab === "awards" ? <AwardsSlide awards={profile.awards ?? []} /> : null}
        {activeTab === "audio" ? <AudioSlide voices={profile.voices ?? []} /> : null}
      </div>
    </section>
  );
}
