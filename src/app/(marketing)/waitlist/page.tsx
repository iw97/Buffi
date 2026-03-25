import Link from "next/link";
import { WaitlistFormEmbed } from "@/components/marketing/WaitlistFormEmbed";
import { getWaitlistFormUrl } from "@/lib/waitlist";

/** Read env at request time so `.env.local` / host env is applied (not a stale static shell). */
export const dynamic = "force-dynamic";

export default function WaitlistPage() {
  const configured = Boolean(getWaitlistFormUrl());

  return (
    <div className="marketing-about-page waitlist-page">
      <h1 className="landing-section-title">Join the waitlist</h1>
      <p className="landing-sub waitlist-page-intro">
        Be first to know when Buffi opens more broadly.
      </p>

      {configured ? (
        <WaitlistFormEmbed />
      ) : (
        <p
          className="waitlist-page-placeholder"
          style={{
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          Add your form URL as{" "}
          <code className="waitlist-code">NEXT_PUBLIC_WAITLIST_URL</code> in{" "}
          <code className="waitlist-code">.env.local</code>, or reach us at{" "}
          <a href="mailto:hello@buffi.app" className="marketing-link">
            hello@buffi.app
          </a>
          .
        </p>
      )}

      <p className="waitlist-page-back">
        <Link href="/" className="marketing-link">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
