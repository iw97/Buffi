import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Mono, DM_Sans } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/Providers";
import { getPublicAppUrl } from "@/lib/publicAppUrl";

const appUrl = getPublicAppUrl();

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans"
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono"
});

const siteDescription =
  "Scan any clothing tag or product URL. Buffi shows you the real material cost, markup percentage, and whether the price is worth it. No brand deals. No sponsored results.";

export const metadata: Metadata = {
  title: {
    default: "Buffi — Know What You're Really Buying",
    template: "%s · Buffi"
  },
  description: siteDescription,
  metadataBase: new URL(appUrl),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buffi"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/icons/apple-touch-icon.png"
  },
  openGraph: {
    title: "Buffi — Material Intelligence",
    description: siteDescription,
    url: "https://buffi.app",
    type: "website",
    siteName: "Buffi",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Buffi product breakdown — material cost, markup, and verdict"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Buffi — Material Intelligence",
    description: siteDescription,
    images: ["/og-image.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#080807",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="font-[var(--font-sans)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

