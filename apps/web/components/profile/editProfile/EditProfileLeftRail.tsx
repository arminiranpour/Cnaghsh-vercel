"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export type EditProfileTabId =
  | "portfolio"
  | "messages"
  | "saved"
  | "challenges"
  | "courses"
  | "subscription"
  | "settings";

const LEFT_PANE_ICON_BASE = "/cineflash/profile/editProfile/leftPane";
const grayFilter =
  "brightness(0) saturate(100%) invert(39%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(90%)";
const whiteFilter = "brightness(0) invert(1)";

const NAV_ITEMS: {
  id: EditProfileTabId;
  label: string;
  iconSrcActive?: string;
  iconSrcInactive?: string;
  renderIcon?: (isActive: boolean) => ReactNode;
  isEnabled: boolean;
}[] = [
  {
    id: "portfolio",
    label: "پورتفولیو",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/portfolio-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/kindpng_1491203.png`,
    isEnabled: true,
  },
  {
    id: "messages",
    label: "صندوق پیام",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/message-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/message-gray.png`,
    isEnabled: false,
  },
  {
    id: "saved",
    label: "آرشیو",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/saved-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/saved-gray.png`,
    isEnabled: true,
  },
  {
    id: "challenges",
    label: "چالش و رویداد",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/challenges-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/challenges-gray.png`,
    isEnabled: true,
  },
  {
    id: "courses",
    label: "کلاس و آموزش",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/courses-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/courses-gray.png`,
    isEnabled: true,
  },
  {
    id: "subscription",
    label: "اشتراک",
    iconSrcActive: `${LEFT_PANE_ICON_BASE}/subscription-white.png`,
    iconSrcInactive: `${LEFT_PANE_ICON_BASE}/subscription-gray.png`,
    isEnabled: true,
  },
  {
    id: "settings",
    label: "تنظیمات",
    renderIcon: (isActive) => <SettingsIcon active={isActive} />,
    isEnabled: true,
  },
];

type EditProfileLeftRailProps = {
  activeTab: EditProfileTabId;
  onTabChange: (tab: EditProfileTabId) => void;
};

export function EditProfileLeftRail({ activeTab, onTabChange }: EditProfileLeftRailProps) {
  return (
    <>
      <div className="hidden md:block">
        <aside
          aria-label="ناوبری ویرایش پروفایل"
          style={{
            position: "absolute",
            left: 143,
            top: 315,
            width: 108,
            height: 595,
            borderRadius: 20,
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.05)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            paddingTop: 18,
            paddingBottom: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeTab;
            const isEnabled = item.isEnabled;
            const iconSrc =
              item.iconSrcActive && item.iconSrcInactive
                ? isActive
                  ? item.iconSrcActive
                  : item.iconSrcInactive
                : null;

            return (
              <button
                key={item.id}
                type="button"
                disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled || isActive) {
                    return;
                  }
                  onTabChange(item.id);
                }}
                style={{
                  width: 74,
                  minHeight: 74,
                  borderRadius: 20,
                  backgroundColor: isActive ? "#F58A1F" : "#F1F1F1",
                  border: "none",
                  padding: "8px 0",
                  cursor: isEnabled ? (isActive ? "default" : "pointer") : "not-allowed",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity: isActive ? 1 : isEnabled ? 0.85 : 0.6,
                  flexShrink: 0,
                }}
              >
                {item.renderIcon ? (
                  item.renderIcon(isActive)
                ) : iconSrc ? (
                  <div style={{ width: 30, height: 30, position: "relative" }}>
                    <Image
                      src={iconSrc}
                      alt={item.label}
                      fill
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                ) : null}
                <span
                  style={{
                    fontFamily: "IRANSans, sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isActive ? "#FFFFFF" : "#8B8B8B",
                    lineHeight: 1.3,
                    whiteSpace: "normal",
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>
      </div>

      <nav
        aria-label="ویرایش پروفایل"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 w-full h-[100px] bg-white border-t border-black/10 pb-[env(safe-area-inset-bottom)] flex flex-col justify-end overflow-hidden"
      >
        <div className="flex w-full gap-2 overflow-x-auto px-4 py-[9px] [scrollbar-width:none]">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeTab;
            const isEnabled = item.isEnabled;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                disabled={!isEnabled}
                onClick={() => {
                  if (!isEnabled || isActive) {
                    return;
                  }
                  onTabChange(item.id);
                }}
                className="flex h-14 min-w-[74px] shrink-0 flex-col items-center justify-between rounded-[28px] px-2 transition-colors"
                style={{
                  backgroundColor: isActive ? "#FF7F19" : "transparent",
                  cursor: isEnabled ? "pointer" : "not-allowed",
                  opacity: isEnabled ? 1 : 0.6,
                }}
              >
                {item.renderIcon ? (
                  item.renderIcon(isActive)
                ) : item.iconSrcInactive ? (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      position: "relative",
                      filter: isActive ? whiteFilter : grayFilter,
                    }}
                  >
                    <Image
                      src={item.iconSrcInactive}
                      alt={item.label}
                      fill
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                ) : null}

                <span
                  style={{
                    fontFamily: "IRANSans, sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isActive ? "#FFFFFF" : "#7C7C7C",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="h-[100px] md:hidden" aria-hidden="true" />
    </>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const stroke = active ? "#FFFFFF" : "#8B8B8B";

  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 8.25A3.75 3.75 0 1 1 8.25 12 3.75 3.75 0 0 1 12 8.25Z"
        stroke={stroke}
        strokeWidth="1.8"
      />
      <path
        d="M19.5 12a7.98 7.98 0 0 0-.11-1.29l1.77-1.38-1.66-2.87-2.14.53a8.14 8.14 0 0 0-2.24-1.3L14.8 3h-3.6l-.32 2.69a8.14 8.14 0 0 0-2.24 1.3l-2.14-.53-1.66 2.87 1.77 1.38a8.46 8.46 0 0 0 0 2.58l-1.77 1.38 1.66 2.87 2.14-.53a8.14 8.14 0 0 0 2.24 1.3l.32 2.69h3.6l.32-2.69a8.14 8.14 0 0 0 2.24-1.3l2.14.53 1.66-2.87-1.77-1.38c.07-.42.11-.85.11-1.29Z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
