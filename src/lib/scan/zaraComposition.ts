/**
 * Zara PDPs list shell, lining, and sleeve compositions separately.
 * Prefer OUTER SHELL (main fabric) only — never merge lining / sleeves into main materials.
 */

const FIBER_WORD =
  "linen|cotton|wool|silk|polyester|nylon|viscose|elastane|spandex|modal|acetate|cashmere|leather|ramie|hemp|lyocell|tencel|polyamide|acrylic";

/** Zara section headers — uppercase blocks; avoids "interior lining" in marketing copy. */
const ZARA_SECTION_BOUNDARY_RE = /(?:^|[\n\r>])\s*(?:LINING|BODY|SLEEVES|DOUBLURE)\b|\s+(?:LINING|BODY|SLEEVES|DOUBLURE)\b/g;
const ZARA_OUTER_SHELL_START_RE = /OUTER\s+SHELL/i;

function firstZaraSectionBoundaryIndex(text: string, fromIndex = 0): number {
  ZARA_SECTION_BOUNDARY_RE.lastIndex = fromIndex;
  const m = ZARA_SECTION_BOUNDARY_RE.exec(text);
  return m ? m.index : -1;
}

function hasZaraSectionBoundary(text: string): boolean {
  return firstZaraSectionBoundaryIndex(text) >= 0;
}

/** Parse "50% wool" / "50 % wool" lines into a care-label-style string. */
export function extractPercentFiberLines(block: string): string | undefined {
  const fibers: string[] = [];
  const lineRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%\\s*(${FIBER_WORD})\\b`, "gi");
  for (const line of block.split(/\n/)) {
    const trimmed = line.trim().replace(/^[-•*]\s*/, "");
    if (!trimmed) continue;
    let match: RegExpExecArray | null;
    lineRe.lastIndex = 0;
    while ((match = lineRe.exec(trimmed)) !== null) {
      const pct = match[1];
      const fiber = match[2].trim();
      const entry = `${pct}% ${fiber.charAt(0).toUpperCase()}${fiber.slice(1).toLowerCase()}`;
      if (!fibers.includes(entry)) fibers.push(entry);
    }
  }
  if (!fibers.length) {
    lineRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(block)) !== null) {
      const pct = match[1];
      const fiber = match[2].trim();
      const entry = `${pct}% ${fiber.charAt(0).toUpperCase()}${fiber.slice(1).toLowerCase()}`;
      if (!fibers.includes(entry)) fibers.push(entry);
    }
  }
  if (!fibers.length) return undefined;
  return fibers.join(", ");
}

/** Slice the OUTER SHELL block from Zara HTML or flattened composition text. */
export function sliceZaraOuterShellBlock(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;

  const outerMatch = ZARA_OUTER_SHELL_START_RE.exec(t);
  if (outerMatch) {
    let rest = t.slice(outerMatch.index + outerMatch[0].length);
    const endIdx = firstZaraSectionBoundaryIndex(rest);
    if (endIdx >= 0) rest = rest.slice(0, endIdx);
    return rest.trim();
  }

  const firstSection = firstZaraSectionBoundaryIndex(t);
  if (firstSection > 0) {
    return t.slice(0, firstSection).trim();
  }

  return undefined;
}

export function hasZaraSubcomponentSections(text: string): boolean {
  return hasZaraSectionBoundary(text) || ZARA_OUTER_SHELL_START_RE.test(text);
}

/** Extract main (outer shell) composition from Zara HTML or composition text. */
export function parseZaraOuterShellComposition(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;

  const outerBlock = sliceZaraOuterShellBlock(t);
  if (outerBlock) {
    const fromBlock = extractPercentFiberLines(outerBlock);
    if (fromBlock) return fromBlock;
  }

  if (!hasZaraSubcomponentSections(t)) {
    const flat = extractPercentFiberLines(t);
    if (!flat) return undefined;
    const fiberCount = flat.split(",").length;
    const sum = sumPercentsInString(flat);
    // Merged lining/sleeves blocks often have 3+ fibers or % totals well over 100.
    if (fiberCount > 2 || sum > 105) return undefined;
    return flat;
  }

  return undefined;
}

function sumPercentsInString(s: string): number {
  let sum = 0;
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) sum += parseFloat(m[1]) || 0;
  return sum;
}

/** Prefer outer-shell-like strings; deprioritize lining / sleeves blocks from JSON walks. */
export function pickCompositionFromStrings(strings: string[]): string | undefined {
  const scored = strings
    .map((s) => {
      const lower = s.toLowerCase();
      const pctCount = (s.match(/\d+\s*%/g) || []).length;
      const fiber = new RegExp(FIBER_WORD, "i").test(s);
      let score = pctCount * 3 + (fiber ? 5 : 0) - Math.min(s.length / 80, 3);

      if (/(outer\s+shell|outer\s+fabric|main\s+fabric)/i.test(s)) score += 12;
      const sum = sumPercentsInString(s);
      if (sum >= 95 && sum <= 105 && pctCount >= 1 && pctCount <= 3) score += 8;
      if (hasZaraSectionBoundary(s) && !/outer\s+shell/i.test(s)) score -= 15;
      if (pctCount > 3) score -= 10;

      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { s } of scored) {
    const parsed = parseZaraOuterShellComposition(s);
    if (parsed) return parsed;
  }
  return undefined;
}
