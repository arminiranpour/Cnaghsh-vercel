import type { ReactNode } from "react";

export default function ProfilesBackgroundLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-[#E5E5E5] bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent " aria-hidden="true" />
      </div>

      <div className="relative min-h-screen w-full">{children}</div>
    </div>
  );
}
