import type {
  Consumption,
  Inventory,
  PackagedInventory,
  PackagedStock,
  PreparedDrink,
  Product,
  ResourceId,
  ResourceLevel,
  Shortage,
  StockStatus,
  SugarLevel,
} from "@/types";
import { SUGAR_GRAMS } from "@/data/config";
import { PRODUCT_MAP } from "@/data/products";
import { formatQty } from "./currency";

/* Pure inventory functions. Nothing here touches React or the store. */

export function resourceStatus(level: Pick<ResourceLevel, "quantity" | "lowThreshold" | "criticalThreshold">): StockStatus {
  if (level.quantity <= 0) return "empty";
  if (level.quantity <= level.criticalThreshold) return "critical";
  if (level.quantity <= level.lowThreshold) return "low";
  return "normal";
}

export function packagedStatus(stock: PackagedStock): StockStatus {
  if (stock.quantity <= 0) return "empty";
  if (stock.quantity <= Math.max(1, Math.floor(stock.lowThreshold / 2))) return "critical";
  if (stock.quantity <= stock.lowThreshold) return "low";
  return "normal";
}

export function percentRemaining(quantity: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, Math.min(100, (quantity / capacity) * 100));
}

/** Resources needed for ONE serving of a drink, including sugar and its cup. */
export function drinkServingConsumption(drink: PreparedDrink, sugar: SugarLevel | null): Partial<Record<ResourceId, number>> {
  const result: Partial<Record<ResourceId, number>> = { ...drink.recipe };
  const sugarLevel = drink.allowsSugar ? (sugar ?? drink.defaultSugar) : "none";
  const sugarGrams = SUGAR_GRAMS[sugarLevel];
  if (sugarGrams > 0) result.sugar = (result.sugar ?? 0) + sugarGrams;
  result.cups = 1;
  return result;
}

export interface ConsumptionLine {
  productId: string;
  quantity: number;
  sugar: SugarLevel | null;
}

/**
 * Total consumption for a set of lines. Prepared drinks consume recipe
 * ingredients plus one cup each; packaged items consume their own unit stock.
 */
export function computeConsumption(lines: ConsumptionLine[], catalog: Record<string, Product> = PRODUCT_MAP): Consumption {
  const resources: Partial<Record<ResourceId, number>> = {};
  const packaged: Record<string, number> = {};
  for (const line of lines) {
    const product = catalog[line.productId];
    if (!product || line.quantity <= 0) continue;
    if (product.kind === "packaged_item") {
      packaged[product.id] = (packaged[product.id] ?? 0) + line.quantity;
      continue;
    }
    const serving = drinkServingConsumption(product, line.sugar);
    for (const [id, amount] of Object.entries(serving) as Array<[ResourceId, number]>) {
      resources[id] = (resources[id] ?? 0) + amount * line.quantity;
    }
  }
  return { resources, packaged };
}

export function findShortages(
  inventory: Inventory,
  packaged: PackagedInventory,
  consumption: Consumption,
  catalog: Record<string, Product> = PRODUCT_MAP,
): Shortage[] {
  const shortages: Shortage[] = [];
  for (const [id, required] of Object.entries(consumption.resources) as Array<[ResourceId, number]>) {
    const level = inventory[id];
    if (required > level.quantity) {
      shortages.push({ id, label: level.label, unit: level.unit, required, available: level.quantity });
    }
  }
  for (const [id, required] of Object.entries(consumption.packaged)) {
    const available = packaged[id]?.quantity ?? 0;
    if (required > available) {
      shortages.push({ id, label: catalog[id]?.name ?? id, unit: "units", required, available });
    }
  }
  return shortages;
}

export function describeShortage(s: Shortage): string {
  if (s.id === "cups") {
    return s.available === 0
      ? "Cup dispenser is empty — replenish cups before ordering drinks."
      : `Not enough cups: the order needs ${formatQty(s.required, "cups")} but only ${formatQty(s.available, "cups")} remain.`;
  }
  if (s.unit === "units") {
    return `${s.label}: ${s.required} requested, only ${s.available} in stock.`;
  }
  return `${s.label}: needs ${formatQty(s.required, s.unit)}, only ${formatQty(s.available, s.unit)} available — replenish ${s.label.toLowerCase()}.`;
}

