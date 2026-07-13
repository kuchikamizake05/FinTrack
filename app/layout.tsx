import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#030604",
};

export const metadata: Metadata = {
  title: "FinTrack - Personal Finance Dashboard",
  description: "Asisten Keuangan Pribadi Berbasis Chat Bot Telegram & PWA Dashboard",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jetbrainsMono.variable} h-full antialiased dark`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#030604] text-[#f6f8f6] font-sans">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
