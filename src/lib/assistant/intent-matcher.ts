import type { ResourceId } from "@/types";
import type { Entities, Intent, IntentResult, NormalizedQuery } from "./types";
import {
  INGREDIENT_ALIASES,
  INTENT_PRIORITY,
  INTENT_RULES,
  INTENT_THRESHOLD,
  PRODUCT_ALIASES,
  STOCK_WORDS,
  STOPWORDS,
  SYNONYMS,
} from "./knowledge-base";

/** Light, deterministic stemming: plural "s" only. */
export function stem(word: string): string {
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) return word.slice(0, -1);
  return word;
}

export function canonical(word: string): string {
  return SYNONYMS[word] ?? SYNONYMS[stem(word)] ?? stem(word);
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/₹/g, " rupees ")
    .replace(/what's/g, "whats")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQuery(query: string): NormalizedQuery {
  const normalized = normalizeText(query);
  const tokens = normalized ? normalized.split(" ") : [];
  const keywords = tokens.filter((t) => !STOPWORDS.has(t));
  const synonymHits: NormalizedQuery["synonymHits"] = [];
  const expanded = new Set<string>();
  for (const k of keywords) {
    expanded.add(stem(k));
    const c = canonical(k);
    if (c !== stem(k)) synonymHits.push({ from: k, to: c });
    expanded.add(c);
  }
  return { original: query, normalized, tokens, keywords, expanded: [...expanded], synonymHits };
}

function findAliases<K extends string>(text: string, table: Record<K, string[]>): { found: K[]; rest: string } {
  const entries = (Object.entries(table) as Array<[K, string[]]>)
    .flatMap(([id, aliases]) => aliases.map((alias) => ({ id, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  let rest = ` ${text} `;
  const found: K[] = [];
  for (const { id, alias } of entries) {
    const needle = ` ${alias} `;
    const at = rest.indexOf(needle);
    if (at === -1) continue;
    if (!found.includes(id)) found.push(id);
    rest = rest.slice(0, at) + " " + "_".repeat(alias.length) + " " + rest.slice(at + needle.length);
  }
  return { found, rest };
}

/** Extracts product and ingredient entities. Products consume their span first. */
export function extractEntities(nq: NormalizedQuery): Entities {
  const { found: products, rest } = findAliases(nq.normalized, PRODUCT_ALIASES);
  const { found: ingredients } = findAliases(rest, INGREDIENT_ALIASES);

  // "cup of tea" is not about the cup resource.
  if (ingredients.includes("cups") && /\bcup of\b/.test(nq.normalized)) ingredients.splice(ingredients.indexOf("cups"), 1);
  // Bare "coffee" + a stock word means the coffee-bean resource.
  if (!ingredients.includes("coffee") && /\bcoffee\b/.test(rest) && STOCK_WORDS.some((w) => nq.tokens.includes(w))) {
    ingredients.push("coffee" as ResourceId);
  }
  // Order of first appearance keeps comparisons stable ("flat white vs cappuccino").
  const position = (id: string) => Math.min(...PRODUCT_ALIASES[id].map((a) => nq.normalized.indexOf(a)).filter((i) => i >= 0));
  products.sort((a, b) => position(a) - position(b));
  return { products, ingredients };
}

const ZERO = (): Record<Intent, number> =>
  Object.fromEntries(INTENT_PRIORITY.map((i) => [i, 0])) as Record<Intent, number>;

/** Keyword/phrase scoring with a few contextual boosts. Deterministic. */
export function classifyIntent(nq: NormalizedQuery, entities: Entities): IntentResult {
  const scores = ZERO();
  const signals: string[] = [];
  const text = ` ${nq.normalized} `;
  const terms = new Set(nq.expanded);
  const has = (t: string) => (t.includes(" ") ? text.includes(` ${t} `) : terms.has(t) || text.includes(` ${t} `));

  for (const [intent, rules] of Object.entries(INTENT_RULES) as Array<[Intent, Array<{ term: string; weight: number }>]>) {
    for (const rule of rules) {
      if (has(rule.term)) {
        scores[intent] += rule.weight;
        signals.push(`${intent}:${rule.term}`);
      }
    }
  }

  const boost = (intent: Intent, amount: number, why: string) => {
    scores[intent] += amount;
    signals.push(`${intent}:+${why}`);
  };
  const ing = entities.ingredients.length > 0;
  const prod = entities.products.length > 0;
  const stockish = has("stock") || has("how much") || has("how many");
  const superlative = has("most") || has("least") || has("highest") || has("lowest");

  if (ing && stockish && !superlative) boost("INVENTORY_LOOKUP", 3, "ingredient+stock");
  if (prod && has("how much") && !ing) boost("PRICE_LOOKUP", 2, "product+how much");
  if (entities.products.length >= 2) boost("PRODUCT_COMPARISON", 2.5, "two products");
  if (ing && superlative) boost("INGREDIENT_LOOKUP", 3, "superlative+ingredient");
  if (prod && (has("recipe") || has("ingredient"))) boost("RECIPE_LOOKUP", 1, "product+recipe");
  if (has("why") && (has("dispense") || has("not working"))) boost("MACHINE_STATUS", 2, "why+dispense");
  if (has("why") && has("reject")) boost("ORDER_HELP", 2, "why+rejected");
  if (has("can i order") && prod) boost("ORDER_HELP", 1.5, "availability");
  if (has("drinks") && has("served")) boost("SALES_SUMMARY", 1, "drinks served");

  let best: Intent = "FALLBACK";
  let bestScore = 0;
  for (const intent of INTENT_PRIORITY) {
    if (scores[intent] > bestScore) {
      best = intent;
      bestScore = scores[intent];
    }
  }
  const second = Math.max(0, ...INTENT_PRIORITY.filter((i) => i !== best).map((i) => scores[i]));
  if (bestScore < INTENT_THRESHOLD) {
    // A product alone ("latte?") is most usefully a recipe lookup.
    if (prod && bestScore < INTENT_THRESHOLD) {
      scores.RECIPE_LOOKUP += INTENT_THRESHOLD;
      signals.push("RECIPE_LOOKUP:+bare product");
      return { intent: "RECIPE_LOOKUP", confidence: 0.55, scores, signals, rescued: false };
    }
    return { intent: "FALLBACK", confidence: 0, scores, signals, rescued: false };
  }
  const confidence = Math.round((bestScore / (bestScore + second)) * 100) / 100;
  return { intent: best, confidence, scores, signals, rescued: false };
}
