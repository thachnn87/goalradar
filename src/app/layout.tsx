import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import NavigationTracker from "@/components/NavigationTracker";

const ADSENSE_ID  = process.env.NEXT_PUBLIC_ADSENSE_ID  ?? '';
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true' && ADSENSE_ID !== '';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

export const metadata: Metadata = {
  metadataBase: new URL("https://goalradar.org"),

  title: {
    default: "GoalRadar - Live Football Scores",
    template: "%s | GoalRadar",
  },

  description:
    "Live football scores, fixtures, standings, schedules and match results from Europe's top football leagues.",

  keywords: [
    "football",
    "live scores",
    "football scores",
    "premier league",
    "la liga",
    "serie a",
    "bundesliga",
    "ligue 1",
    "champions league",
    "standings",
    "fixtures",
    "schedule",
    "match results",
  ],

  openGraph: {
    title: "GoalRadar - Live Football Scores",
    description:
      "Live football scores, fixtures, standings and match results.",
    type: "website",
    siteName: "GoalRadar",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "GoalRadar - Live Football Scores",
    description:
      "Live football scores, fixtures, standings and match results.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ── Google Analytics 4 ─────────────────────────────────────────── */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  send_page_view: true,
                  anonymize_ip: true
                });
              `}
            </Script>
          </>
        )}

        {/* ── Google AdSense ─────────────────────────────────────────────── */}
        {ADS_ENABLED && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="font-sans bg-gray-950 text-white min-h-screen">
        {/* Route-change page_view tracker — Suspense required for usePathname */}
        <Suspense fallback={null}>
          <NavigationTracker />
        </Suspense>

        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}