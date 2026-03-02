"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { q: string; a: string };

const ITEMS: Item[] = [
  {
    q: "What is Cyni's mission?",
    a: "Cyni focuses on two things: value and transparency. We believe in the informed consumer, and we're using material intelligence to show you exactly what you're paying for and whether it aligns with your values."
  },
  {
    q: "How do I use Cyni?",
    a: "Just scan your product's tag if you have it in front of you, or if you're an online shopper, paste the URL. You'll receive a breakdown of the materials in plain English, and our verdict on whether you're paying for the item's true value."
  },
  {
    q: "I'm a premium member — can I get a refund?",
    a: "Yes! Reach out to us at support@cyni.app and we'll take care of you."
  },
  {
    q: "I have another question.",
    a: "We'd love to hear from you. Send us an email at hello@cyni.app and we'll get back to you as soon as we can."
  }
];

export function FaqScreen() {
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="faq-header">
        <button className="faq-back" type="button" onClick={() => router.push("/profile")}>
          ←
        </button>
        <div>
          <div className="faq-title">FAQ</div>
          <div className="faq-sub">Frequently asked questions</div>
        </div>
      </div>

      <div className="faq-scroll">
        {ITEMS.map((it, idx) => {
          const open = openIdx === idx;
          return (
            <div key={it.q} className={`faq-item ${open ? "open" : ""}`}>
              <button
                className="faq-question"
                type="button"
                onClick={() => setOpenIdx((cur) => (cur === idx ? null : idx))}
              >
                <span className="faq-question-text">{it.q}</span>
                <span className="faq-chevron" aria-hidden>
                  ▼
                </span>
              </button>
              <div className="faq-answer">
                <div className="faq-answer-inner">{it.a}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

