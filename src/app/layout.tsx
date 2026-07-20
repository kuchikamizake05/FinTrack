import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppBoundary from "@/components/AppBoundary";
import OnboardingBoundary from "@/components/OnboardingBoundary";
import PWARegister from "@/components/PWARegister";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#15803d",
  colorScheme: "light",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "FinTrack - Personal Finance Dashboard",
  description: "Pantau arus kas, investasi, dan trading dalam satu ruang keuangan pribadi yang tenang.",
  applicationName: "FinTrack",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FinTrack" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <head />
      <body className="flex min-h-full flex-col bg-[#f7faf7] font-sans text-slate-900">
        <PWARegister />
        <AppBoundary><OnboardingBoundary>{children}</OnboardingBoundary></AppBoundary>
      </body>
    </html>
  );
}
