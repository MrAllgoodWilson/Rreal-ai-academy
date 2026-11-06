"use client";
import type { ReactNode } from "react";
import { A11yProvider } from "@/lib/a11y";
import { I18nProvider } from "@/lib/i18n";
import { AcademyProvider } from "@/lib/store";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <A11yProvider>
        <AcademyProvider>
          {children}
          <CelebrationOverlay />
        </AcademyProvider>
      </A11yProvider>
    </I18nProvider>
  );
}
