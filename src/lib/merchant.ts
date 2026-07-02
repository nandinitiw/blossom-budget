// Merchant string enrichment: turn raw bank descriptors like
// "SQ *BLUE BOTTLE COFFEE #4471" into "Blue Bottle Coffee".

const PROCESSOR_PREFIXES = [
  /^sq\s*\*\s*/i, // Square
  /^tst\s*\*?\s*/i, // Toast
  /^py\s*\*\s*/i,
  /^paypal\s*\*\s*/i,
  /^pp\s*\*\s*/i,
  /^ach\s+/i,
  /^pos\s+/i,
  /^dd\s+/i, // direct deposit
  /^sp\s+/i, // Shopify
  /^gpay\s*\*?\s*/i,
  /^apl\s*\*\s*/i, // Apple Pay
  /^ext\s*\*\s*/i,
  /^int\s*\*\s*/i,
  /^wl\s*\*\s*/i,
  /^zelle\s+(to|from)\s+/i,
];

const NOISE_PATTERNS = [
  /#\s*\d+/g, // store numbers: #4471
  /\b\d{4,}\b/g, // long digit runs (ref numbers)
  /\bx{2,}\d*\b/gi, // masked digits: XXXX1234
  /\s+\b[A-Z]{2}\b$/, // trailing state code
  /\.(com|net|org)\b/gi,
  /\*/g,
];

const KEEP_UPPER = new Set(["USA", "ATM", "IRS", "AMC", "UPS", "USPS", "DMV", "H&M"]);

function titleCase(word: string): string {
  if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase();
  if (word.length <= 2 && word === word.toUpperCase()) return word; // "of", "LA"…leave short tokens
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Human-readable display name from a raw bank/Plaid descriptor. */
export function cleanMerchantName(raw: string): string {
  let s = raw.trim();
  for (const p of PROCESSOR_PREFIXES) s = s.replace(p, "");
  for (const p of NOISE_PATTERNS) s = s.replace(p, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s) return raw.trim();

  // Only re-case strings that look like SHOUTING bank descriptors
  if (s === s.toUpperCase()) {
    s = s
      .split(" ")
      .map((w) => titleCase(w))
      .join(" ");
  }
  return s;
}

/**
 * Stable key for grouping the "same" merchant across transactions —
 * used by merchant category rules and recurring detection.
 */
export function normalizeMerchantKey(name: string): string {
  return cleanMerchantName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 64);
}
