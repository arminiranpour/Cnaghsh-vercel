import { forwardRef, useMemo, useRef, useState } from "react";
import {
  WaveformAudioPlayer,
  type WaveformAudioPlayerHandle,
} from "@/components/ui/WaveformAudioPlayer";

type AudioEntry = {
  mediaId: string;
  url: string;
  title?: string | null;
  duration?: number | null;
};

type AudioSlideProps = {
  voices?: AudioEntry[];
};

type AudioWaveformProps = {
  src: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
};

export const AudioWaveform = forwardRef<WaveformAudioPlayerHandle, AudioWaveformProps>(
  function AudioWaveform({ src, onPlayStateChange, className }, ref) {
    return (
      <div className={className ?? "w-full"}>
        <WaveformAudioPlayer ref={ref} src={src} onPlayStateChange={onPlayStateChange} />
      </div>
    );
  },
);

function AudioRow({ voice }: { voice: AudioEntry }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const waveformRef = useRef<WaveformAudioPlayerHandle | null>(null);

  const title = voice.title?.trim() || "فایل صوتی بدون عنوان";
  const durationLabel =
    typeof voice.duration === "number" && Number.isFinite(voice.duration)
      ? `${Math.round(voice.duration)} ثانیه`
      : null;

  const handleToggle = () => {
    waveformRef.current?.togglePlay();
  };

  return (
    <div
      className="w-full min-w-0"
      style={{
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        padding: "14px 18px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 16,
                // title color: black normally, FF7F19 when playing
                color: isPlaying ? "#FF7F19" : "#000000",
              }}
            >
              {title}
            </span>
            {durationLabel ? (
              <span style={{ fontSize: 12, color: "#6B7280" }}>{durationLabel}</span>
            ) : null}
          </div>
        </div>

        {/* play button beside title */}
        <button
          type="button"
          onClick={handleToggle}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            // button color: B1ADAD normally, FF7F19 when playing
            backgroundColor: isPlaying ? "#FF7F19" : "#B1ADAD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {isPlaying ? (
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ width: 3, height: 14, backgroundColor: "#FFFFFF" }} />
              <span style={{ width: 3, height: 14, backgroundColor: "#FFFFFF" }} />
            </div>
          ) : (
            <span
              style={{
                marginLeft: 2,
                width: 0,
                height: 0,
                borderTop: "7px solid transparent",
                borderBottom: "7px solid transparent",
                borderLeft: "11px solid #FFFFFF",
              }}
            />
          )}
        </button>
      </div>

      <div
        style={{
          borderRadius: "68px",
          border: "1px solid #E5E7EB",
          padding: 10,
        }}
      >
        <AudioWaveform
          ref={waveformRef}
          src={voice.url}
          onPlayStateChange={setIsPlaying}
        />
      </div>

    </div>
  );
}

export function AudioSlide({ voices }: AudioSlideProps) {
  const normalized = useMemo(
    () => (voices ?? []).filter((voice) => voice && voice.mediaId && voice.url),
    [voices],
  );

  return (
    <div
      className="relative w-full max-w-full min-w-0 md:h-full"
      style={{
        direction: "rtl",
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      {/* ... your header code stays the same ... */}

      {normalized.length === 0 ? (
        <p
          className="mt-3 text-[14px] text-[#666666] md:absolute md:left-[55px] md:top-[110px] md:mt-0"
        >
          فایل صوتی ثبت نشده است.
        </p>
      ) : (
        <div
          data-header-scroll
          className="mt-4 flex w-full min-w-0 flex-col gap-4 md:absolute md:left-[55px] md:top-[120px] md:mt-0 md:h-[620px] md:w-[680px] md:gap-[18px] md:overflow-y-auto md:pr-1"
        >
          {normalized.map((voice, index) => (
            <AudioRow key={`${voice.mediaId}-${index}`} voice={voice} />
          ))}
        </div>
      )}
    </div>
  );
}
