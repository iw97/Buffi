import type { Metadata } from "next";
import Link from "next/link";
import LandingFaqSection from "@/components/marketing/LandingFaqSection";
import LandingHowItWorks from "@/components/marketing/LandingHowItWorks";
import { WaitlistCtaLink } from "@/components/marketing/WaitlistCtaLink";

const description =
  "Scan the tag inside your clothes or paste a product URL. Buffi shows you the real material cost, markup percentage, and whether the price is worth it. No brand deals. No sponsored results.";

export const metadata: Metadata = {
  title: "Buffi — Know What You're Really Buying",
  description,
  alternates: {
    canonical: "https://buffi.app/",
  },
  openGraph: {
    title: "Buffi — Material Intelligence",
    description,
    url: "https://buffi.app",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Buffi product breakdown — material cost, markup, and verdict",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Buffi — Material Intelligence",
    description,
    images: ["/og-image.png"],
  },
};

export default function MarketingLandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <p className="landing-eyebrow">Material Intelligence</p>
        <h1 className="landing-headline">
          Know what you&apos;re <em>really</em> buying.
        </h1>
        <p className="landing-sub">
          Scan the tag inside your clothes or paste a product URL. We&apos;ll
          show you the receipt — materials, markup, and whether it&apos;s worth
          it.
        </p>
        <WaitlistCtaLink className="landing-cta">
          Join the waitlist →
        </WaitlistCtaLink>
        <Link href="/onboarding/intro" className="landing-invite-signin">
          Have an invite? Get started →
        </Link>
      </section>

      <LandingHowItWorks />

      <LandingFaqSection />

      <section className="landing-cta-section">
        <div className="landing-inner">
          <p className="landing-cta-text">Ready to see behind the tag?</p>
          <WaitlistCtaLink className="landing-cta secondary">
            Join the waitlist
          </WaitlistCtaLink>
        </div>
      </section>

      <footer className="landing-footer" role="contentinfo">
        <div className="landing-inner landing-footer-inner">
          <Link href="/" className="landing-footer-wordmark">
            Buffi<span>.</span>
          </Link>
          <p className="landing-footer-tagline">
            Material intelligence for the conscious shopper
          </p>
          <div className="landing-footer-links">
            <Link href="/privacy">Privacy</Link>
            <span className="landing-footer-sep" aria-hidden>
              ·
            </span>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
