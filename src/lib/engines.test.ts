import { describe, expect, it } from "vitest";
import type { CartLine, MachineSnapshot } from "@/types";
import { INITIAL_INVENTORY, INITIAL_PACKAGED } from "@/data/initial-inventory";
import { COFFEE_RECIPES } from "@/data/coffee-recipes";
import { PRODUCT_MAP } from "@/data/products";
import { applyConsumption, computeConsumption, findShortages, productAvailability, resourceStatus } from "./inventory-engine";
import { createPendingOrder, processOrder } from "./order-engine";
import { buildPlan, canStartCleaning, getReadiness } from "./machine-engine";

const inv = () => structuredClone(INITIAL_INVENTORY);
const pkg = () => structuredClone(INITIAL_PACKAGED);
const idle: MachineSnapshot = { state: "IDLE", prep: null, cleaning: null, error: null, lastCompletedOrderId: null, lastCleanedAt: null, ordersSinceClean: 0 };
const line = (productId: string, quantity: number, sugar: CartLine["sugar"] = "none"): CartLine => ({ id: `${productId}:${sugar}`, productId, quantity, sugar });

describe("catalogue", () => {
  it("has the seven required coffees with the specified prices and recipes", () => {
    const expected: Record<string, [number, Record<string, number>]> = {
      espresso: [99, { coffee: 18, water: 36 }],
      americano: [119, { coffee: 18, water: 180 }],
      cappuccino: [149, { coffee: 18, water: 36, milk: 120 }],
      latte: [159, { coffee: 18, water: 36, milk: 180 }],
      "flat-white": [169, { coffee: 18, water: 36, milk: 150 }],
      macchiato: [129, { coffee: 18, water: 36, milk: 20 }],
      mocha: [189, { coffee: 18, water: 36, milk: 150, chocolate: 20 }],
    };
    expect(COFFEE_RECIPES.map((c) => c.id).sort()).toEqual(Object.keys(expected).sort());
    for (const c of COFFEE_RECIPES) {
      expect(c.price).toBe(expected[c.id][0]);
      expect(c.recipe).toEqual(expected[c.id][1]);
      expect(c.prepSeconds).toBeGreaterThan(0);
    }
  });
});

describe("inventory engine", () => {
  it("computes consumption for 2 lattes + 1 mocha with sugar, one cup per drink", () => {
    const c = computeConsumption([line("latte", 2, "regular"), line("mocha", 1, "none")]);
    expect(c.resources).toEqual({ coffee: 54, water: 108, milk: 510, chocolate: 20, sugar: 20, cups: 3 });
    expect(c.packaged).toEqual({});
  });

  it("packaged items use unit stock and no cups", () => {
    const c = computeConsumption([line("cookies", 2, null), line("bottled-water", 1, null)]);
    expect(c.resources).toEqual({});
    expect(c.packaged).toEqual({ cookies: 2, "bottled-water": 1 });
  });

  it("refuses to deduct anything when one resource is short (no partial deduction)", () => {
    const i = inv();
    i.chocolate.quantity = 10;
    const c = computeConsumption([line("latte", 1), line("mocha", 1)]);
    expect(findShortages(i, pkg(), c).map((s) => s.id)).toEqual(["chocolate"]);
    expect(() => applyConsumption(i, pkg(), c)).toThrow();
    expect(i.milk.quantity).toBe(INITIAL_INVENTORY.milk.quantity);
  });

  it("classifies stock status from thresholds", () => {
    expect(resourceStatus({ quantity: 0, lowThreshold: 10, criticalThreshold: 3 })).toBe("empty");
    expect(resourceStatus({ quantity: 3, lowThreshold: 10, criticalThreshold: 3 })).toBe("critical");
    expect(resourceStatus({ quantity: 9, lowThreshold: 10, criticalThreshold: 3 })).toBe("low");
    expect(resourceStatus({ quantity: 11, lowThreshold: 10, criticalThreshold: 3 })).toBe("normal");
  });

  it("disables drinks but not packaged items when cups run out", () => {
    const i = inv();
    i.cups.quantity = 0;
    expect(productAvailability(PRODUCT_MAP.latte, i, pkg()).available).toBe(false);
    expect(productAvailability(PRODUCT_MAP.croissant, i, pkg()).available).toBe(true);
    const r = getReadiness(idle, i);
    expect(r.canBrew).toBe(false);
    expect(r.canOrder).toBe(true);
  });
});

