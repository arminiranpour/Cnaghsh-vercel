"use client";

import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export function ProfilePageLayout({ children }: Props) {
  return (
    <section className="relative min-h-screen w-full overflow-x-clip" dir="rtl">
      {children}
    </section>
  );
}
