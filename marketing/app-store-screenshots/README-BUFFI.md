# Buffi — App Store screenshot deck

Pre-filled editor for Buffi marketing assets (iOS + Play Store feature graphic).

## Quick start

```bash
cd marketing/app-store-screenshots
npm install --legacy-peer-deps
npm run generate-mocks   # refresh in-app mock PNGs from Buffi brand tokens
npm run dev              # → http://localhost:3000
```

## Deck (5 iPhone slides)

| # | Screen | Headline energy |
|---|--------|-----------------|
| 1 | Hero / verdict | "That $420 cashmere isn't cashmere." |
| 2 | Scan flow | Tag scan + URL paste |
| 3 | Material breakdown | 78% wool, fiber sourcing |
| 4 | Markup analysis | $18 to make vs $168 retail |
| 5 | Better alternatives | Post–Retail Trap picks |

Theme: **Buffi Terminal** (near-black `#080807`, teal `#52D9D0`, Cormorant + DM Sans + DM Mono).

## Export

1. Open the editor → device **iPhone** → theme **Buffi Terminal**.
2. Tweak copy/layout in the sidebar if needed.
3. Click **Export bundle** for all Apple-required sizes (6.9", 6.5", 6.3", 6.1").
4. Switch to **Feature Graphic** for the 1024×500 Play Store banner.

Commit `app-store-screenshots.json` + `public/screenshots/` after you're happy so the deck is reproducible.
