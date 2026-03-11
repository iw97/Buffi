import Link from "next/link";

export default function MarketingLandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <p className="landing-eyebrow">Material Intelligence</p>
        <h1 className="landing-headline">
          Know what you&apos;re <em>really</em> buying.
        </h1>
        <p className="landing-sub">
          Scan any tag or paste a product URL. We&apos;ll show you the receipt — materials, markup, and whether it&apos;s worth it.
        </p>
        <Link href="/scan" className="landing-cta">
          Try Buffi →
        </Link>
      </section>

      <section className="landing-overview">
        <h2 className="landing-section-title">How it works</h2>
        <ul className="landing-features">
          <li>
            <strong>Scan or paste</strong> — Use your camera on a care label or paste a product link from supported retailers.
          </li>
          <li>
            <strong>Get the breakdown</strong> — Plain-English materials, estimated material cost, and our verdict on value.
          </li>
          <li>
            <strong>Shop with confidence</strong> — Save scans and avoid overpaying for what you wear.
          </li>
        </ul>
      </section>

      <section className="landing-cta-section">
        <p className="landing-cta-text">Ready to see behind the tag?</p>
        <Link href="/scan" className="landing-cta secondary">
          Open the app
        </Link>
      </section>
    </div>
  );
}
