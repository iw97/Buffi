import Image from "next/image";
import Link from "next/link";

type StepMedia =
  | { kind: "video"; src: string; videoFit?: "cover" | "contain" }
  | { kind: "image"; src: string; alt: string };

const STEPS: {
  num: string;
  title: string;
  description: string;
  label: string;
  media: StepMedia;
}[] = [
  {
    num: "01",
    title: "Scan or paste",
    description:
      "Point your camera at a care label or paste a product URL",
    label: "Buffi scan — camera and paste URL",
    media: { kind: "video", src: "/landing/scanvideo.mov" },
  },
  {
    num: "02",
    title: "Analyzing",
    description:
      "Buffi reads the fibers, estimates material cost, and calculates markup",
    label: "Buffi analyzing — reading tag and metrics",
    media: {
      kind: "video",
      src: "/landing/analyzingvideo.mov",
      videoFit: "contain",
    },
  },
  {
    num: "03",
    title: "Get the breakdown",
    description:
      "See the receipt — materials, markup, verdict, and whether it\u2019s worth it",
    label: "Buffi breakdown — verdict and receipt",
    media: {
      kind: "image",
      src: "/screenshots/breakdown.png",
      alt: "Product breakdown with verdict and receipt",
    },
  },
];

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
                  {step.media.kind === "video" ? (
                    <video
                      className={`landing-hiw-shot landing-hiw-shot-video${
                        step.media.videoFit === "contain"
                          ? " landing-hiw-shot-video--contain"
                          : ""
                      }`}
                      src={step.media.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={step.label}
                    />
                  ) : (
                    <Image
                      src={step.media.src}
                      alt={step.media.alt}
                      fill
                      sizes="(max-width: 899px) min(260px, 82vw), 260px"
                      unoptimized
                      className="landing-hiw-shot"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="landing-hiw-cta-wrap">
          <Link href="/waitlist" className="landing-cta secondary">
            Join the waitlist
          </Link>
        </p>
      </div>
    </section>
  );
}
