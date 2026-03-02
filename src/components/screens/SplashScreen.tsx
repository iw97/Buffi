"use client";

import { useRouter } from "next/navigation";

export function SplashScreen() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-9">
      <div className="splash-identity">
        <div className="splash-wordmark">
          Cyni
          <span className="text-[var(--teal)]">.</span>
        </div>
        <div className="splash-eyebrow">Material Intelligence</div>
      </div>

      <p className="splash-headline">
        &quot;Know what you&apos;re
        <br />
        <em>really</em> buying.&quot;
      </p>

      <div className="splash-bottom">
        <button
          className="splash-cta"
          type="button"
          onClick={() => router.push("/scan")}
        >
          Start Scanning <span aria-hidden>→</span>
        </button>
        <div className="splash-legal">
          By continuing you agree to our Terms &amp; Privacy Policy
        </div>
      </div>
    </div>
  );
}

