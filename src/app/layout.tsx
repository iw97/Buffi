import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, DM_Sans } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/Providers";

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
  description: "Material intelligence"
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

