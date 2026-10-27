import type { RagDocument } from "@/lib/assistant/types";
import type { PreparedDrink } from "@/types";
import { PACKAGED_ITEMS, PREPARED_DRINKS } from "./products";
import { CLEANING, SUGAR_GRAMS } from "./config";
import { INITIAL_INVENTORY } from "./initial-inventory";
import { formatINR } from "@/lib/currency";

/* Local mock corpus for the simulated RAG pipeline. Recipe and pricing
   documents are generated from the central catalogue so the knowledge can
   never drift from the real recipes; the rest are hand-written. */

const UNIT: Record<string, string> = { coffee: "g", water: "ml", milk: "ml", chocolate: "g", tea: "g", spice: "g", ice: "g", sugar: "g" };
const NAME: Record<string, string> = {
  coffee: "coffee",
  water: "water",
  milk: "milk",
  chocolate: "dark chocolate",
  tea: "tea leaves",
  spice: "masala blend",
  ice: "ice",
  sugar: "sugar",
};

export function ingredientList(drink: PreparedDrink): string {
  return Object.entries(drink.recipe)
    .map(([id, qty]) => `${qty} ${UNIT[id]} ${NAME[id]}`)
    .join(", ");
}

function recipeDoc(drink: PreparedDrink): RagDocument {
  const steps = drink.steps.map((s, i) => `${i + 1}. ${s.label}: ${s.detail}.`).join(" ");
  const isCoffee = Boolean(drink.recipe.coffee);
  return {
    id: `RCP-${drink.id.toUpperCase()}`,
    title: `${drink.name} recipe`,
    category: "recipe",
    content:
      `${drink.name} is made with ${ingredientList(drink)}, served in one disposable cup. ` +
      `Preparation steps: ${steps} ` +
      `Taste profile: ${drink.tasteProfile} ` +
      `Strength ${drink.strength} of 5, about ${drink.caffeineMg} mg caffeine. ` +
      `Sugar: ${drink.sugarRecommendation} ` +
      `Price ${formatINR(drink.price)}; preparation takes about ${Math.round(drink.prepSeconds)} seconds.`,
    tags: [
      "recipe",
      "ingredient",
      "steps",
      drink.id,
      ...drink.name.toLowerCase().split(" "),
      drink.temperature,
      isCoffee ? "coffee" : "tea",
      ...Object.keys(drink.recipe),
    ],
    intents: ["RECIPE_LOOKUP", "INGREDIENT_LOOKUP"],
    entities: [drink.id, ...Object.keys(drink.recipe)],
    prior: drink.primary ? 0.9 : 0.8,
  };
}

const priceList = PREPARED_DRINKS.map((d) => `${d.name} ${formatINR(d.price)}`).join(", ");
const packagedList = PACKAGED_ITEMS.map((p) => `${p.name} ${formatINR(p.price)}`).join(", ");
const cheapestCoffee = [...PREPARED_DRINKS].filter((d) => d.primary).sort((a, b) => a.price - b.price)[0];

