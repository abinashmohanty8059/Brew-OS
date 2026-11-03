/* Turns a spoken sentence into cart actions.
   "coffee" -> 1 Americano, "two cappuccinos and a latte" -> 2 Cappuccino + 1 Latte,
   "checkout" / "pay" -> open checkout, "clear my order" -> empty the cart.
   Pure and synchronous so it can be unit tested without a microphone. */

import { PRODUCT_ALIASES } from "@/lib/assistant/knowledge-base";
import { getProduct } from "@/data/products";

export interface VoiceItem {
  productId: string;
  quantity: number;
  /** The words that matched, e.g. "coffee" — used to explain generic picks. */
  heard: string;
}

export type VoiceCommand =
  | { kind: "add"; items: VoiceItem[]; checkout: boolean }
  | { kind: "checkout" }
  | { kind: "clear" }
  | { kind: "unknown"; text: string };

/** Generic words people say at a counter, mapped to a sensible default drink. */
const GENERIC_ALIASES: Record<string, string[]> = {
  americano: ["coffee", "coffees", "black coffee", "hot coffee", "regular coffee", "normal coffee", "filter coffee", "kaapi", "kofi"],
  latte: ["milk coffee", "white coffee"],
  cappuccino: ["cappuccino coffee", "cap", "capu", "kapuchino", "cappuchino", "capuchino", "cappucchino", "capucchino"],
  "hot-chocolate": ["chocolate"],
  "bottled-water": ["water", "waters", "bottle of water"],
  tea: ["teas", "cup of tea"],
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, to: 2, too: 2, couple: 2, double: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const CHECKOUT_WORDS = /\b(checkout|check out|pay|payment|place (the |my )?order|confirm|that'?s all|done|proceed)\b/;
const CLEAR_WORDS = /\b(clear|cancel|empty|reset|remove everything|start over)\b/;

/** Every alias -> product id, longest first so "cold coffee" wins over "coffee". */
const ALIAS_TABLE: [string, string][] = (() => {
  const rows: [string, string][] = [];
  for (const source of [PRODUCT_ALIASES, GENERIC_ALIASES]) {
    for (const [id, aliases] of Object.entries(source)) {
      if (!getProduct(id)) continue;
      for (const a of aliases) rows.push([a, id]);
    }
  }
  return rows.sort((x, y) => y[0].length - x[0].length);
})();

/** Aliases with spaces removed ("flatwhite", "hotchocolate") -> the spoken alias. */
const SQUASHED_ALIASES = new Map(ALIAS_TABLE.map(([alias]) => [alias.replace(/ /g, ""), alias]));

/** Joins a drink spelled out letter by letter: "l a t t e" -> "latte",
    "a l a t t e" -> "a latte", "h o t c h o c o l a t e" -> "hot chocolate". */
function joinSpelledLetters(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let j = i;
    while (j < words.length && /^[a-z]$/.test(words[j])) j++;
    if (j - i < 3) {
      out.push(words[i]);
      i++;
      continue;
    }
    const joined = words.slice(i, j).join("");
    const known = SQUASHED_ALIASES.get(joined);
    const withoutArticle = joined.startsWith("a") ? SQUASHED_ALIASES.get(joined.slice(1)) : undefined;
    if (known) out.push(known);
    else if (withoutArticle) out.push("a", withoutArticle);
    else {
      // misheard letters ("p o s s e e" for "c o f f e e"): take the closest drink name
      const guess = closestAlias(joined);
      out.push(guess ?? joined);
    }
    i = j;
  }
  return out;
}

/** Letters that sound alike when spelled aloud, so speech recognition mixes them up. */
const SOUND_ALIKE = ["bcdegptvz", "fsx", "mn", "ajk", "iy", "quw", "lr"];
const GROUP = new Map<string, number>();
SOUND_ALIKE.forEach((g, n) => [...g].forEach((ch) => GROUP.set(ch, n)));

function letterScore(a: string, b: string): number {
  if (a === b) return 1;
  const ga = GROUP.get(a);
  return ga !== undefined && ga === GROUP.get(b) ? 0.8 : 0;
}

/** How alike two spellings are, 0..1: longest common (sound-alike) subsequence over the longer length. */
export function spellingSimilarity(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1] + letterScore(a[i - 1], b[j - 1]));
    }
  }
  return dp[a.length][b.length] / Math.max(a.length, b.length, 1);
}

/** Minimum share of letters that must match for a spelled word to count as a drink. */
export const SPELLING_THRESHOLD = 0.2;

function closestAlias(spelled: string): string | null {
  let best: { alias: string; score: number } | null = null;
  for (const [squashed, alias] of SQUASHED_ALIASES) {
    const score = spellingSimilarity(spelled, squashed);
    if (!best || score > best.score) best = { alias, score };
  }
  return best && best.score >= SPELLING_THRESHOLD ? best.alias : null;
}

export function normalizeSpeech(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(" ").filter(Boolean);
  return ` ${joinSpelledLetters(words).join(" ")} `;
}

/** Quantity spoken just before a match ("two", "2", "a couple of"). */
function quantityBefore(prefix: string): number {
  const words = prefix.trim().split(" ").filter((w) => w && w !== "of" && w !== "please" && w !== "cups" && w !== "cup");
  const last = words[words.length - 1];
  if (!last) return 1;
  if (/^\d+$/.test(last)) return Math.min(10, Math.max(1, Number(last)));
  return NUMBER_WORDS[last] ?? 1;
}

export function parseVoiceOrder(raw: string): VoiceCommand {
  let text = normalizeSpeech(raw);
  const found: (VoiceItem & { at: number })[] = [];

  for (const [alias, id] of ALIAS_TABLE) {
    const needle = ` ${alias} `;
    let idx = text.indexOf(needle);
    while (idx !== -1) {
      found.push({ productId: id, quantity: quantityBefore(text.slice(0, idx + 1)), heard: alias, at: idx });
      // consume the span so a shorter alias can't match inside it
      text = text.slice(0, idx + 1) + " ".repeat(alias.length) + text.slice(idx + 1 + alias.length);
      idx = text.indexOf(needle);
    }
  }

  const checkout = CHECKOUT_WORDS.test(text);
  if (found.length === 0) {
    if (CLEAR_WORDS.test(text)) return { kind: "clear" };
    if (checkout) return { kind: "checkout" };
    return { kind: "unknown", text: raw.trim() };
  }

  // merge repeats ("a latte and another latte") in spoken order
  const items: VoiceItem[] = [];
  for (const f of found.sort((a, b) => a.at - b.at)) {
    const same = items.find((i) => i.productId === f.productId);
    if (same) same.quantity += f.quantity;
    else items.push({ productId: f.productId, quantity: f.quantity, heard: f.heard });
  }
  return { kind: "add", items, checkout };
}
