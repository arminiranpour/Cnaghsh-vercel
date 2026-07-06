import Link from "next/link";

const FRAME_WIDTH = 1200;
const RIGHT_PADDING = 6;

export default function Footer() {
  return (
    <footer
      className="relative z-20 w-full bg-transparent"
      style={{
        direction: "rtl",
        fontFamily: "IRANSans",
      }}
    >
      <div
        style={{
          maxWidth: FRAME_WIDTH,
          width: "100%",
          margin: "0 auto",
          paddingRight: RIGHT_PADDING,
          paddingLeft: RIGHT_PADDING,
        }}
        className="relative pt-8 pb-12"
      >
        <div className="mx-10 grid gap-8 justify-items-end grid-cols-[repeat(auto-fit,minmax(164px,1fr))]" dir="rtl"> 
          {/* Column 2: Si Naghsh Links */}
          <div className="flex min-w-0 flex-col space-y-3">
            <h3 className="font-semibold text-black">سی نقش</h3>
            <Link
              href="/"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              خانه
            </Link>
            <Link
              href="/about"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              درباره سی نقش
            </Link>
            <Link
              href="/challenges"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              چالش‌ها و رویدادها
            </Link>
          </div>

          {/* Column 3: Profile Links */}
          <div className="flex min-w-0 flex-col space-y-3">
            <h3 className="font-semibold text-black">پروفایل</h3>
            <Link
              href="/dashboard/profile"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              ثبت نام
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              خرید اشتراک
            </Link>
            <Link
              href="/dashboard/profile"
              className="text-sm text-black transition-colors hover:text-foreground"
            >
              تکمیل پورتفولیو
            </Link>
          </div>

          {/* Column 4: Contact */}
          <div className="flex min-w-0 flex-col space-y-3">
            <h3 className="font-semibold text-black">ارتباط با ما</h3>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black transition-colors hover:text-foreground"
                aria-label="Instagram"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black transition-colors hover:text-foreground"
                aria-label="Telegram"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </a>
              <a
                href="mailto:contact@cnaghsh.com"
                className="text-black transition-colors hover:text-foreground"
                aria-label="Email"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 5: Newsletter */}
          <div className="flex min-w-0 flex-col space-y-3">
            <h3 className="text-right text-semibold font-bold leading-[31px] text-black">
              به خبرنامه سی نقش بپیوندید
            </h3>
            <form className="w-full md:max-w-[262px]">
              <div className="flex h-[33px] min-h-[33px] w-full flex-nowrap overflow-hidden items-justify-center rounded-full bg-[#D9D9D9]/65" dir="ltr">
                <button
                  type="submit"
                  className="flex-none h-[33px] w-[55px] rounded-full bg-[#979797] text-[13px] font-bold leading-[20px] text-white"
                >
                  ارسال
                </button>
                <input
                  type="email"
                  placeholder="آدرس ایمیل"
                  className="h-full flex-1 bg-transparent pr-2 text-right text-[13px] leading-[20px] text-black placeholder:text-black/70 focus:outline-none"
                  dir="rtl"
                />
              </div>
            </form>
          </div>
        </div>
      </div>
    </footer>
  );
}
