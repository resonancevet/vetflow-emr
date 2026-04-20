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

const siteUrl = "https://openvpm.com";
const siteTitle = "OpenVPM — Open-Source Veterinary Practice Management";
const siteDescription =
  "The first modern, open-source, API-first practice management system built for the veterinary community. Beautiful, fast, and free.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s — OpenVPM",
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "OpenVPM",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OpenVPM — open-source veterinary practice management",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
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
