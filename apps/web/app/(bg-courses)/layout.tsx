import type { ReactNode } from "react";

export default function CoursesBackgroundLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden">
      <div className="fixed inset-0 -z-10 bg-[#E5E5E5]" aria-hidden="true" />
      <div className="relative min-h-[100svh] w-full">{children}</div>
    </div>
  );
}
