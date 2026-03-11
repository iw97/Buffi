"use client";

import Link from "next/link";

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
          <Link href="/faq">FAQ</Link>
          <Link href="/about">About</Link>
          <Link href="/scan" className="marketing-cta">
            Try Buffi
          </Link>
        </nav>
      </header>
      <main className="marketing-main">{children}</main>
    </div>
  );
}