describe("order engine", () => {
  it("commits a multi-item order atomically and only once", () => {
    const order = createPendingOrder(1, [line("latte", 2), line("mocha", 1), line("muffin", 1, null)], 0, "upi");
    expect(order.total).toBe(159 * 2 + 189 + 110);
    const r = processOrder({ order, inventory: inv(), packaged: pkg(), machineBlockers: [], paymentRef: "X", now: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.inventory.cups.quantity).toBe(INITIAL_INVENTORY.cups.quantity - 3);
    expect(r.inventory.milk.quantity).toBe(INITIAL_INVENTORY.milk.quantity - 510);
    expect(r.packaged.muffin.quantity).toBe(INITIAL_PACKAGED.muffin.quantity - 1);
    // Re-processing the committed order is refused.
    const again = processOrder({ order: r.order, inventory: r.inventory, packaged: r.packaged, machineBlockers: [], paymentRef: "X", now: 2 });
    expect(again.ok).toBe(false);
  });

  it("rejects with a precise reason when stock is insufficient", () => {
    const i = inv();
    i.milk.quantity = 100;
    const order = createPendingOrder(2, [line("latte", 1)], 0, "card");
    const r = processOrder({ order, inventory: i, packaged: pkg(), machineBlockers: [], paymentRef: "X", now: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons[0]).toMatch(/Milk: needs 180 ml, only 100 ml available/);
    expect(r.order.status).toBe("failed");
  });

  it("rejects while the machine is cleaning", () => {
    const order = createPendingOrder(3, [line("espresso", 1)], 0, "cash");
    const blockers = getReadiness({ ...idle, state: "CLEANING", cleaning: { id: "c", startedAt: 0, stageIndex: 0, stageStartedAt: 0 } }, inv()).brewBlockers;
    const r = processOrder({ order, inventory: inv(), packaged: pkg(), machineBlockers: blockers, paymentRef: "X", now: 1 });
    expect(r.ok).toBe(false);
  });
});

describe("machine engine", () => {
  it("builds a staged plan with one queue entry per unit, drinks before packaged", () => {
    const order = createPendingOrder(4, [line("cookies", 1, null), line("tea", 1, "regular")], 0, "upi");
    const { units, plan } = buildPlan(order);
    expect(units.map((u) => u.productId)).toEqual(["tea", "cookies"]);
    expect(plan[0].state).toBe("ORDER_RECEIVED");
    expect(plan[1].state).toBe("VALIDATING");
    expect(plan.some((s) => s.phase === "vend")).toBe(true);
    // Tea has no grinding stage; sugar is attributed to its mixing step.
    expect(plan.some((s) => s.state === "GRINDING")).toBe(false);
    expect(plan.find((s) => s.state === "MIXING")?.consumes.sugar).toBe(10);
  });

  it("inserts a sugar step for drinks without a mixing stage", () => {
    const order = createPendingOrder(5, [line("espresso", 1, "light")], 0, "upi");
    expect(buildPlan(order).plan.find((s) => s.label === "Dissolving sugar")?.consumes.sugar).toBe(5);
  });

  it("guards cleaning against duplicates and insufficient agent", () => {
    expect(canStartCleaning(idle, inv()).ok).toBe(true);
    expect(canStartCleaning({ ...idle, state: "CLEANING", cleaning: { id: "c", startedAt: 0, stageIndex: 0, stageStartedAt: 0 } }, inv()).ok).toBe(false);
    const i = inv();
    i.cleaningAgent.quantity = 10;
    const r = canStartCleaning(idle, i);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Cleaning agent/);
  });
});
