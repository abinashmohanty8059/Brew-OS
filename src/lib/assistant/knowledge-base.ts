import type { ResourceId } from "@/types";
import type { RetrievalWeights } from "./types";

/* Hard-coded lexical knowledge for the offline assistant. Product facts
   themselves live in the central catalogue (src/data). */

/** Configurable, illustrative retrieval weights — not measured accuracy. */
export const RETRIEVAL_WEIGHTS: RetrievalWeights = { keyword: 0.5, tag: 0.2, intent: 0.2, entity: 0.1 };

/** Below this intent score the query is treated as unmatched. */
export const INTENT_THRESHOLD = 1.5;

export const STOPWORDS = new Set(
  "a an the is are was were be been am i me my we our you your it its this that these those of in on at to for from with and or but do does did can could would should will shall have has had what which who whom how why when where there here please tell show give about any some much many right now just get got let us".split(
    " ",
  ),
);

/** token → canonical term. Applied after stopword removal. */
export const SYNONYMS: Record<string, string> = {
  beans: "coffee",
  bean: "coffee",
  grounds: "coffee",
  cost: "price",
  costs: "price",
  priced: "price",
  prices: "price",
  rupees: "price",
  rupee: "price",
  rs: "price",
  inr: "price",
  pay: "payment",
  paid: "payment",
  cheap: "cheapest",
  cheaper: "cheapest",
  lowest: "cheapest",
  expensive: "priciest",
  costliest: "priciest",
  dearest: "priciest",
  left: "stock",
  remaining: "stock",
  remain: "stock",
  level: "stock",
  levels: "stock",
  available: "stock",
  inventory: "stock",
  cleaning: "clean",
  cleaned: "clean",
  rinse: "clean",
  flush: "clean",
  descale: "clean",
  sanitise: "clean",
  sanitize: "clean",
  wash: "clean",
  make: "recipe",
  making: "recipe",
  made: "recipe",
  prepare: "recipe",
  prepared: "recipe",
  brew: "recipe",
  steps: "recipe",
  ingredients: "ingredient",
  contain: "ingredient",
  contains: "ingredient",
  needed: "ingredient",
  need: "ingredient",
  needs: "ingredient",
  compare: "compare",
  comparison: "compare",
  difference: "compare",
  different: "compare",
  differ: "compare",
  vs: "compare",
  versus: "compare",
  running: "low",
  shortage: "low",
  short: "low",
  empty: "low",
  replenish: "restock",
  refill: "restock",
  reload: "restock",
  revenue: "revenue",
  sales: "revenue",
  earned: "revenue",
  earnings: "revenue",
  income: "revenue",
  money: "revenue",
  sold: "served",
  serve: "served",
  served: "served",
  ready: "status",
  working: "status",
  state: "status",
  broken: "fault",
  error: "fault",
  dispensing: "dispense",
  dispensed: "dispense",
  buy: "order",
  purchase: "order",
  ordering: "order",
  orders: "order",
  rejected: "reject",
  declined: "reject",
  failed: "reject",
  denied: "reject",
  cups: "cup",
  chai: "chai",
};

/** Product aliases. Longer aliases are matched first and consume their span. */
export const PRODUCT_ALIASES: Record<string, string[]> = {
  espresso: ["espresso", "expresso", "double shot"],
  americano: ["americano", "long black"],
  cappuccino: ["cappuccino", "cappucino", "capuccino", "cappuccinos"],
  latte: ["latte", "cafe latte", "lattes"],
  "flat-white": ["flat white", "flatwhite", "flat whites"],
  macchiato: ["macchiato", "machiato"],
  mocha: ["mocha", "mochaccino", "mochas"],
  "cold-coffee": ["cold coffee", "iced coffee", "frappe"],
  "iced-latte": ["iced latte", "ice latte"],
  "hot-chocolate": ["hot chocolate", "hot choc", "hot cocoa", "drinking chocolate"],
  tea: ["tea", "chai tea", "milk tea", "plain tea"],
  "masala-chai": ["masala chai", "chai", "masala tea", "spiced tea"],
  "green-tea": ["green tea"],
  "lemon-tea": ["lemon tea"],
  "bottled-water": ["bottled water", "water bottle", "mineral water"],
  "chocolate-bar": ["chocolate bar", "choco bar", "candy bar"],
  cookies: ["cookies", "cookie", "oat cookies"],
  croissant: ["croissant", "croissants"],
  muffin: ["muffin", "muffins", "blueberry muffin"],
  sandwich: ["sandwich", "sandwiches", "paneer sandwich"],
};

