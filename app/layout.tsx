import type { Metadata } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  title: "Telegram OSINT — Russian-language channel monitor",
  description:
    "63 Russian, Ukrainian and Belarusian Telegram channels — translated and classified for Nordic journalists and security analysts.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Telegram OSINT — Russian-language channel monitor",
    description:
      "63 Russian, Ukrainian and Belarusian Telegram channels — scraped every 30 min, translated to English, classified by topic and significance. Built for Nordic journalists and security analysts.",
    url: siteUrl,
    siteName: "Telegram OSINT",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Telegram OSINT — Russian-language channel monitor",
    description:
      "63 Russian, Ukrainian and Belarusian Telegram channels — translated and classified for Nordic journalists and security analysts.",
  },
  alternates: {
    types: {
      "application/rss+xml": `${siteUrl}/feed.xml`,
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
