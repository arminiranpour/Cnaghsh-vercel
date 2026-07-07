"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const ORANGE = "#F58A1F";
const GRAY = "#7C7C7C";

type ActionId = "share";

type TopActionsProps = {
  canEdit?: boolean;
  shouldHighlightEditButton?: boolean;
  onEditClick?: () => void;
  profileId?: string;
  initialSaved?: boolean;
  initialLikesCount?: number;
};

const ICONS: Record<ActionId, JSX.Element> = {
  share: (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />

      <line x1="8.7" y1="10.8" x2="15.3" y2="6.2" />
      <line x1="8.7" y1="13.2" x2="15.3" y2="17.8" />
    </svg>
  ),
};

const numberFormatter = new Intl.NumberFormat("fa-IR", { useGrouping: false });

export function TopActions({
  canEdit,
  shouldHighlightEditButton = false,
  onEditClick,
  profileId,
  initialSaved = false,
  initialLikesCount = 0,
}: TopActionsProps) {
  const [shareActive, setShareActive] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isPending, setIsPending] = useState(false);

  const formattedLikes = useMemo(
    () => numberFormatter.format(Math.max(0, likesCount)),
    [likesCount],
  );

  return (
    <div
      className="relative z-10 flex w-full items-center justify-start gap-3 px-3 pt-3 md:absolute md:left-[32px] md:top-[18px] md:h-[23px] md:w-auto md:px-0 md:pt-0"
      style={{
        direction: "ltr",
      }}
    >
      <button
        type="button"
        onClick={() => setShareActive((prev) => !prev)}
        style={{
          width: 25,
          height: 25,
          padding: 0,
          margin: 0,
          border: "none",
          backgroundColor: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: shareActive ? ORANGE : GRAY,
          transition: "color 0.15s ease",
        }}
      >
        {ICONS.share}
      </button>

      <button
        type="button"
        onClick={async () => {
          if (!profileId || isPending) {
            return;
          }
          const next = !saved;
          const prevSaved = saved;
          const prevCount = likesCount;
          setSaved(next);
          setLikesCount((value) => Math.max(0, value + (next ? 1 : -1)));
          setIsPending(true);
          try {
            const response = await fetch("/api/saves/profiles/toggle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profileId }),
            });
            if (!response.ok) {
              throw new Error("REQUEST_FAILED");
            }
            const data = (await response.json()) as { saved: boolean; likesCount: number };
            setSaved(Boolean(data.saved));
            setLikesCount(Math.max(0, data.likesCount ?? 0));
          } catch (error) {
            setSaved(prevSaved);
            setLikesCount(prevCount);
          } finally {
            setIsPending(false);
          }
        }}
        style={{
          width: 25,
          height: 25,
          padding: 0,
          margin: 0,
          border: "none",
          backgroundColor: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: profileId ? "pointer" : "default",
          color: saved ? ORANGE : GRAY,
          transition: "color 0.15s ease",
        }}
      >
        <svg width="34" height="34" viewBox="0 0 90 90" fill="none">
          <g transform="translate(3 3) scale(0.955)">
            <path
              d="M45 84.334 6.802 46.136C2.416 41.75 0 35.918 0 29.716c0-6.203 2.416-12.034 6.802-16.42 4.386-4.386 10.217-6.802 16.42-6.802 6.203 0 12.034 2.416 16.42 6.802L45 18.654l5.358-5.358c4.386-4.386 10.218-6.802 16.42-6.802 6.203 0 12.034 2.416 16.42 6.802C87.585 17.682 90 23.513 90 29.716c0 6.203-2.415 12.034-6.802 16.42L45 84.334ZM23.222 10.494c-5.134 0-9.961 2-13.592 5.63S4 24.582 4 29.716s2 9.961 5.63 13.592L45 78.678l35.37-35.37C84.001 39.677 86 34.85 86 29.716s-1.999-9.961-5.63-13.592c-3.631-3.63-8.457-5.63-13.592-5.63-5.134 0-9.961 2-13.592 5.63L45 24.311l-8.187-8.187c-3.63-3.63-8.457-5.63-13.591-5.63Z"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={saved ? "0" : "4"}
            />
          </g>
        </svg>
      </button>

      <span
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: GRAY,
        }}
      >
        {formattedLikes}
      </span>

      {canEdit ? (
        <>
          <button
            type="button"
            onClick={() => onEditClick?.()}
            className={shouldHighlightEditButton ? "profile-edit-cta-pulse" : undefined}
            style={{
              width: 34,
              height: 34,
              padding: 0,
              margin: 0,
              border: "none",
              borderRadius: 999,
              backgroundColor: shouldHighlightEditButton ? ORANGE : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Image
              src="/cineflash/profile/edit.png"
              alt="ویرایش پروفایل"
              width={16}
              height={16}
              className={shouldHighlightEditButton ? "profile-edit-cta-icon-pulse" : undefined}
            />
          </button>
          <style jsx>{`
            @keyframes profileEditCtaPulse {
              0%,
              100% {
                background-color: #f58a1f;
              }
              50% {
                background-color: #ffffff;
              }
            }

            @keyframes profileEditIconPulse {
              0%,
              100% {
                filter: brightness(0) invert(1);
              }
              50% {
                filter: brightness(0) saturate(100%) invert(56%) sepia(82%) saturate(1565%)
                  hue-rotate(350deg) brightness(99%) contrast(93%);
              }
            }

            .profile-edit-cta-pulse {
              animation: profileEditCtaPulse 1.2s ease-in-out infinite;
              box-shadow: 0 0 0 1px rgba(245, 138, 31, 0.22);
            }

            .profile-edit-cta-icon-pulse {
              animation: profileEditIconPulse 1.2s ease-in-out infinite;
            }
          `}</style>
        </>
      ) : null}
    </div>
  );
}
