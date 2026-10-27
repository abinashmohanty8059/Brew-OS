import type {
  CleaningRun,
  Consumption,
  Inventory,
  MachineSnapshot,
  MachineState,
  Order,
  PlanStep,
  PrepStage,
  PrepUnit,
  Product,
  ResourceId,
} from "@/types";
import { CLEANING, MACHINE_TIMINGS } from "@/data/config";
import { PRODUCT_MAP } from "@/data/products";
import { describeShortage, drinkServingConsumption, findShortages } from "./inventory-engine";

export const BUSY_STATES: MachineState[] = ["ORDER_RECEIVED", "VALIDATING", "GRINDING", "BREWING", "MIXING", "DISPENSING"];

export const STATE_META: Record<MachineState, { label: string; tone: "lime" | "amber" | "danger" | "aqua" | "mute"; blurb: string }> = {
  IDLE: { label: "Ready", tone: "lime", blurb: "Idle and ready for an order" },
  ORDER_RECEIVED: { label: "Order received", tone: "amber", blurb: "Order accepted from POS" },
  VALIDATING: { label: "Validating", tone: "amber", blurb: "Running sensor and dispense-path checks" },
  GRINDING: { label: "Grinding", tone: "amber", blurb: "Burr grinder active" },
  BREWING: { label: "Brewing", tone: "amber", blurb: "Extraction in progress" },
  MIXING: { label: "Mixing", tone: "amber", blurb: "Steaming and blending" },
  DISPENSING: { label: "Dispensing", tone: "amber", blurb: "Dispensing to collection slot" },
  COMPLETED: { label: "Completed", tone: "lime", blurb: "Order ready for collection" },
  CLEANING: { label: "Cleaning", tone: "aqua", blurb: "Auto-clean cycle running" },
  ERROR: { label: "Error", tone: "danger", blurb: "Attention required" },
};

/** Which ingredients each stage visibly draws on (display only). */
const STAGE_INGREDIENTS: Record<PrepStage, ResourceId[]> = {
  GRINDING: ["coffee"],
  BREWING: ["water", "tea", "spice", "chocolate"],
  MIXING: ["milk", "sugar"],
  DISPENSING: ["ice", "cups"],
};

/**
 * Expands a committed order into a deterministic, staged preparation plan:
 * order received → validating → per-unit recipe stages → present/vend.
 */
export function buildPlan(order: Order, catalog: Record<string, Product> = PRODUCT_MAP): { units: PrepUnit[]; plan: PlanStep[] } {
  const units: PrepUnit[] = [];
  for (const line of order.lines) {
    for (let i = 0; i < line.quantity; i++) {
      units.push({ index: units.length, productId: line.productId, name: line.name, kind: line.kind, sugar: line.sugar });
    }
  }
  // Brew drinks first, then vend packaged items while the customer collects.
  units.sort((a, b) => (a.kind === b.kind ? a.index - b.index : a.kind === "prepared_drink" ? -1 : 1));
  units.forEach((u, i) => (u.index = i));

  const plan: PlanStep[] = [
    {
      id: "received",
      state: "ORDER_RECEIVED",
      label: "Order received",
      detail: `${order.id} · ${order.itemCount} item${order.itemCount === 1 ? "" : "s"} accepted from POS`,
      durationMs: MACHINE_TIMINGS.orderReceivedMs,
      unitIndex: null,
      consumes: {},
    },
    {
      id: "validating",
      state: "VALIDATING",
      label: "Validating",
      detail: "Pressure, temperature, cup sensor and dispense path verified",
      durationMs: MACHINE_TIMINGS.validatingMs,
      unitIndex: null,
      consumes: {},
    },
  ];

  for (const unit of units) {
    const product = catalog[unit.productId];
    if (!product) continue;
    if (product.kind === "packaged_item") {
      plan.push({
        id: `u${unit.index}-vend`,
        state: "DISPENSING",
        phase: "vend",
        label: `Releasing ${product.name}`,
        detail: `Spiral rotates and drops one ${product.unitLabel} into the collection tray`,
        durationMs: MACHINE_TIMINGS.vendMs,
        unitIndex: unit.index,
        consumes: {},
      });
      continue;
    }

    const serving = drinkServingConsumption(product, unit.sugar);
    const sugarGrams = serving.sugar ?? 0;
    const steps = product.steps.map((s) => ({ ...s }));
    if (sugarGrams > 0 && !steps.some((s) => s.stage === "MIXING")) {
      const dispenseAt = steps.findIndex((s) => s.stage === "DISPENSING");
      steps.splice(dispenseAt < 0 ? steps.length : dispenseAt, 0, {
        stage: "MIXING",
        label: "Dissolving sugar",
        detail: `${sugarGrams} g sugar stirred in`,
        seconds: MACHINE_TIMINGS.sugarMixSeconds,
      });
    } else if (sugarGrams > 0) {
      const mix = steps.find((s) => s.stage === "MIXING");
      if (mix) mix.detail = `${mix.detail} · ${sugarGrams} g sugar`;
    }

    // Attribute each consumed resource to the first step whose stage draws on it.
    const remaining = { ...serving };
    const stepConsumes = steps.map((step) => {
      const consumes: Partial<Record<ResourceId, number>> = {};
      for (const id of STAGE_INGREDIENTS[step.stage]) {
        if (remaining[id]) {
          consumes[id] = remaining[id];
          delete remaining[id];
        }
      }
      return consumes;
    });
    if (stepConsumes.length > 0) Object.assign(stepConsumes[0], remaining);

    steps.forEach((step, i) => {
      plan.push({
        id: `u${unit.index}-s${i}`,
        state: step.stage,
        phase: step.stage === "DISPENSING" ? "pour" : undefined,
        label: step.label,
        detail: step.detail,
        durationMs: Math.round(step.seconds * 1000),
        unitIndex: unit.index,
        consumes: stepConsumes[i],
      });
    });
    plan.push({
      id: `u${unit.index}-present`,
      state: "DISPENSING",
      phase: "present",
      label: "Presenting cup",
      detail: "Cup moved to the illuminated collection slot",
      durationMs: MACHINE_TIMINGS.presentMs,
      unitIndex: unit.index,
      consumes: {},
    });
  }

  return { units, plan };
}

