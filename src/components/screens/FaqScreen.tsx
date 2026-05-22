"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_FAQ_ITEMS } from "@/lib/faq/appFaqItems";

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
        {APP_FAQ_ITEMS.map((it, idx) => {
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
