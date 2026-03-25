import Link from "next/link";
import { WaitlistCtaLink } from "@/components/marketing/WaitlistCtaLink";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-layout">
      <header className="marketing-header">
        <Link href="/" className="marketing-logo">
          Buffi<span>.</span>
        </Link>
        <nav className="marketing-nav">
          <Link href="/#landing-faq-heading">FAQ</Link>
          <Link href="/about">About</Link>
          <WaitlistCtaLink className="marketing-cta">
            Join the waitlist
          </WaitlistCtaLink>
        </nav>
      </header>
      <main className="marketing-main">{children}</main>
    </div>
  );
}
