import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { MarketingNav } from "@/components/nav";
import { MarketingFooter } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "OpenVPM — Open-Source Veterinary Practice Management",
    template: "%s — OpenVPM",
  },
  description:
    "The first modern, open-source, API-first practice management system built for the veterinary community. Beautiful, fast, and free.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <div className="min-h-screen bg-white flex flex-col">
          <MarketingNav />
          <main className="flex-1 pt-16">{children}</main>
          <MarketingFooter />
        </div>
      </body>
    </html>
  );
}
