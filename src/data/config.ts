import type { CleaningStage, MenuCategory, SugarLevel } from "@/types";

/* Central simulation configuration. All values are illustrative demo
   values, not manufacturer specifications. */

export const MACHINE = {
  id: "BRW-KX07",
  model: "BREW.OS Series K",
  location: "Bandra West Kiosk",
  firmware: "brew-os 3.2.1-sim",
} as const;

/** Grams of sugar dispensed per serving for each sugar option. */
export const SUGAR_GRAMS: Record<SugarLevel, number> = {
  none: 0,
  light: 5,
  regular: 10,
  extra: 15,
};

export const SUGAR_LABELS: Record<SugarLevel, string> = {
  none: "No sugar",
  light: "Light",
  regular: "Regular",
  extra: "Extra",
};

export const SUGAR_ORDER: SugarLevel[] = ["none", "light", "regular", "extra"];

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  espresso: "Espresso",
  black: "Black Coffee",
  milk: "Milk Coffee",
  specialty: "Specialty",
  cold: "Cold Bar",
  tea: "Tea & Cocoa",
  pantry: "Pantry",
};

export const CATEGORY_ORDER: MenuCategory[] = ["espresso", "black", "milk", "specialty", "cold", "tea", "pantry"];

/** Fixed machine timings (ms) around each order's recipe steps. */
export const MACHINE_TIMINGS = {
  orderReceivedMs: 1400,
  validatingMs: 1600,
  presentMs: 1500,
  vendMs: 2200,
  sugarMixSeconds: 1.2,
};

export const CLEANING = {
  /** Cleaning agent consumed when a cycle starts successfully (ml). */
  agentPerCycleMl: 60,
  /** Rinse water consumed when a cycle starts successfully (ml). */
  waterPerCycleMl: 500,
  /** Demo policy: a cancelled cycle does not return agent or water. */
  refundOnCancel: false,
  /** Suggest a cycle after this many completed brew orders. */
  recommendAfterOrders: 6,
  stages: [
    { id: "pre_rinse", label: "Pre-rinse", detail: "Hot water purge through brew group and nozzle", seconds: 3 },
    { id: "circulation", label: "Solution circulation", detail: "Cleaning agent circulates through milk and brew lines", seconds: 4.5 },
    { id: "flush", label: "Internal flush", detail: "High-pressure flush clears residue from chamber", seconds: 3.5 },
    { id: "final_rinse", label: "Final rinse", detail: "Clean water rinse until conductivity is neutral", seconds: 3 },
    { id: "drying", label: "Drying & readiness check", detail: "Air dry, sensor self-test and pressure check", seconds: 2.5 },
  ] satisfies CleaningStage[],
};

export const CLEANING_TOTAL_SECONDS = CLEANING.stages.reduce((sum, s) => sum + s.seconds, 0);
