import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="flex justify-center bg-black" dir="rtl">
      <div
        className="w-full px-4 sm:px-0 sm:w-[550px] md:w-[650px] lg:w-[100%] lg:max-w-[1200px] mx-auto"
      >
        <div className="relative w-full overflow-hidden aspect-[1526/1145]">
          {/* 🎞️ GIF */}
          <Image
            src="/cineflash/home/banner/BannerGif.gif"
            alt="بنر سی‌نقش"
            fill
            priority
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 650px, 60vw"
            style={{ objectFit: "cover", objectPosition: "top", transform: "translateY(-6.55%)", zIndex: 0 }}
          />

          {/* 📏 فریم سفید */}
          <Image
            src="/cineflash/home/banner/Main Frame.svg"
            alt="نوار سفید بنر"
            fill
            className="absolute"
            style={{
              left: "0%",
              top: "1.31%",
              transform: "scaleX(1.3) scaleY(1.55)", // ← افقی ۱۵٪ و عمودی ۵٪ کشیده‌تر
              transformOrigin: "center top", // ← از بالا ثابت بماند و پایین کشیده شود
              opacity: 0.5,
              zIndex: 10,
              objectFit: "contain",
            }}
            unoptimized
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 650px, 60vw"
          />

          {/* 🟠 لوگو */}
          <Image
            src="/cineflash/home/banner/CNaghsh LogoType Orange 4 FA 1.svg"
            alt="لوگوی سی‌نقش"
            width={787}
            height={786}
            className="absolute"
            style={{
              left: "41.35%",
              top: "46.81%",
              width: "51.57%",
              height: "68.65%",
              zIndex: 20,
            }}
            unoptimized
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 650px, 60vw"
          />

          {/* 🔸 متن نارنجی */}
          <Image
            src="/cineflash/home/banner/CNaghsh Advertising slogan orange 1.svg"
            alt="سینما آرتیستینگ تئاتر"
            width={556}
            height={34}
            className="absolute"
            style={{
              left: "48.49%",
              top: "86.03%",
              width: "36.44%",
              height: "2.97%",
              zIndex: 20,
            }}
            unoptimized
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 650px, 60vw"
          />

          {/* 🔘 دکمه تصویری */}
          <button
            type="button"
            aria-label="درباره سی‌نقش"
            className="absolute"
            style={{
              left: "10.78%",
              top: "84.02%",
              width: "10.81%",
              height: "4.14%",
              border: "none",
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              zIndex: 20,
            }}
          >
          <span className="sr-only">درباره سی‌نقش</span>
          <span
            className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF]/80 text-black select-none"
            style={{
              fontFamily: "IRANSans",
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: "36px",
              letterSpacing: 0,
              whiteSpace: "nowrap",
            }}
          >
            درباره سی‌نقش
          </span>
          </button>

          {/* 📝 کپشن خاکستری */}
          <div
            className="absolute"
            style={{
              left: "43.38%",
              top: "92.05%",
              width: "41.55%",
              height: "2.97%",
              zIndex: 20,
              fontFamily: "IRANSans",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: "22px",
              lineHeight: "34px",
              textAlign: "right",
              color: "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            بزرگ‌ترین جامعه‌ی جهانی بازیگران فیلم، تئاتر، شبکه‌های خانگی، تلویزیون
          </div>

          {/* ⬅️ فلش تصویری */}
          <button
            type="button"
            aria-label="فلش بنر"
            className="absolute"
            style={{
              left: "12.96%",
              top: "92.84%",
              width: "2.23%",
              height: "2.36%",
              border: "none",
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              zIndex: 20,
            }}
          >
            <span className="sr-only">فلش بنر</span>
            <span className="relative block" style={{ width: "100%", height: "100%" }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 34 27"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <path
                  d="M33 13.5H2M2 13.5L14 1.5M2 13.5L14 25.5"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