/** Remaining milliseconds in a plan, given progress into the current step. */
export function remainingPlanMs(plan: PlanStep[], stepIndex: number, elapsedInStep: number, speed: number): number {
  let total = 0;
  for (let i = stepIndex; i < plan.length; i++) total += plan[i].durationMs / speed;
  return Math.max(0, total - elapsedInStep);
}

export function totalPlanMs(plan: PlanStep[], speed: number): number {
  return plan.reduce((sum, s) => sum + s.durationMs / speed, 0);
}

export interface Readiness {
  /** Can a new order be committed right now (ignoring stock)? */
  canOrder: boolean;
  /** Can prepared drinks be made right now? */
  canBrew: boolean;
  blockers: string[];
  brewBlockers: string[];
}

export function getReadiness(machine: MachineSnapshot, inventory: Inventory): Readiness {
  const blockers: string[] = [];
  if (machine.state === "CLEANING") blockers.push("A cleaning cycle is running — ordering resumes when it completes.");
  if (BUSY_STATES.includes(machine.state)) {
    blockers.push(machine.prep ? `The machine is preparing order ${machine.prep.orderId}.` : "The machine is preparing an order.");
  }
  if (machine.state === "ERROR") blockers.push(`Machine fault: ${machine.error?.message ?? "unknown"} — acknowledge it on the machine.`);

  const brewBlockers = [...blockers];
  if (inventory.cups.quantity <= 0) brewBlockers.push("The cup dispenser is empty — replenish cups to order drinks.");
  if (inventory.water.quantity <= 0) brewBlockers.push("The water tank is empty.");

  return { canOrder: blockers.length === 0, canBrew: brewBlockers.length === 0, blockers, brewBlockers };
}

export function cleaningConsumption(): Consumption {
  return { resources: { cleaningAgent: CLEANING.agentPerCycleMl, water: CLEANING.waterPerCycleMl }, packaged: {} };
}

export function canStartCleaning(machine: MachineSnapshot, inventory: Inventory): { ok: boolean; reason: string | null } {
  if (machine.state === "CLEANING" || machine.cleaning) return { ok: false, reason: "A cleaning cycle is already running." };
  if (BUSY_STATES.includes(machine.state)) return { ok: false, reason: "Wait for the current order to finish before cleaning." };
  if (machine.state === "ERROR") return { ok: false, reason: "Acknowledge the machine fault before cleaning." };
  const shortages = findShortages(inventory, {}, cleaningConsumption());
  if (shortages.length > 0) {
    return { ok: false, reason: `${shortages.map(describeShortage).join(" ")} A cycle needs ${CLEANING.agentPerCycleMl} ml agent and ${CLEANING.waterPerCycleMl} ml water.` };
  }
  return { ok: true, reason: null };
}

export function cleaningRemainingMs(run: CleaningRun, now: number, speed: number): number {
  let total = 0;
  for (let i = run.stageIndex; i < CLEANING.stages.length; i++) total += (CLEANING.stages[i].seconds * 1000) / speed;
  return Math.max(0, total - (now - run.stageStartedAt));
}