/**
 * Atomically applies a consumption. Validates everything first and throws
 * if any resource would go negative, so callers can never partially deduct.
 */
export function applyConsumption(
  inventory: Inventory,
  packaged: PackagedInventory,
  consumption: Consumption,
): { inventory: Inventory; packaged: PackagedInventory } {
  const shortages = findShortages(inventory, packaged, consumption);
  if (shortages.length > 0) {
    throw new Error(`Insufficient stock: ${shortages.map((s) => s.label).join(", ")}`);
  }
  const nextInventory = { ...inventory };
  for (const [id, amount] of Object.entries(consumption.resources) as Array<[ResourceId, number]>) {
    nextInventory[id] = { ...nextInventory[id], quantity: round(nextInventory[id].quantity - amount) };
  }
  const nextPackaged = { ...packaged };
  for (const [id, amount] of Object.entries(consumption.packaged)) {
    nextPackaged[id] = { ...nextPackaged[id], quantity: nextPackaged[id].quantity - amount };
  }
  return { inventory: nextInventory, packaged: nextPackaged };
}

export interface RestockResult {
  added: number;
  clamped: boolean;
  quantity: number;
}

/** Adds stock up to capacity. Returns how much was actually added. */
export function restockAmount(quantity: number, capacity: number, amount: number): RestockResult {
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const next = Math.min(capacity, round(quantity + safe));
  return { added: round(next - quantity), clamped: quantity + safe > capacity, quantity: next };
}

export interface StatusChange {
  id: string;
  label: string;
  from: StockStatus;
  to: StockStatus;
}

const SEVERITY: Record<StockStatus, number> = { normal: 0, low: 1, critical: 2, empty: 3 };

/** Lists resources whose status got worse between two snapshots. */
export function worsenedStatuses(
  before: { inventory: Inventory; packaged: PackagedInventory },
  after: { inventory: Inventory; packaged: PackagedInventory },
  catalog: Record<string, Product> = PRODUCT_MAP,
): StatusChange[] {
  const changes: StatusChange[] = [];
  for (const id of Object.keys(after.inventory) as ResourceId[]) {
    const from = resourceStatus(before.inventory[id]);
    const to = resourceStatus(after.inventory[id]);
    if (SEVERITY[to] > SEVERITY[from]) changes.push({ id, label: after.inventory[id].label, from, to });
  }
  for (const id of Object.keys(after.packaged)) {
    if (!before.packaged[id]) continue;
    const from = packagedStatus(before.packaged[id]);
    const to = packagedStatus(after.packaged[id]);
    if (SEVERITY[to] > SEVERITY[from]) changes.push({ id, label: catalog[id]?.name ?? id, from, to });
  }
  return changes;
}

export interface Availability {
  available: boolean;
  /** How many more could be made/vended right now (ignoring the cart). */
  servings: number;
  limiting: string | null;
  reason: string | null;
}

/** How many servings of a product the current stock supports. */
export function productAvailability(
  product: Product,
  inventory: Inventory,
  packaged: PackagedInventory,
  sugar: SugarLevel | null = null,
): Availability {
  if (!product.listed) return { available: false, servings: 0, limiting: null, reason: "Not listed by operator" };
  if (product.kind === "packaged_item") {
    const qty = packaged[product.id]?.quantity ?? 0;
    return {
      available: qty > 0,
      servings: qty,
      limiting: qty > 0 ? null : product.name,
      reason: qty > 0 ? null : "Sold out",
    };
  }
  const serving = drinkServingConsumption(product, sugar);
  let servings = Infinity;
  let limiting: ResourceId | null = null;
  for (const [id, amount] of Object.entries(serving) as Array<[ResourceId, number]>) {
    if (amount <= 0) continue;
    const possible = Math.floor(inventory[id].quantity / amount);
    if (possible < servings) {
      servings = possible;
      limiting = id;
    }
  }
  const finite = Number.isFinite(servings) ? servings : 0;
  const label = limiting ? inventory[limiting].label : null;
  return {
    available: finite > 0,
    servings: finite,
    limiting: label,
    reason: finite > 0 ? null : limiting === "cups" ? "No cups" : `Out of ${label?.toLowerCase()}`,
  };
}

export function emptyConsumption(): Consumption {
  return { resources: {}, packaged: {} };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
