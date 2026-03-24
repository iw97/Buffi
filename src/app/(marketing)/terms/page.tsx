import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="marketing-about-page">
      <h1 className="landing-section-title">Terms</h1>
      <p className="landing-sub" style={{ marginBottom: 24 }}>
        Terms of use will live here. Questions?{" "}
        <a href="mailto:hello@buffi.app" className="marketing-link">
          hello@buffi.app
        </a>
      </p>
      <p>
        <Link href="/" className="marketing-link">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
