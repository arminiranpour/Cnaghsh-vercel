import type { Metadata } from "next";

import { AuthPageClient } from "./AuthPageClient";
import { isGoogleAuthConfigured } from "@/lib/auth/google";
import { parseAuthTabParam } from "@/lib/url/auth-tabs";

export const metadata: Metadata = {
  title: "ورود / ثبت‌نام",
  description:
    "از همین‌جا وارد حساب کاربری صحنه شوید یا ثبت‌نام کنید و به ابزارهای حرفه‌ای بازیگری دسترسی داشته باشید.",
};

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tabParam = getFirstParam(resolvedSearchParams?.tab);
  const callbackUrl = getFirstParam(resolvedSearchParams?.callbackUrl);
  const initialTab = parseAuthTabParam(tabParam);
  const googleAuthAvailable = isGoogleAuthConfigured();

  return (
    <main className="relative min-h-[100svh] w-full overflow-x-hidden">
      <div
        className="fixed inset-0 -z-10 bg-[#E5E5E5]"
        aria-hidden="true"
      />
      <div className="relative flex min-h-[100svh] w-full items-center justify-center px-4 py-12 pt-[120px]">
        <AuthPageClient
          initialTab={initialTab}
          callbackUrl={callbackUrl}
          googleAuthAvailable={googleAuthAvailable}
        />
      </div>
    </main>
  );
}

function getFirstParam(value?: string | string[] | null) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}
