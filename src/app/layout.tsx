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

export const metadata: Metadata = {
  title: "Buffi",
  description: "Material intelligence for the conscious shopper.",
  metadataBase: new URL(appUrl),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buffi"
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png"
  },
  openGraph: {
    title: "Buffi",
    description: "Material intelligence",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 500,
        height: 500
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#080807"
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

