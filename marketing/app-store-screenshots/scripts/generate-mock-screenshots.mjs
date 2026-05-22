/**
 * Generates Buffi-style in-app mock screenshots for the App Store editor.
 * Run: node scripts/generate-mock-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir, copyFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_IPHONE = join(ROOT, "public/screenshots/apple/iphone/en");
const OUT_ANDROID = join(ROOT, "public/screenshots/android/phone/en");
const BUFFI_PUBLIC = join(ROOT, "../../public");

const W = 570;
const H = 1024;

const baseCss = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600;1,700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    background: #080807;
    background-image: radial-gradient(ellipse at 50% 0%, rgba(82,217,208,0.12) 0%, transparent 70%);
    color: #f2e8cc;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 300;
    padding: 52px 22px 28px;
  }
  .brand { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 28px; color: #52d9d0; margin-bottom: 28px; }
  .item { margin-bottom: 18px; }
  .item-name { font-size: 15px; font-weight: 400; line-height: 1.35; }
  .item-meta { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: #8a8070; text-transform: uppercase; margin-top: 4px; }
  .eyebrow { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2.5px; color: #8a8070; text-transform: uppercase; margin-bottom: 14px; }
  .panel { border: 1px solid #222220; background: #141412; padding: 4px 18px; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid #222220; }
  .row:last-child { border-bottom: none; }
  .key { font-size: 12px; color: #a89e86; }
  .val { font-family: 'DM Mono', monospace; font-size: 13px; color: #f2e8cc; }
  .val.teal { color: #52d9d0; }
  .val.red { color: #e8604a; }
  .val.amber { color: #e8a040; }
  .verdict { border: 2px solid; padding: 16px 18px; margin-bottom: 22px; }
  .verdict.trap { border-color: #e8604a; background: rgba(232,96,74,0.05); }
  .verdict.win { border-color: #52d9d0; background: rgba(82,217,208,0.12); }
  .verdict-eyebrow { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 2px; color: #8a8070; text-transform: uppercase; margin-bottom: 6px; }
  .verdict-text { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 34px; font-weight: 700; line-height: 1; }
  .verdict.trap .verdict-text { color: #e8604a; }
  .verdict.win .verdict-text { color: #52d9d0; }
  .verdict-sub { font-size: 12px; color: #8a8070; margin-top: 10px; line-height: 1.45; }
  .fiber { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #222220; }
  .fiber:last-child { border-bottom: none; }
  .fiber-name { font-size: 13px; }
  .fiber-pct { font-family: 'DM Mono', monospace; font-size: 13px; color: #52d9d0; }
  .badge { display: inline-block; font-size: 10px; padding: 3px 8px; border-radius: 999px; border: 1px solid #2c2c28; color: #a89e86; margin-left: 8px; }
  .scan-zone { border: 1px dashed #52d9d0; border-radius: 8px; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(82,217,208,0.06); margin: 24px 0; }
  .scan-icon { width: 48px; height: 48px; border: 2px solid #52d9d0; border-radius: 50%; opacity: 0.7; }
  .scan-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #52d9d0; text-transform: uppercase; }
  .url-box { border: 1px solid #2c2c28; background: #111110; padding: 14px 16px; margin-top: 16px; }
  .url-text { font-family: 'DM Mono', monospace; font-size: 11px; color: #c4b88a; word-break: break-all; }
  .alt-card { display: flex; gap: 14px; border: 1px solid #2c2c28; background: #141412; padding: 14px; margin-bottom: 10px; }
  .alt-img { width: 64px; height: 64px; background: #2c2c28; border-radius: 4px; flex-shrink: 0; }
  .alt-title { font-size: 13px; line-height: 1.35; margin-bottom: 4px; }
  .alt-price { font-family: 'DM Mono', monospace; font-size: 12px; color: #52d9d0; }
  .alt-markup { font-family: 'DM Mono', monospace; font-size: 10px; color: #8a8070; margin-top: 4px; }
  .markup-hero { text-align: center; padding: 28px 0 20px; }
  .markup-big { font-family: 'DM Mono', monospace; font-size: 42px; font-weight: 500; color: #e8604a; letter-spacing: -1px; }
  .markup-vs { font-size: 11px; color: #8a8070; margin: 8px 0; letter-spacing: 3px; text-transform: uppercase; }
  .markup-retail { font-family: 'DM Mono', monospace; font-size: 22px; color: #f2e8cc; }
`;

const screens = {
  "03-materials": `
    <motion.div class="brand">Buffi</motion.div>
    <motion.div class="item">
      <div class="item-name">Cashmere Crew — Everlane</motion.div>
      <motion.div class="item-meta">$168 · scanned from tag</motion.div>
    </motion.div>
    <motion.div class="eyebrow">Fiber composition</motion.div>
    <motion.div class="panel">
      <motion.div class="fiber"><span class="fiber-name">Wool <span class="badge">Natural</span></span><span class="fiber-pct">78%</span></motion.div>
      <motion.div class="fiber"><span class="fiber-name">Nylon <span class="badge">Synthetic</span></span><span class="fiber-pct">22%</span></motion.div>
    </motion.div>
    <motion.div style="margin-top:18px;font-size:12px;color:#8a8070;line-height:1.5">
      Sourced from Mongolia &amp; China mills · certified RWS wool
    </motion.div>
    <motion.div class="eyebrow" style="margin-top:28px">What you're paying for</motion.div>
    <motion.div class="panel">
      <motion.div class="row"><span class="key">Premium natural fibers</span><span class="val teal">78%</span></motion.div>
      <motion.div class="row"><span class="key">Petroleum synthetics</span><span class="val">22%</span></motion.div>
    </motion.div>
  `,
  "04-markup": `
    <motion.div class="brand">Buffi</motion.div>
    <motion.div class="item">
      <div class="item-name">Cashmere Crew — Everlane</div>
      <motion.div class="item-meta">Retail · $168</motion.div>
    </motion.div>
    <motion.div class="eyebrow">The receipt</motion.div>
    <motion.div class="markup-hero">
      <motion.div style="font-size:11px;color:#8a8070;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Estimated cost to make</motion.div>
      <motion.div class="markup-big">$18</motion.div>
      <motion.div class="markup-vs">vs</motion.div>
      <motion.div class="markup-retail">$168 retail</motion.div>
    </motion.div>
    <motion.div class="panel">
      <motion.div class="row"><span class="key">Markup</span><span class="val red">+833%</span></motion.div>
      <motion.div class="row"><span class="key">Cost per wear (est.)</span><span class="val">$2.80</span></motion.div>
      <motion.div class="row"><span class="key">Brand premium</span><span class="val amber">High</span></motion.div>
    </motion.div>
    <motion.div style="margin-top:16px;font-size:12px;color:#8a8070;line-height:1.45">
      The tag tells you what. We tell you why it costs that much.
    </motion.div>
  `,
  "05-alternatives": `
    <motion.div class="brand">Buffi</motion.div>
    <motion.div class="verdict trap">
      <motion.div class="verdict-eyebrow">Our Verdict</motion.div>
      <motion.div class="verdict-text">Not worth it.</motion.div>
      <motion.div class="verdict-sub">Steep markup on synthetic materials — you deserved to know.</motion.div>
    </motion.div>
    <motion.div class="eyebrow">Better alternatives</motion.div>
    <motion.div style="font-family:'DM Mono',monospace;font-size:9px;color:#8a8070;margin:-8px 0 14px;line-height:1.45">
      Comparable quality · fairer markup · independent brands
    </motion.div>
    <motion.div class="alt-card">
      <motion.div class="alt-img"></motion.div>
      <motion.div>
        <motion.div class="alt-title">Merino Crew — Uniqlo U</motion.div>
        <motion.div class="alt-price">$49</motion.div>
        <motion.div class="alt-markup">+120% markup · Worth It.</motion.div>
      </motion.div>
    </motion.div>
    <motion.div class="alt-card">
      <motion.div class="alt-img"></motion.div>
      <motion.div>
        <motion.div class="alt-title">Organic Cotton Knit — Kotn</motion.div>
        <motion.div class="alt-price">$68</motion.div>
        <motion.div class="alt-markup">+95% markup · Think Twice.</motion.div>
      </motion.div>
    </motion.div>
  `,
};

function wrap(body) {
  const html = body.replaceAll("motion.", "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>${html}</body></html>`;
}

async function main() {
  await mkdir(OUT_IPHONE, { recursive: true });
  await mkdir(OUT_ANDROID, { recursive: true });
  await copyFile(join(BUFFI_PUBLIC, "screenshots/breakdown.png"), join(OUT_IPHONE, "01-hero.png"));
  await copyFile(join(BUFFI_PUBLIC, "screenshots/scan.png"), join(OUT_IPHONE, "02-scan.png"));
  await copyFile(join(OUT_IPHONE, "01-hero.png"), join(OUT_ANDROID, "01-hero.png"));
  await copyFile(join(OUT_IPHONE, "02-scan.png"), join(OUT_ANDROID, "02-scan.png"));
  await copyFile(join(BUFFI_PUBLIC, "og-image.png"), join(ROOT, "public/app-icon.png"));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  for (const [name, body] of Object.entries(screens)) {
    const html = wrap(body);
    const tmp = join(ROOT, "scripts", `.tmp-${name}.html`);
    await writeFile(tmp, html);
    await page.goto(`file://${tmp}`);
    await page.waitForTimeout(800);
    for (const dir of [OUT_IPHONE, OUT_ANDROID]) {
      await page.screenshot({ path: join(dir, `${name}.png`), type: "png" });
    }
  }

  await browser.close();
  console.log("Wrote screenshots to", OUT_IPHONE, "and", OUT_ANDROID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
