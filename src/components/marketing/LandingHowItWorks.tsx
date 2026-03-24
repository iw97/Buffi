import Image from "next/image";
import Link from "next/link";

const STEPS = [
  {
    num: "01",
    title: "Scan or paste",
    description:
      "Point your camera at a care label or paste a product URL",
    src: "/screenshots/scan.png",
    alt: "Scan screen",
  },
  {
    num: "02",
    title: "Analyzing",
    description:
      "Buffi reads the fibers, estimates material cost, and calculates markup",
    src: "/screenshots/analyzing.png",
    alt: "Analyzing screen",
  },
  {
    num: "03",
    title: "Get the breakdown",
    description:
      "See the receipt — materials, markup, verdict, and whether it\u2019s worth it",
    src: "/screenshots/breakdown.png",
    alt: "Breakdown screen",
  },
] as const;

export default function LandingHowItWorks() {
  return (
    <section className="landing-hiw" aria-labelledby="landing-hiw-heading">
      <div className="landing-inner">
        <h2 id="landing-hiw-heading" className="landing-hiw-section-title">
          How it works
        </h2>

        <ul className="landing-hiw-steps">
          {STEPS.map((step, i) => (
            <li
              key={step.num}
              className="landing-hiw-step"
              aria-label={`Step ${i + 1}: ${step.title}`}
            >
              <div className="landing-hiw-step-copy">
                <span className="landing-hiw-num">{step.num}</span>
                <h3 className="landing-hiw-title">{step.title}</h3>
                <p className="landing-hiw-desc">{step.description}</p>
              </div>
              <div className="landing-hiw-shot-wrap">
                <div className="landing-hiw-frame">
                  <Image
                    src={step.src}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 899px) min(260px, 82vw), 260px"
                    unoptimized
                    className="landing-hiw-shot"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="landing-hiw-cta-wrap">
          <Link href="/scan" className="landing-cta secondary">
            Open the app
          </Link>
        </p>
      </div>
    </section>
  );
}
