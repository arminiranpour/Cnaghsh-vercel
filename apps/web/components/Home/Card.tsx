import Image from "next/image";

const DEFAULT_STAR_SRC =
  "/cineflash/home/Bazigaran/vecteezy_set-of-star-rotate-game-sprite-animation-ui-rate_14320508 [Converted] 1.svg";
const DEFAULT_PROFILE_SRC = "/cineflash/home/Bazigaran/11392 1.svg";

type FeaturedCardProps = {
  name: string;
  age?: number | null;
  level?: string | null;
  rating?: number | null;
  avatarSrc?: string | null;
  frameSrc?: string;
  hoverFrameSrc?: string;
  starSrc?: string;
  placeholderSrc?: string;
};

export default function Card({
  name,
  age,
  level,
  rating,
  avatarSrc,
  starSrc = DEFAULT_STAR_SRC,
  placeholderSrc = DEFAULT_PROFILE_SRC,
}: FeaturedCardProps) {
  const faNumber = new Intl.NumberFormat("fa-IR");
  const resolvedAvatarSrc =
    avatarSrc && avatarSrc.trim()
      ? avatarSrc
      : placeholderSrc;
  const ratingLabel =
    typeof rating === "number" ? faNumber.format(rating) : null;
  const ageLabel =
    typeof age === "number"
      ? `سن: ${faNumber.format(age)} سال`
      : "سن ثبت نشده";

  return (
    <div
      className="
        transition-transform duration-300 ease-out
        w-[220px] h-[312px]
        hover:scale-[1.25]
        flex items-center justify-center
        origin-center
        group
      "
      style={{ direction: "rtl", transformOrigin: "center center" }}
    >
      <div
        className="
          relative h-full w-full overflow-hidden rounded-[22px] text-center
          w-[280px] h-[312px]
        "
      >
        <div className="absolute inset-0 rounded-[22px] border border-[#8C8C8C] bg-transparent transition-opacity duration-300 ease-out group-hover:opacity-0" />
        <div className="absolute inset-0 rounded-[24px] border-2 border-[#FF7F19] bg-transparent opacity-0 shadow-[0_0_0_1px_rgba(255,127,25,0.2),0_12px_24px_rgba(255,127,25,0.22)] transition-opacity duration-300 ease-out group-hover:opacity-100" />

        <div className="relative flex h-full flex-col items-center px-[6.25%] pb-[11%] pt-[4.2%]">
          <div
            className="relative w-full overflow-hidden rounded-[15px]"
            style={{
              height: "53.3%",
            }}
          >
            <Image
              src={resolvedAvatarSrc}
              alt={name}
              fill
              unoptimized
              sizes="280px"
              style={{ objectFit: "cover" }}
            />
          </div>

          {ratingLabel || level ? (
            <div className="mt-[6.5%] flex w-full items-center justify-between px-[8.5%] font-iransans">
              {ratingLabel ? (
                <div className="flex items-center gap-1.5 text-[#FFB200]">
                  <div className="relative h-[11px] w-[12px] shrink-0">
                    <Image
                      src={starSrc}
                      alt="ستاره"
                      fill
                      unoptimized
                      sizes="12px"
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                  <span className="text-[12px] font-medium leading-[19px] text-[#FF9A1A]">
                    {ratingLabel}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {level ? (
                <div className="flex min-h-[20px] min-w-[53px] items-center justify-center rounded-full bg-[#FF7F19] px-2.5">
                  <span className="font-iransans text-[10px] font-medium leading-none text-white">
                    {level}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-[25%] flex w-full flex-1 flex-col items-center justify-start px-[10%]">
            <div className="font-iransans text-[18px] font-extrabold leading-[1.45] text-[#111111]">
              {name}
            </div>
            <div className="mt-[3%] font-iransans text-[11px] font-normal leading-[1.55] text-[#111111]">
              {ageLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
