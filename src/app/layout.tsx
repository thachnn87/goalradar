import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
      <body className="font-sans bg-gray-950 text-white min-h-screen">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}