"use client";

import { useState } from "react";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How does Buffi analyze a product?",
    a: "Buffi reads the fiber composition from the clothing label or product page, then estimates the true material cost using current commodity fabric prices. We compare that against the retail price to calculate markup and generate a verdict on whether the price reflects the quality.",
  },
  {
    q: "Is the material cost estimate accurate?",
    a: "Material costs are estimates based on fiber composition, garment construction, and current commodity prices. We show a range rather than a single number to reflect real uncertainty — actual production costs vary by manufacturer, order volume, and country of production.",
  },
  {
    q: "What does Retail Trap mean?",
    a: "Retail Trap means the markup is high relative to the actual quality of materials — you are likely paying more for brand recognition than for what the garment is made of.",
  },
  {
    q: "What does Think Twice mean?",
    a: "Think Twice means the markup is high but there are mitigating factors — quality fibers, independent brand economics, or strong cost per wear. It is worth considering before buying, not necessarily worth avoiding.",
  },
  {
    q: "Is Buffi free?",
    a: "Core scanning and analysis is free, always. Buffi Pro unlocks unlimited saves and additional features.",
  },
  {
    q: "How does Buffi make money?",
    a: "Buffi Pro subscription at $2.50/month or $30/year. We do not sell your data or accept brand sponsorships — our analysis is independent.",
  },
];

export default function LandingFaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="landing-faq-band" aria-labelledby="landing-faq-heading">
      <div className="landing-inner landing-faq-inner">
        <h2 id="landing-faq-heading" className="landing-faq-heading">
          Common questions
        </h2>
        <div className="landing-faq-list">
          {FAQ_ITEMS.map((it, idx) => {
            const open = openIdx === idx;
            return (
              <div
                key={it.q}
                className={`landing-faq-item ${open ? "open" : ""}`}
              >
                <button
                  type="button"
                  className="landing-faq-question"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenIdx((cur) => (cur === idx ? null : idx))
                  }
                >
                  <span>{it.q}</span>
                  <span className="landing-faq-chevron" aria-hidden>
                    ▼
                  </span>
                </button>
                <div className="landing-faq-answer">
                  <div className="landing-faq-answer-inner">{it.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
