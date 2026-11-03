import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

const sans = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Rreal AI Academy — From total beginner to AI expert", template: "%s · Rreal AI Academy" },
  description: "The interactive, voice-guided, fully accessible AI academy. 8-week tracks from absolute beginner to autonomous-agent architect, with verifiable Rreal Certified credentials.",
  applicationName: "Rreal AI Academy",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "Rreal AI Academy", description: "Learn AI by doing. Voice coach, live sandbox, video studio and verifiable certificates.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#070912", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
