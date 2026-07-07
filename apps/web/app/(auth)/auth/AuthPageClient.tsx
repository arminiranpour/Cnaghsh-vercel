"use client";

import { useState } from "react";

import { LoginCharacter } from "@/components/auth/LoginCharacter";
import { LoginForm } from "@/components/auth/LoginForm";
import type { AuthTab } from "@/lib/url/auth-tabs";

type AuthPageClientProps = {
  initialTab: AuthTab;
  callbackUrl?: string;
};

export function AuthPageClient({ initialTab, callbackUrl }: AuthPageClientProps) {
  const [isPasswordPhase, setIsPasswordPhase] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center">
      <div className="relative w-full max-w-[1600px] min-h-[560px] lg:h-[800px] lg:max-h-[90vh]">
        <div
          className="
            absolute
            inset-0
            border-[3px] border-white rounded-[34px]
            pointer-events-none
          "
          aria-hidden
        />

        <div
          className="relative flex h-full w-full flex-col items-center justify-center gap-8 p-5 sm:p-8 lg:flex-row lg:gap-12"
          dir="ltr"
        >
          {/* RIGHT SIDE: Auth Panel (back to RTL) */}
          <div className="w-full max-w-[564px] lg:h-full lg:max-h-[647px]">
            <LoginForm
              initialTab={initialTab}
              callbackUrl={callbackUrl}
              onPasswordPhaseChange={setIsPasswordPhase}
            />
          </div>
          {/* LEFT SIDE: Character */}
          <div className="hidden h-full w-full justify-center lg:flex lg:w-auto lg:-translate-x-4">
            <LoginCharacter isPasswordPhase={isPasswordPhase} />
          </div>
        </div>
      </div>
    </div>
  );
}
