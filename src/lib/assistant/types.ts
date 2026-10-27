import type { Inventory, MachineSnapshot, Order, PackagedInventory, Rejection, ResourceId } from "@/types";

export type Intent =
  | "RECIPE_LOOKUP"
  | "PRICE_LOOKUP"
  | "INGREDIENT_LOOKUP"
  | "INVENTORY_LOOKUP"
  | "MACHINE_STATUS"
  | "CLEANING_HELP"
  | "PRODUCT_COMPARISON"
  | "LOW_STOCK"
  | "ORDER_HELP"
  | "SALES_SUMMARY"
  | "GENERAL_HELP"
  | "FALLBACK";

export type DocCategory =
  | "recipe"
  | "pricing"
  | "ingredient"
  | "cleaning"
  | "inventory"
  | "cups"
  | "operation"
  | "troubleshooting"
  | "comparison"
  | "ordering"
  | "payment"
  | "reporting"
  | "assistant";

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  category: DocCategory;
  tags: string[];
  /** Intents this document is relevant to (used by the intent-match score). */
  intents: Intent[];
  /** Product or resource ids this document is about (used by the entity score). */
  entities: string[];
  /** Static mock prior in [0,1]; only used to break ties deterministically. */
  prior: number;
}

export interface NormalizedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  keywords: string[];
  /** Keywords plus canonical synonyms. */
  expanded: string[];
  synonymHits: Array<{ from: string; to: string }>;
}

export interface Entities {
  products: string[];
  ingredients: ResourceId[];
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  scores: Record<Intent, number>;
  signals: string[];
  /** True when the intent was rescued from the top retrieved document. */
  rescued: boolean;
}

export interface RetrievalWeights {
  keyword: number;
  tag: number;
  intent: number;
  entity: number;
}

export interface ScoreBreakdown {
  keyword: number;
  tag: number;
  intent: number;
  entity: number;
}

export interface RetrievedDoc {
  doc: RagDocument;
  score: number;
  /** Raw component scores in [0,1] (before weighting). */
  breakdown: ScoreBreakdown;
  matchedTerms: string[];
  highlights: string[];
}

export interface Slot {
  name: string;
  value: string;
  source: "knowledge" | "live" | "query";
}

export interface QueryTrace {
  id: string;
  at: number;
  query: string;
  normalized: NormalizedQuery;
  entities: Entities;
  intent: IntentResult;
  retrieval: {
    candidates: number;
    weights: RetrievalWeights;
    top: RetrievedDoc[];
  };
  context: string;
  template: { id: string; text: string };
  slots: Slot[];
  answer: string;
}

/** The live application state the assistant may read. */
export interface AssistantSnapshot {
  inventory: Inventory;
  packaged: PackagedInventory;
  machine: MachineSnapshot;
  orders: Order[];
  lastRejection: Rejection | null;
  speed: number;
}
