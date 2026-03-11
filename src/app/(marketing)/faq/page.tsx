"use client";

import { useState } from "react";
import Link from "next/link";

const ITEMS = [
  {
    q: "What is Buffi's mission?",
    a: "Buffi focuses on two things: value and transparency. We believe in the informed consumer, and we're using material intelligence to show you exactly what you're paying for and whether it aligns with your values."
  },
  {
    q: "How do I use Buffi?",
    a: "Just scan your product's tag if you have it in front of you, or if you're an online shopper, paste the URL. You'll receive a breakdown of the materials in plain English, and our verdict on whether you're paying for the item's true value."
  },
  {
    q: "I'm a premium member — can I get a refund?",
    a: "Yes! Reach out to us at support@buffi.app and we'll take care of you."
  },
  {
    q: "I have another question.",
    a: "We'd love to hear from you. Send us an email at hello@buffi.app and we'll get back to you as soon as we can."
  }
];

export default function MarketingFaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="marketing-faq-page">
      <h1 className="landing-section-title">FAQ</h1>
      <p className="landing-sub" style={{ marginBottom: 24 }}>
        Frequently asked questions
      </p>
      <div className="marketing-faq-list">
        {ITEMS.map((it, idx) => {
          const open = openIdx === idx;
          return (
            <div key={it.q} className={`marketing-faq-item ${open ? "open" : ""}`}>
              <button
                className="marketing-faq-question"
                type="button"
                onClick={() => setOpenIdx((cur) => (cur === idx ? null : idx))}
              >
                <span>{it.q}</span>
                <span className="marketing-faq-chevron" aria-hidden>▼</span>
              </button>
              <div className="marketing-faq-answer">
                <div className="marketing-faq-answer-inner">{it.a}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 32 }}>
        <Link href="/" className="marketing-link">← Back to home</Link>
        {" · "}
        <Link href="/scan" className="marketing-link">Try Buffi</Link>
      </p>
    </div>
  );
}
