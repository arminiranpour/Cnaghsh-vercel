"use client";

import type { CSSProperties, ReactNode } from "react";

export type EditProfileTabId =
  | "portfolio"
  | "messages"
  | "saved"
  | "challenges"
  | "courses"
  | "subscription"
  | "settings";

const LEFT_PANE_ICON_BASE = "/cineflash/Profile/editProfile/leftPane";

type NavIconRenderProps = {
  isActive: boolean;
  inactiveColor: string;
  size: number;
};

type NavItem = {
  id: EditProfileTabId;
  label: string;
  iconSrc?: string;
  renderIcon?: (props: NavIconRenderProps) => ReactNode;
  isEnabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "portfolio",
    label: "پورتفولیو",
    iconSrc: `${LEFT_PANE_ICON_BASE}/icons8-portfolio-96 (1) 1.svg`,
    isEnabled: true,
  },
  {
    id: "messages",
    label: "صندوق پیام",
    iconSrc: `${LEFT_PANE_ICON_BASE}/chat 1.svg`,
    isEnabled: false,
  },
  {
    id: "saved",
    label: "آرشیو",
    iconSrc: `${LEFT_PANE_ICON_BASE}/black-save-instagram-18316 1.svg`,
    isEnabled: true,
  },
  {
    id: "challenges",
    label: "چالش و رویداد",
    iconSrc: `${LEFT_PANE_ICON_BASE}/kindpng_1491200 1.svg`,
    isEnabled: true,
  },
  {
    id: "courses",
    label: "کلاس و آموزش",
    iconSrc: `${LEFT_PANE_ICON_BASE}/courses.svg`,
    isEnabled: true,
  },
  {
    id: "subscription",
    label: "اشتراک",
    iconSrc: `${LEFT_PANE_ICON_BASE}/subscription-management-2 1.svg`,
    isEnabled: true,
  },
  {
    id: "settings",
    label: "تنظیمات",
    renderIcon: ({ inactiveColor, isActive }) => (
      <SettingsIcon active={isActive} inactiveColor={inactiveColor} />
    ),
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
                {renderNavItemIcon(item, {
                  isActive,
                  inactiveColor: "#8B8B8B",
                  size: 30,
                })}
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
                {renderNavItemIcon(item, {
                  isActive,
                  inactiveColor: "#7C7C7C",
                  size: 24,
                })}

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

function renderNavItemIcon(item: NavItem, props: NavIconRenderProps) {
  if (item.renderIcon) {
    return item.renderIcon(props);
  }

  if (!item.iconSrc) {
    return null;
  }

  return (
    <MaskedIcon
      src={item.iconSrc}
      color={props.isActive ? "#FFFFFF" : props.inactiveColor}
      size={props.size}
    />
  );
}

function MaskedIcon({ color, size, src }: { color: string; size: number; src: string }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "block",
    backgroundColor: color,
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return <span aria-hidden="true" style={style} />;
}

function SettingsIcon({
  active,
  inactiveColor,
}: {
  active: boolean;
  inactiveColor: string;
}) {
  const stroke = active ? "#FFFFFF" : inactiveColor;

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
