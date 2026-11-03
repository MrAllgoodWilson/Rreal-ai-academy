"use client";
import type { ReactNode } from "react";
import { A11yProvider } from "@/lib/a11y";
import { AcademyProvider } from "@/lib/store";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <A11yProvider>
      <AcademyProvider>
        {children}
        <CelebrationOverlay />
      </AcademyProvider>
    </A11yProvider>
  );
}
