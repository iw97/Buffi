import Link from "next/link";

export default function MarketingAboutPage() {
  return (
    <div className="marketing-about-page">
      <h1 className="landing-section-title">About Buffi</h1>
      <p className="landing-sub" style={{ marginBottom: 24 }}>
        Material intelligence for the way you shop.
      </p>
      <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>
        We&apos;re building tools to help you see behind the tag — so you can make informed choices about what you buy and wear. More content coming soon.
      </p>
      <p>
        <Link href="/" className="marketing-link">← Back to home</Link>
        {" · "}
        <Link href="/scan" className="marketing-link">Try Buffi</Link>
      </p>
    </div>
  );
}
