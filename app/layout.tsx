import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DataProvider } from "@/components/data-provider";
import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: "拾光 — 想法与心情记录",
  description: "接住此刻的想法、心情与灵光。",
  applicationName: "拾光",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "拾光",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07101f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <DataProvider>
          <PwaRegistration />
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
