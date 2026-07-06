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
    <div className="relative flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-[1600px] h-[800px] max-h-[90vh]">
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
          className="relative flex items-center justify-center w-full h-full gap-12 p-8 md:flex-row"
          dir="ltr"
        >
          {/* RIGHT SIDE: Auth Panel (back to RTL) */}
          <div className="w-full h-full max-h-[647px] max-w-[564px]">
            <LoginForm
              initialTab={initialTab}
              callbackUrl={callbackUrl}
              onPasswordPhaseChange={setIsPasswordPhase}
            />
          </div>
          {/* LEFT SIDE: Character */}
          <div className="flex w-full h-full justify-center md:w-auto -translate-x-4">
            <LoginCharacter isPasswordPhase={isPasswordPhase} />
          </div>
        </div>
      </div>
    </div>
  );
}
