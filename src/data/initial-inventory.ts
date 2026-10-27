import type { Inventory, PackagedInventory } from "@/types";

/** Starting machine levels. Units: g for solids, ml for liquids, cups for cups. */
export const INITIAL_INVENTORY: Inventory = {
  coffee: { id: "coffee", label: "Coffee beans", unit: "g", quantity: 1200, capacity: 2000, lowThreshold: 400, criticalThreshold: 150 },
  milk: { id: "milk", label: "Milk", unit: "ml", quantity: 3200, capacity: 5000, lowThreshold: 1000, criticalThreshold: 350 },
  water: { id: "water", label: "Water", unit: "ml", quantity: 8000, capacity: 10000, lowThreshold: 2000, criticalThreshold: 700 },
  sugar: { id: "sugar", label: "Sugar", unit: "g", quantity: 700, capacity: 1000, lowThreshold: 200, criticalThreshold: 60 },
  chocolate: { id: "chocolate", label: "Chocolate", unit: "g", quantity: 500, capacity: 1000, lowThreshold: 150, criticalThreshold: 60 },
  tea: { id: "tea", label: "Tea leaves", unit: "g", quantity: 400, capacity: 500, lowThreshold: 100, criticalThreshold: 30 },
  spice: { id: "spice", label: "Masala blend", unit: "g", quantity: 150, capacity: 200, lowThreshold: 40, criticalThreshold: 12 },
  ice: { id: "ice", label: "Ice", unit: "g", quantity: 3000, capacity: 5000, lowThreshold: 800, criticalThreshold: 250 },
  cups: { id: "cups", label: "Disposable cups", unit: "cups", quantity: 24, capacity: 100, lowThreshold: 15, criticalThreshold: 5 },
  cleaningAgent: {
    id: "cleaningAgent",
    label: "Cleaning agent",
    unit: "ml",
    quantity: 800,
    capacity: 1000,
    lowThreshold: 200,
    criticalThreshold: 60,
  },
};

export const INITIAL_PACKAGED: PackagedInventory = {
  "bottled-water": { productId: "bottled-water", quantity: 18, capacity: 24, lowThreshold: 5 },
  "chocolate-bar": { productId: "chocolate-bar", quantity: 12, capacity: 20, lowThreshold: 4 },
  cookies: { productId: "cookies", quantity: 15, capacity: 20, lowThreshold: 4 },
  croissant: { productId: "croissant", quantity: 8, capacity: 12, lowThreshold: 3 },
  muffin: { productId: "muffin", quantity: 6, capacity: 12, lowThreshold: 3 },
  sandwich: { productId: "sandwich", quantity: 4, capacity: 10, lowThreshold: 3 },
};

/** Display order for gauges. */
export const INGREDIENT_ORDER = ["coffee", "milk", "water", "sugar", "chocolate", "tea", "spice", "ice"] as const;
export const RESOURCE_ORDER = [...INGREDIENT_ORDER, "cups", "cleaningAgent"] as const;