export const INGREDIENT_ALIASES: Record<ResourceId, string[]> = {
  coffee: ["coffee beans", "beans", "bean", "grounds", "coffee stock"],
  milk: ["milk", "dairy"],
  water: ["water"],
  sugar: ["sugar", "sweetener"],
  chocolate: ["chocolate", "cocoa", "choc"],
  tea: ["tea leaves", "leaves", "tea stock"],
  spice: ["masala blend", "masala", "spices", "spice"],
  ice: ["ice"],
  cups: ["cups", "cup"],
  cleaningAgent: ["cleaning agent", "cleaning solution", "detergent", "cleaner", "agent"],
};

/** Words that mean "how much is left" — turn bare "coffee" into the bean resource. */
export const STOCK_WORDS = ["left", "remaining", "remain", "stock", "level", "levels", "inventory", "much", "many"];

export interface IntentRule {
  /** Canonical keyword or a phrase matched against the normalized text. */
  term: string;
  weight: number;
}

export const INTENT_RULES: Record<Exclude<import("./types").Intent, "FALLBACK">, IntentRule[]> = {
  RECIPE_LOOKUP: [
    { term: "recipe", weight: 2.5 },
    { term: "how do i make", weight: 3 },
    { term: "how to make", weight: 3 },
    { term: "how is", weight: 1 },
    { term: "how do you make", weight: 3 },
  ],
  PRICE_LOOKUP: [
    { term: "price", weight: 3 },
    { term: "cheapest", weight: 3 },
    { term: "priciest", weight: 3 },
    { term: "how much is", weight: 1.5 },
    { term: "how much does", weight: 2 },
    { term: "how much for", weight: 2 },
  ],
  INGREDIENT_LOOKUP: [
    { term: "ingredient", weight: 3 },
    { term: "what is in", weight: 2.5 },
    { term: "whats in", weight: 2.5 },
    { term: "made of", weight: 2.5 },
    { term: "most", weight: 1.5 },
    { term: "least", weight: 1.5 },
    { term: "highest", weight: 1 },
  ],
  INVENTORY_LOOKUP: [
    { term: "stock", weight: 2.5 },
    { term: "how much", weight: 0.75 },
    { term: "how many", weight: 0.75 },
    { term: "current inventory", weight: 3 },
  ],
  MACHINE_STATUS: [
    { term: "status", weight: 2.5 },
    { term: "dispense", weight: 2 },
    { term: "fault", weight: 2.5 },
    { term: "not working", weight: 3 },
    { term: "machine", weight: 1 },
    { term: "is the machine", weight: 1 },
  ],
  CLEANING_HELP: [
    { term: "clean", weight: 3.5 },
    { term: "cleaning mode", weight: 2 },
    { term: "maintenance", weight: 2 },
  ],
  PRODUCT_COMPARISON: [
    { term: "compare", weight: 4 },
    { term: "better", weight: 1.5 },
    { term: "or a", weight: 0.5 },
  ],
  LOW_STOCK: [
    { term: "low", weight: 3 },
    { term: "running out", weight: 3 },
    { term: "running low", weight: 3 },
    { term: "restock", weight: 2.5 },
  ],
  ORDER_HELP: [
    { term: "order", weight: 1.5 },
    { term: "can i order", weight: 3 },
    { term: "can i get", weight: 3 },
    { term: "can i have", weight: 2.5 },
    { term: "reject", weight: 4 },
    { term: "payment", weight: 2 },
    { term: "receipt", weight: 2 },
    { term: "what can i", weight: 2 },
    { term: "menu", weight: 2 },
  ],
  SALES_SUMMARY: [
    { term: "revenue", weight: 4 },
    { term: "served", weight: 3 },
    { term: "how many drinks", weight: 2 },
    { term: "how many order", weight: 2.5 },
    { term: "sales", weight: 3 },
  ],
  GENERAL_HELP: [
    { term: "help", weight: 2 },
    { term: "hello", weight: 2 },
    { term: "hi", weight: 2 },
    { term: "hey", weight: 2 },
    { term: "what can you do", weight: 4 },
    { term: "who are you", weight: 3 },
    { term: "thanks", weight: 2 },
    { term: "thank you", weight: 2 },
  ],
};

/** Fixed tie-break order so classification is deterministic. */
export const INTENT_PRIORITY: Array<import("./types").Intent> = [
  "PRODUCT_COMPARISON",
  "CLEANING_HELP",
  "LOW_STOCK",
  "SALES_SUMMARY",
  "INVENTORY_LOOKUP",
  "ORDER_HELP",
  "MACHINE_STATUS",
  "PRICE_LOOKUP",
  "INGREDIENT_LOOKUP",
  "RECIPE_LOOKUP",
  "GENERAL_HELP",
  "FALLBACK",
];

export const SAMPLE_QUESTIONS = [
  "How much milk is left?",
  "What is the recipe for cold coffee?",
  "Why is the machine not dispensing?",
  "Which coffee has the most milk?",
  "Difference between a flat white and a cappuccino?",
  "Which ingredients are running low?",
  "Can I order a mocha?",
  "How much revenue has been generated?",
];
