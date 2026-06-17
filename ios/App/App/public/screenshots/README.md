# Landing “How it works” media

## Current setup

| Step | File | Notes |
|------|------|--------|
| 1 — Scan | `/landing/scanvideo.mov` | Looping screen recording (`public/landing/scanvideo.mov`). |
| 2 — Analyzing | `/landing/analyzingvideo.mov` | Looping screen recording (`public/landing/analyzingvideo.mov`). |
| 3 — Breakdown | `/screenshots/breakdown.png` | Static phone screenshot. |

Videos are **muted**, **loop**, **`playsInline`**, and **`autoPlay`** for mobile Safari.

## Replacing assets

- Drop new `.mov` files into `public/landing/` (same names) or update paths in `src/components/marketing/LandingHowItWorks.tsx`.
- Replace `public/screenshots/breakdown.png` with a new portrait screenshot; the frame uses **aspect-ratio 17 / 32** with **`object-fit: cover`**.