const HANDWRITTEN: RagDocument[] = [
  {
    id: "PRC-MENU",
    title: "Menu price list",
    category: "pricing",
    content: `All prices are in Indian rupees and include GST. Prepared drinks: ${priceList}. Packaged items: ${packagedList}. The cheapest coffee is ${cheapestCoffee.name} at ${formatINR(cheapestCoffee.price)}; the Mocha and Iced Latte are the most expensive coffees.`,
    tags: ["price", "cost", "menu", "rupees", "cheapest", "priciest", "gst"],
    intents: ["PRICE_LOOKUP", "ORDER_HELP"],
    entities: PREPARED_DRINKS.map((d) => d.id),
    prior: 0.85,
  },
  {
    id: "ING-BEANS-MILK",
    title: "Coffee beans, water and milk",
    category: "ingredient",
    content: `Coffee beans are a medium-dark Chikmagalur blend, ground fresh for every drink; each coffee uses an 18 g double dose. Water is filtered and heated to 93 °C for espresso. Milk is full-cream toned milk, steamed for hot drinks and chilled for iced drinks. Hoppers hold up to ${INITIAL_INVENTORY.coffee.capacity} g of beans, ${INITIAL_INVENTORY.water.capacity} ml of water and ${INITIAL_INVENTORY.milk.capacity} ml of milk.`,
    tags: ["ingredient", "coffee", "beans", "milk", "water", "hopper", "capacity"],
    intents: ["INGREDIENT_LOOKUP", "INVENTORY_LOOKUP"],
    entities: ["coffee", "milk", "water"],
    prior: 0.7,
  },
  {
    id: "ING-TEA-COCOA-SUGAR",
    title: "Tea, masala, chocolate and sugar",
    category: "ingredient",
    content: `Tea leaves are Assam CTC for tea and chai, and Darjeeling green for green tea. The masala blend is cardamom, ginger, clove and cinnamon. Chocolate is 54% dark, used in the Mocha and Hot Chocolate. Sugar options are No sugar (${SUGAR_GRAMS.none} g), Light (${SUGAR_GRAMS.light} g), Regular (${SUGAR_GRAMS.regular} g) and Extra (${SUGAR_GRAMS.extra} g) per serving.`,
    tags: ["ingredient", "tea", "masala", "spice", "chocolate", "cocoa", "sugar", "sweetness"],
    intents: ["INGREDIENT_LOOKUP", "RECIPE_LOOKUP"],
    entities: ["tea", "spice", "chocolate", "sugar"],
    prior: 0.7,
  },
  {
    id: "CLN-PROCEDURE",
    title: "Auto-cleaning procedure",
    category: "cleaning",
    content: `To start cleaning, open the Machine or Operator view and press Start cycle in the Auto-clean panel. A cycle uses ${CLEANING.agentPerCycleMl} ml cleaning agent and ${CLEANING.waterPerCycleMl} ml water, deducted once when it starts. Stages: ${CLEANING.stages.map((s) => s.label.toLowerCase()).join(", ")}. Ordering and dispensing are disabled while the machine is in cleaning mode and re-enable automatically when the cycle completes. A cycle is recommended after every ${CLEANING.recommendAfterOrders} orders.`,
    tags: ["clean", "cleaning", "rinse", "flush", "sanitise", "start", "cycle", "agent"],
    intents: ["CLEANING_HELP"],
    entities: ["cleaningAgent", "water"],
    prior: 0.9,
  },
  {
    id: "CLN-MODE-FAQ",
    title: "Why is the machine in cleaning mode?",
    category: "cleaning",
    content: `The machine enters cleaning mode only when an operator starts an auto-clean cycle. While cleaning, the display shows the current stage and remaining time, the status light turns aqua and new orders are paused. Stopping a cycle early returns the machine to idle; cleaning agent is not refunded under the demo policy. If the cycle will not start, check that at least ${CLEANING.agentPerCycleMl} ml of cleaning agent and ${CLEANING.waterPerCycleMl} ml of water are loaded and that no order is in progress.`,
    tags: ["clean", "cleaning", "mode", "why", "paused", "stop", "cancel", "agent"],
    intents: ["CLEANING_HELP", "MACHINE_STATUS"],
    entities: ["cleaningAgent"],
    prior: 0.8,
  },
  {
    id: "INV-POLICY",
    title: "Inventory commit policy",
    category: "inventory",
    content:
      "Selecting items or opening checkout never deducts stock. When the simulated payment succeeds, the whole order is validated and every ingredient, cup and packaged unit is deducted at once. If any resource is short, nothing is deducted and the order is rejected with the exact ingredient to replenish. Preparation animations never change stock. Inventory can never go negative.",
    tags: ["inventory", "stock", "deduct", "policy", "atomic", "commit", "reserve"],
    intents: ["INVENTORY_LOOKUP", "ORDER_HELP"],
    entities: [],
    prior: 0.75,
  },
  {
    id: "INV-LOW-STOCK",
    title: "Low-stock and empty-stock procedure",
    category: "inventory",
    content:
      "Every resource has a low threshold and a critical threshold. Status moves from Normal to Low, Critical and Empty as stock falls. Low and empty alerts appear as notifications and in the Operator dashboard. To replenish, open Operator, choose Restock, pick the ingredient, enter a quantity and confirm. Thresholds can be changed in the same dialog.",
    tags: ["low", "stock", "empty", "critical", "alert", "restock", "replenish", "threshold", "refill"],
    intents: ["LOW_STOCK", "INVENTORY_LOOKUP"],
    entities: ["coffee", "milk", "water", "sugar", "chocolate", "cups"],
    prior: 0.85,
  },
  {
    id: "CUP-DISPENSER",
    title: "Cup dispenser",
    category: "cups",
    content: `Cups are tracked separately. Each prepared drink uses exactly one cup; packaged items such as water, cookies or sandwiches use none. The dispenser holds up to ${INITIAL_INVENTORY.cups.capacity} cups and warns below ${INITIAL_INVENTORY.cups.lowThreshold}. When cups reach zero, drinks are disabled but packaged items can still be sold. Restock cups from the Operator dashboard.`,
    tags: ["cup", "cups", "dispenser", "empty", "restock", "remaining"],
    intents: ["INVENTORY_LOOKUP", "LOW_STOCK", "MACHINE_STATUS"],
    entities: ["cups"],
    prior: 0.85,
  },
  {
    id: "OPS-GUIDE",
    title: "Machine operating instructions",
    category: "operation",
    content:
      "Choose drinks on the POS, adjust quantity and sugar, then press Pay and dispense. After the simulated payment is approved the machine runs: order received, validating, grinding, brewing, mixing and dispensing for each drink in the queue. Collect the cup from the illuminated slot when the display shows COLLECT. The machine is ready when the status shows Ready and the power light breathes green.",
    tags: ["machine", "operate", "how", "order", "status", "ready", "dispense", "collect"],
    intents: ["MACHINE_STATUS", "ORDER_HELP", "GENERAL_HELP"],
    entities: [],
    prior: 0.8,
  },
  {
    id: "TRB-NOT-DISPENSING",
    title: "Troubleshooting: machine not dispensing",
    category: "troubleshooting",
    content:
      "If the machine is not dispensing, check in this order: a cleaning cycle may be running; another order may still be preparing; a fault may need acknowledging; the cup dispenser may be empty; a required ingredient may be below one serving. The order panel and machine display state the exact blocker.",
    tags: ["dispense", "dispensing", "not", "working", "why", "troubleshoot", "blocked", "status", "ready"],
    intents: ["MACHINE_STATUS", "ORDER_HELP"],
    entities: ["cups"],
    prior: 0.9,
  },
  {
    id: "TRB-ORDER-REJECTED",
    title: "Troubleshooting: order rejected",
    category: "troubleshooting",
    content:
      "An order is rejected when the simulated payment is declined, or when validation at commit finds an ingredient, cup or packaged item short. Rejected orders never deduct stock and the authorisation is voided. The rejection message names each missing resource; restock it and try again.",
    tags: ["order", "rejected", "reject", "declined", "failed", "why", "payment", "validation"],
    intents: ["ORDER_HELP"],
    entities: [],
    prior: 0.9,
  },
  {
    id: "PAY-DEMO",
    title: "Simulated payment methods",
    category: "payment",
    content:
      "Payments are demonstrations only: UPI, card and cash are simulated and no money moves. The checkout lets you choose Approve or Decline to test both paths. Stock is committed only after an approved payment, so a declined payment never charges or deducts anything.",
    tags: ["payment", "pay", "upi", "card", "cash", "declined", "simulated", "receipt"],
    intents: ["ORDER_HELP"],
    entities: [],
    prior: 0.7,
  },
  {
    id: "ORD-RULES",
    title: "Ordering rules",
    category: "ordering",
    content:
      "One order can mix several drinks and packaged items with any quantities. Drinks are prepared one at a time in queue order, then packaged items are vended. Ordering is disabled while cleaning or while another order is preparing. Each order gets a unique number and a receipt you can reopen from order history.",
    tags: ["order", "rules", "queue", "multiple", "receipt", "history", "can"],
    intents: ["ORDER_HELP"],
    entities: [],
    prior: 0.75,
  },
  {
    id: "CMP-FLATWHITE-CAPPUCCINO",
    title: "Flat white vs cappuccino",
    category: "comparison",
    content:
      "Both start with the same 18 g double espresso. A cappuccino uses 120 ml milk with a thick, airy foam cap — roughly a third foam. A flat white uses 150 ml milk textured into thin, glossy microfoam, so it tastes smoother and more coffee-forward. The flat white costs ₹169 and the cappuccino ₹149.",
    tags: ["compare", "difference", "flat", "white", "cappuccino", "foam", "milk"],
    intents: ["PRODUCT_COMPARISON"],
    entities: ["flat-white", "cappuccino"],
    prior: 0.9,
  },
  {
    id: "CMP-MILK-COFFEES",
    title: "Latte, cappuccino and flat white milk levels",
    category: "comparison",
    content:
      "Milk per cup: latte 180 ml, flat white 150 ml, mocha 150 ml, cappuccino 120 ml, macchiato 20 ml. Espresso and Americano contain no milk. The latte is the milkiest and mildest; the macchiato is the strongest milk coffee.",
    tags: ["compare", "milk", "most", "least", "latte", "cappuccino", "flat", "white", "macchiato"],
    intents: ["PRODUCT_COMPARISON", "INGREDIENT_LOOKUP"],
    entities: ["latte", "cappuccino", "flat-white", "macchiato", "mocha", "milk"],
    prior: 0.85,
  },
  {
    id: "CMP-COLD",
    title: "Cold coffee vs iced latte",
    category: "comparison",
    content:
      "Cold coffee is blended with chilled milk, sugar and ice until frothy and is sweet by default. An iced latte is layered — cold milk over ice with a double shot floated on top — and unsweetened by default. Both use 18 g coffee, 160 ml milk and 120 g ice.",
    tags: ["compare", "cold", "iced", "coffee", "latte", "difference", "ice"],
    intents: ["PRODUCT_COMPARISON", "RECIPE_LOOKUP"],
    entities: ["cold-coffee", "iced-latte"],
    prior: 0.8,
  },
  {
    id: "PKG-ITEMS",
    title: "Packaged items",
    category: "ordering",
    content: `Packaged items are vended from spiral stock and do not use cups or ingredients: ${packagedList}. Each is counted in individual units and can be restocked from the Operator dashboard.`,
    tags: ["packaged", "snack", "water", "cookies", "croissant", "muffin", "sandwich", "chocolate", "bar"],
    intents: ["ORDER_HELP", "PRICE_LOOKUP", "INVENTORY_LOOKUP"],
    entities: PACKAGED_ITEMS.map((p) => p.id),
    prior: 0.7,
  },
  {
    id: "RPT-SALES",
    title: "Sales and revenue reporting",
    category: "reporting",
    content:
      "Revenue is the total of paid orders; declined and cancelled orders add nothing. Drinks served counts drinks that finished dispensing. The Operator dashboard shows today's revenue, paid orders, drinks served, items vended and average ticket, plus revenue by product.",
    tags: ["revenue", "sales", "served", "orders", "today", "report", "earned", "drinks"],
    intents: ["SALES_SUMMARY"],
    entities: [],
    prior: 0.8,
  },
  {
    id: "AST-ABOUT",
    title: "About BREW AI",
    category: "assistant",
    content:
      "BREW AI is an offline assistant. It normalises your question, detects an intent, retrieves documents from a local mock corpus by keyword overlap, and fills a response template with knowledge and live machine data. It does not call any external AI service. Ask about recipes, prices, ingredients, stock, cups, cleaning, machine status, orders or sales.",
    tags: ["help", "assistant", "about", "what", "can", "do", "rag"],
    intents: ["GENERAL_HELP"],
    entities: [],
    prior: 0.6,
  },
];

export const RAG_DOCUMENTS: RagDocument[] = [...PREPARED_DRINKS.map(recipeDoc), ...HANDWRITTEN];
