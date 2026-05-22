/**
 * Generates placeholder PWA icons (dark square + teal B).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { createRequire } from "module";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const playwrightRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../marketing/app-store-screenshots/node_modules/playwright"
);
const { chromium } = require(playwrightRoot);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");

const html = (size) => `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px; height: ${size}px;
    background: #080807;
    display: flex; align-items: center; justify-content: center;
  }
  .b {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-style: italic;
    font-weight: 700;
    font-size: ${Math.round(size * 0.58)}px;
    line-height: 1;
    color: #52d9d0;
    margin-top: ${Math.round(size * 0.04)}px;
  }
</style></head>
<body><div class="b">B</div></body></html>`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size), { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(OUT, `icon-${size}.png`),
      type: "png",
      omitBackground: false,
    });
  }

  await browser.close();
  console.log("Wrote", join(OUT, "icon-192.png"), "and icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
