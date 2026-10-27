import { describe, expect, it } from "vitest";
import type { Inventory } from "@/types";
import { INITIAL_INVENTORY, INITIAL_PACKAGED } from "@/data/initial-inventory";
import { RAG_DOCUMENTS } from "@/data/rag-documents";
import type { AssistantSnapshot, Intent } from "./types";
import { runAssistantQuery } from "./pipeline";

function snapshot(patch: Partial<AssistantSnapshot> = {}): AssistantSnapshot {
  return {
    inventory: structuredClone(INITIAL_INVENTORY),
    packaged: structuredClone(INITIAL_PACKAGED),
    machine: { state: "IDLE", prep: null, cleaning: null, error: null, lastCompletedOrderId: null, lastCleanedAt: null, ordersSinceClean: 0 },
    orders: [],
    lastRejection: null,
    speed: 1,
    ...patch,
  };
}

const ask = (q: string, snap = snapshot()) => runAssistantQuery(q, snap, 1_700_000_000_000, "t");

describe("intent classification for the spec's example questions", () => {
  const cases: Array<[string, Intent]> = [
    ["What is the recipe for cold coffee?", "RECIPE_LOOKUP"],
    ["How do I make a cappuccino?", "RECIPE_LOOKUP"],
    ["How much milk is left?", "INVENTORY_LOOKUP"],
    ["Why is the machine not dispensing?", "MACHINE_STATUS"],
    ["How many cups are remaining?", "INVENTORY_LOOKUP"],
    ["What is the price of a mocha?", "PRICE_LOOKUP"],
    ["Which coffee has the most milk?", "INGREDIENT_LOOKUP"],
    ["What is the cheapest coffee?", "PRICE_LOOKUP"],
    ["What ingredients are needed for a latte?", "INGREDIENT_LOOKUP"],
    ["Is the machine ready?", "MACHINE_STATUS"],
    ["How do I start cleaning?", "CLEANING_HELP"],
    ["Why is the machine in cleaning mode?", "CLEANING_HELP"],
    ["What is the current inventory?", "INVENTORY_LOOKUP"],
    ["What can I order right now?", "ORDER_HELP"],
    ["Which ingredients are running low?", "LOW_STOCK"],
    ["How much revenue has been generated?", "SALES_SUMMARY"],
    ["Show me the difference between a flat white and a cappuccino.", "PRODUCT_COMPARISON"],
    ["What is the recipe for masala chai?", "RECIPE_LOOKUP"],
    ["Why was my order rejected?", "ORDER_HELP"],
    ["How many drinks have been served?", "SALES_SUMMARY"],
    // Variations
    ["how much does a flat white cost", "PRICE_LOOKUP"],
    ["chai recipe pls", "RECIPE_LOOKUP"],
    ["beans left?", "INVENTORY_LOOKUP"],
    ["flatwhite vs cappucino", "PRODUCT_COMPARISON"],
    ["can i get a mocha", "ORDER_HELP"],
    ["what's in a mocha", "INGREDIENT_LOOKUP"],
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    expect(ask(q).intent.intent).toBe(intent);
  });
});

describe("answers use knowledge and live state", () => {
  it("reports the live milk level, not a hard-coded value", () => {
    const inv: Inventory = structuredClone(INITIAL_INVENTORY);
    inv.milk.quantity = 1234;
    const t = ask("How much milk is left?", snapshot({ inventory: inv }));
    expect(t.answer).toContain("1,234 ml");
    expect(t.slots.some((s) => s.source === "live")).toBe(true);
    expect(t.context).toContain("[LIVE STATE]");
  });

  it("explains the cold coffee recipe", () => {
    const t = ask("What is the recipe for cold coffee?");
    expect(t.answer).toContain("Cold Coffee");
    expect(t.answer).toContain("160 ml milk");
    expect(t.retrieval.top[0].doc.id).toBe("RCP-COLD-COFFEE");
  });

  it("finds the latte as the milkiest coffee and espresso as cheapest", () => {
    expect(ask("Which coffee has the most milk?").answer).toMatch(/\*\*Latte\*\*.*180 ml/);
    expect(ask("What is the cheapest coffee?").answer).toContain("**Espresso** at **₹99**");
  });

  it("says a mocha can't be ordered when cups are empty", () => {
    const inv: Inventory = structuredClone(INITIAL_INVENTORY);
    inv.cups.quantity = 0;
    const t = ask("Can I order a mocha?", snapshot({ inventory: inv }));
    expect(t.answer).toMatch(/^Not right now/);
  });

  it("falls back on gibberish without inventing an answer", () => {
    const t = ask("purple elephant quantum");
    expect(t.intent.intent).toBe("FALLBACK");
    expect(t.template.id).toBe("fallback");
  });
});

describe("retrieval", () => {
  it("has at least 20 documents with required fields", () => {
    expect(RAG_DOCUMENTS.length).toBeGreaterThanOrEqual(20);
    for (const d of RAG_DOCUMENTS) {
      expect(d.id && d.title && d.content && d.category && d.tags.length).toBeTruthy();
    }
    expect(new Set(RAG_DOCUMENTS.map((d) => d.id)).size).toBe(RAG_DOCUMENTS.length);
  });

  it("is deterministic and ranked", () => {
    const a = ask("Difference between a flat white and a cappuccino?");
    const b = ask("Difference between a flat white and a cappuccino?");
    expect(a.retrieval.top.map((r) => [r.doc.id, r.score])).toEqual(b.retrieval.top.map((r) => [r.doc.id, r.score]));
    expect(a.retrieval.top[0].doc.id).toBe("CMP-FLATWHITE-CAPPUCCINO");
    const scores = a.retrieval.top.map((r) => r.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
    expect(a.retrieval.top.length).toBe(3);
  });
});
