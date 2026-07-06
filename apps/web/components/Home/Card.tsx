import Image from "next/image";

type FeaturedCardProps = {
  name: string;
  age?: number | null;
  level?: string | null;
  rating?: number | null;
  avatarSrc?: string | null;
  frameSrc?: string;
  hoverFrameSrc?: string;
  starSrc?: string;
};

export default function Card({
  name,
  age,
  level,
  rating,
  avatarSrc,
  frameSrc = "/cineflash/home/Bazigaran/CardFrame.png",
  hoverFrameSrc = "/cineflash/home/Bazigaran/Actors frame 1.png",
  starSrc = "/cineflash/home/Bazigaran/Star.png",
}: FeaturedCardProps) {
  const STAR_W = 12;
  const STAR_H = 11;
  const NUM_H = 19;
  const resolvedAvatarSrc =
    avatarSrc && avatarSrc.trim()
      ? avatarSrc
      : "/cineflash/home/Header/user.png";
  const ageLabel =
    typeof age === "number"
      ? `سن: ${age} سال`
      : "سن ثبت نشده";

  return (
    <div
      className="
        transition-transform duration-300 ease-out
        w-[280px] h-[312px]
        hover:scale-[1.25]
        flex items-center justify-center
        origin-center
        group
      "
      style={{ direction: "rtl", transformOrigin: "center center" }}
    >
      <div
        className="
          relative flex flex-col items-center justify-start text-center
          w-[280px] h-[312px]
        "
      >
        {/* Default Frame */}
        <div className="absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out group-hover:opacity-0">
          <Image
            src={frameSrc}
            alt="قاب کارت"
            fill
            unoptimized
            sizes="280px"
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Hover Frame */}
        <div className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
          <Image
            src={hoverFrameSrc}
            alt="قاب کارت"
            fill
            unoptimized
            sizes="280px"
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Avatar */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: 57,
            left: 84,
            width: 113,
            height: 99,
            borderRadius: "15px",
          }}
        >
          <Image
            src={resolvedAvatarSrc}
            alt={name}
            fill
            sizes="113px"
            style={{ objectFit: "cover" }}
          />
        </div>

    {/* Rating + Star + Level */}
    {typeof rating === "number" || level ? (
      
      <div
        className="absolute flex items-center justify-center gap-[32px] font-iransans"
        style={{
          top: 176,
          left: 0,
          width: "100%",
          height: 18,
        }}
      >
                {level ? (
          <div
            className="flex items-center justify-center"
            style={{
              width: 47,
              height: 14,
              backgroundColor: "#FF7F19",
              borderRadius: 19,
            }}
          >
            <span
              style={{
                fontFamily: "IRANSans",
                fontSize: 10,
                color: "#ffffff",
                lineHeight: "14px",
                fontWeight: 500,
              }}
            >
              {level}
            </span>
          </div>
        ) : null}
        {typeof rating === "number" ? (
          <div className="flex items-center gap-1">
            <div
              className="relative -translate-y-[2px]"
              style={{
                width: STAR_W,
                height: STAR_H,
              }}
            >
              <Image
                src={starSrc}
                alt="ستاره"
                fill
                unoptimized
                sizes={`${STAR_W}px`}
                style={{ objectFit: "contain" }}
              />
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                lineHeight: `${NUM_H}px`,
                color: "#FF7F19",
              }}
            >
              {rating}
            </span>
          </div>
        ) : null}


      </div>
    ) : null}

    {/* Name + Age */}
    <div
      className="absolute w-full text-center"
      style={{ bottom: 58, left: 0 }}
    >
      <div
        style={{
          fontFamily: "IRANSans",
          fontSize: 18,
          fontWeight: 800,
          color: "#0F0F0F",
          lineHeight: "34px",
        }}
      >
        {name}
      </div>

      <div
        style={{
          marginTop: 6,
          fontFamily: "IRANSans",
          fontSize: 11,
          fontWeight: 400,
          color: "#0F0F0F",
        }}
      >
        {ageLabel}
      </div>
    </div>
      </div>
    </div>
  );
}
