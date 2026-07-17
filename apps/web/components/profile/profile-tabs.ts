import type { ProfileTabId } from "@/components/profile/ProfilePageClient";

export const PROFILE_TAB_ITEMS: Array<{
  id: ProfileTabId;
  label: string;
  iconSrc: string;
}> = [
  { id: "personal", label: "اطلاعات شخصی", iconSrc: "/cineflash/profile/dashboard/info.svg" },
  { id: "gallery", label: "گالری تصاویر", iconSrc: "/cineflash/profile/dashboard/gallery.svg" },
  { id: "videos", label: "ویدئوها", iconSrc: "/cineflash/profile/dashboard/video.svg" },
  { id: "audio", label: "فایل‌های صوتی", iconSrc: "/cineflash/profile/dashboard/audio.svg" },
  { id: "awards", label: "افتخارات", iconSrc: "/cineflash/profile/dashboard/award.svg" },
];

export function getNextProfileTab(activeTab: ProfileTabId): ProfileTabId | null {
  const activeIndex = PROFILE_TAB_ITEMS.findIndex((item) => item.id === activeTab);
  if (activeIndex === -1 || activeIndex >= PROFILE_TAB_ITEMS.length - 1) {
    return null;
  }

  return PROFILE_TAB_ITEMS[activeIndex + 1]?.id ?? null;
}
