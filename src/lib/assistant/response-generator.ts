import type { PreparedDrink, Product, ResourceId } from "@/types";
import type { AssistantSnapshot, Entities, Intent, NormalizedQuery, RetrievedDoc, Slot } from "./types";
import { PACKAGED_ITEMS, PREPARED_DRINKS, PRODUCT_MAP } from "@/data/products";
import { CATEGORY_LABELS, CATEGORY_ORDER, CLEANING, SUGAR_GRAMS } from "@/data/config";
import { ingredientList } from "@/data/rag-documents";
import { formatDuration, formatINR, formatQty, formatTime } from "@/lib/currency";
import { packagedStatus, percentRemaining, productAvailability, resourceStatus } from "@/lib/inventory-engine";
import { STATE_META, cleaningRemainingMs, getReadiness } from "@/lib/machine-engine";
import { summarizeSales, revenueByProduct } from "@/store/selectors";

export const TEMPLATES: Record<string, string> = {
  "recipe.drink":
    "**{name}** — {tagline}.\nIngredients: {ingredients}, plus one cup.\nSteps:\n{steps}\nTaste: {taste}\nSugar: {sugar_tip}\n{price} · about {prep_seconds}s · {availability}",
  "recipe.packaged": "**{name}** is a packaged item: {description} It's vended from stock — no recipe or cup needed. {stock} in stock at {price}.",
  "recipe.none": "I can walk you through any recipe on the menu: {list}. Which one would you like?",
  "price.single": "A **{name}** costs **{price}** (GST included).{availability}",
  "price.multi": "Prices (GST included):\n{list}",
  "price.extreme": "The {which} {scope} is **{name}** at **{price}**. {runner_up}",
  "price.list": "Coffee prices (GST included):\n{list}\nOther drinks start at {min_other}.",
  "ingredient.superlative": "**{name}** has the {which} {ingredient} of all {scope} — {amount} per cup.\nRanking: {ranking}",
  "ingredient.product": "A **{name}** needs {ingredients}{sugar}, plus one cup.\nWith current stock the machine can make **{servings}** more{limiting}.",
  "ingredient.usage": "**{ingredient}** is used in: {list}.\nCurrent stock: {stock}.",
  "inventory.resource": "{lines}{estimate}",
  "inventory.all": "Current machine inventory:\n{lines}\nPackaged stock: {packaged}",
  "status.ready": "Yes — the machine is **{state}** and ready to dispense. {cups} cups loaded; nothing is blocking orders. Drinks dispense right after payment on the POS.",
  "status.blocked": "The machine is **{state}** and can't dispense right now:\n{blockers}\n{next_step}",
  "cleaning.active":
    "The machine is in cleaning mode because an auto-clean cycle was started at {started}. It's on stage {stage_no}/{stage_total}: **{stage}** — about {remaining} left. Ordering resumes automatically when it finishes.",
  "cleaning.howto":
    "To start cleaning, open **Machine** or **Operator** and press **Start cycle** in the Auto-clean panel.\n- Uses {agent_per_cycle} cleaning agent + {water_per_cycle} water (you have {agent_stock})\n- Stages: {stages}\n- Ordering is paused until it completes\n{last_clean}",
  "compare.two": "**{a}** vs **{b}**:\n{rows}\n{summary}",
  "compare.need_two": "Name two drinks to compare — for example “flat white vs cappuccino”.{suggestion}",
  "low.list": "These are below their alert thresholds:\n{lines}\nRestock them from the Operator dashboard.",
  "low.none": "Nothing is running low — every resource is above its alert threshold. Lowest right now: {lowest}.",
  "order.rejection": "Your last rejected order was {order_id} at {time}:\n{reasons}\nNo stock was deducted.{fix}",
  "order.no_rejection": "No orders have been rejected. If an order fails, I'll explain exactly which ingredient, cup or payment step caused it.",
  "order.availability": "{answer} **{name}** ({price}): {detail}",
  "order.menu": "Available right now:\n{lines}{unavailable}",
  "order.howto": "To order: pick drinks on the POS, set quantity and sugar, then **Pay & dispense**. Payment is simulated (UPI, card or cash). Stock is deducted only once payment is approved.",
  "sales.summary":
    "Today's revenue is **{revenue_today}** from {orders_today} paid order{orders_s}.\n- Drinks served: {drinks}\n- Packaged items vended: {vended}\n- Average ticket: {avg}\n- Top seller: {top}",
  "help.general":
    "I'm BREW AI, the machine's offline assistant. Ask me about recipes, prices, ingredients, stock and cups, cleaning, machine status, orders or sales — answers use live machine data.",
  fallback:
    "I couldn't match that to something I know. The closest document was “{closest}”. Try asking about a recipe, a price, stock levels, cleaning or why an order failed.",
};

interface Generated {
  templateId: string;
  template: string;
  slots: Slot[];
  answer: string;
}

class SlotBag {
  slots: Slot[] = [];
  set(name: string, value: string | number, source: Slot["source"]): void {
    this.slots.push({ name, value: String(value), source });
  }
  fill(templateId: string): Generated {
    const template = TEMPLATES[templateId];
    const map = new Map(this.slots.map((s) => [s.name, s.value]));
    const answer = template.replace(/\{(\w+)\}/g, (_, k: string) => map.get(k) ?? "");
    return { templateId, template, slots: this.slots, answer: answer.replace(/\n{2,}/g, "\n").trim() };
  }
}

const COFFEES = PREPARED_DRINKS.filter((d) => d.primary);
const drinkOf = (id: string | undefined): PreparedDrink | null => {
  const p = id ? PRODUCT_MAP[id] : undefined;
  return p && p.kind === "prepared_drink" ? p : null;
};

/** If the query named no product, borrow one from the best-ranked document. */
function productFromDocs(docs: RetrievedDoc[]): Product | null {
  for (const r of docs) {
    for (const e of r.doc.entities) if (PRODUCT_MAP[e]) return PRODUCT_MAP[e];
  }
  return null;
}

function availabilityText(product: Product, snap: AssistantSnapshot, bag: SlotBag): string {
  const a = productAvailability(product, snap.inventory, snap.packaged);
  const r = getReadiness(snap.machine, snap.inventory);
  const blockers = product.kind === "prepared_drink" ? r.brewBlockers : r.blockers;
  const text = !a.available
    ? `unavailable — ${a.reason?.toLowerCase()}`
    : blockers.length
      ? `in stock, but ${blockers[0].charAt(0).toLowerCase()}${blockers[0].slice(1)}`
      : `${a.servings} can be made right now`;
  bag.set("availability", text, "live");
  return text;
}

const has = (nq: NormalizedQuery, ...words: string[]) => words.some((w) => nq.expanded.includes(w) || ` ${nq.normalized} `.includes(` ${w} `));

export function generateResponse(input: {
  intent: Intent;
  nq: NormalizedQuery;
  entities: Entities;
  docs: RetrievedDoc[];
  snap: AssistantSnapshot;
  now: number;
}): Generated {
  const { intent, nq, entities, docs, snap, now } = input;
  const bag = new SlotBag();
  const inv = snap.inventory;

  switch (intent) {
    case "RECIPE_LOOKUP": {
      const product = (entities.products[0] && PRODUCT_MAP[entities.products[0]]) || productFromDocs(docs);
      if (!product) {
        bag.set("list", PREPARED_DRINKS.map((d) => d.name).join(", "), "knowledge");
        return bag.fill("recipe.none");
      }
      bag.set("name", product.name, entities.products.length ? "query" : "knowledge");
      if (product.kind === "packaged_item") {
        bag.set("description", product.description, "knowledge");
        bag.set("stock", snap.packaged[product.id]?.quantity ?? 0, "live");
        bag.set("price", formatINR(product.price), "knowledge");
        return bag.fill("recipe.packaged");
      }
      bag.set("tagline", product.tagline, "knowledge");
      bag.set("ingredients", ingredientList(product), "knowledge");
      bag.set("steps", product.steps.map((s, i) => `${i + 1}. ${s.label} — ${s.detail}`).join("\n"), "knowledge");
      bag.set("taste", product.tasteProfile, "knowledge");
      bag.set("sugar_tip", product.sugarRecommendation, "knowledge");
      bag.set("price", formatINR(product.price), "knowledge");
      bag.set("prep_seconds", Math.round(product.prepSeconds), "knowledge");
      availabilityText(product, snap, bag);
      return bag.fill("recipe.drink");
    }

    case "PRICE_LOOKUP": {
      const cheapest = has(nq, "cheapest");
      const priciest = has(nq, "priciest");
      if (cheapest || priciest) {
        const coffeeOnly = has(nq, "coffee");
        const pool = coffeeOnly ? COFFEES : PREPARED_DRINKS;
        const sorted = [...pool].sort((a, b) => (cheapest ? a.price - b.price : b.price - a.price) || a.name.localeCompare(b.name));
        bag.set("which", cheapest ? "cheapest" : "most expensive", "query");
        bag.set("scope", coffeeOnly ? "coffee" : "drink", "query");
        bag.set("name", sorted[0].name, "knowledge");
        bag.set("price", formatINR(sorted[0].price), "knowledge");
        bag.set("runner_up", `Next: ${sorted[1].name} (${formatINR(sorted[1].price)}) and ${sorted[2].name} (${formatINR(sorted[2].price)}).`, "knowledge");
        return bag.fill("price.extreme");
      }
      const products = entities.products.map((id) => PRODUCT_MAP[id]);
      if (products.length === 1) {
        bag.set("name", products[0].name, "query");
        bag.set("price", formatINR(products[0].price), "knowledge");
        const a = productAvailability(products[0], inv, snap.packaged);
        bag.set("availability", a.available ? ` Available now.` : ` Currently unavailable (${a.reason?.toLowerCase()}).`, "live");
        return bag.fill("price.single");
      }
      if (products.length > 1) {
        bag.set("list", products.map((p) => `- **${p.name}**: ${formatINR(p.price)}`).join("\n"), "knowledge");
        return bag.fill("price.multi");
      }
      bag.set("list", COFFEES.map((d) => `- ${d.name}: ${formatINR(d.price)}`).join("\n"), "knowledge");
      bag.set("min_other", formatINR(Math.min(...PREPARED_DRINKS.filter((d) => !d.primary).map((d) => d.price), ...PACKAGED_ITEMS.map((p) => p.price))), "knowledge");
      return bag.fill("price.list");
    }

    case "INGREDIENT_LOOKUP": {
      const ingredient = entities.ingredients.find((i) => i !== "cups");
      const most = has(nq, "most", "highest");
      const least = has(nq, "least", "lowest");
      if (ingredient && (most || least)) {
        const coffeeOnly = has(nq, "coffee");
        const pool = (coffeeOnly ? COFFEES : PREPARED_DRINKS).filter((d) => least || (d.recipe[ingredient as keyof typeof d.recipe] ?? 0) > 0);
        const amount = (d: PreparedDrink) => d.recipe[ingredient as keyof typeof d.recipe] ?? 0;
        const sorted = [...pool].sort((a, b) => (most ? amount(b) - amount(a) : amount(a) - amount(b)) || a.price - b.price);
        const unit = inv[ingredient].unit;
        bag.set("name", sorted[0].name, "knowledge");
        bag.set("which", most ? "most" : "least", "query");
        bag.set("ingredient", inv[ingredient].label.toLowerCase(), "query");
        bag.set("scope", coffeeOnly ? "seven coffees" : "drinks", "query");
        bag.set("amount", formatQty(amount(sorted[0]), unit), "knowledge");
        bag.set("ranking", sorted.slice(0, 5).map((d) => `${d.name} ${formatQty(amount(d), unit)}`).join(" · "), "knowledge");
        return bag.fill("ingredient.superlative");
      }
      const product = drinkOf(entities.products[0]) ?? (entities.products[0] ? null : (productFromDocs(docs) as PreparedDrink | null));
      if (product && product.kind === "prepared_drink") {
        const a = productAvailability(product, inv, snap.packaged);
        bag.set("name", product.name, "query");
        bag.set("ingredients", ingredientList(product), "knowledge");
        bag.set("sugar", product.defaultSugar !== "none" ? ` and ${SUGAR_GRAMS[product.defaultSugar]} g sugar by default` : "", "knowledge");
        bag.set("servings", a.servings, "live");
        bag.set("limiting", a.limiting ? ` (limited by ${a.limiting.toLowerCase()})` : "", "live");
        return bag.fill("ingredient.product");
      }
      if (ingredient) {
        const users = PREPARED_DRINKS.filter((d) => (d.recipe[ingredient as keyof typeof d.recipe] ?? 0) > 0);
        bag.set("ingredient", inv[ingredient].label, "query");
        bag.set("list", users.map((d) => `${d.name} (${formatQty(d.recipe[ingredient as keyof typeof d.recipe] ?? 0, inv[ingredient].unit)})`).join(", ") || "no drinks", "knowledge");
        bag.set("stock", formatQty(inv[ingredient].quantity, inv[ingredient].unit), "live");
        return bag.fill("ingredient.usage");
      }
      bag.set("list", PREPARED_DRINKS.map((d) => d.name).join(", "), "knowledge");
      return bag.fill("recipe.none");
    }

    case "INVENTORY_LOOKUP": {
      const ids = entities.ingredients.length ? entities.ingredients : [];
      if (ids.length) {
        const lines = ids.map((id) => {
          const l = inv[id];
          return `- **${l.label}**: ${formatQty(l.quantity, l.unit)} of ${formatQty(l.capacity, l.unit)} (${Math.round(percentRemaining(l.quantity, l.capacity))}%) · ${resourceStatus(l)}`;
        });
        bag.set("lines", ids.length === 1 ? lines[0].replace(/^- /, "") : lines.join("\n"), "live");
        let estimate = "";
        const first = ids[0];
        if (first === "milk") estimate = `\nThat's enough for about ${Math.floor(inv.milk.quantity / 180)} lattes or ${Math.floor(inv.milk.quantity / 120)} cappuccinos.`;
        else if (first === "coffee") estimate = `\nThat's about ${Math.floor(inv.coffee.quantity / 18)} more coffee shots (18 g each).`;
        else if (first === "cups") estimate = `\nOne cup per drink — ${inv.cups.quantity === 0 ? "drinks are disabled until cups are restocked" : `${inv.cups.quantity} more drinks possible`}.`;
        else if (first === "cleaningAgent") estimate = `\nEnough for ${Math.floor(inv.cleaningAgent.quantity / CLEANING.agentPerCycleMl)} cleaning cycles.`;
        bag.set("estimate", estimate, "live");
        return bag.fill("inventory.resource");
      }
      const lines = (Object.keys(inv) as ResourceId[]).map((id) => {
        const l = inv[id];
        return `- ${l.label}: ${formatQty(l.quantity, l.unit)} (${Math.round(percentRemaining(l.quantity, l.capacity))}%)`;
      });
      bag.set("lines", lines.join("\n"), "live");
      bag.set("packaged", PACKAGED_ITEMS.map((p) => `${p.name} ${snap.packaged[p.id]?.quantity ?? 0}`).join(", "), "live");
      return bag.fill("inventory.all");
    }

    case "MACHINE_STATUS": {
      const r = getReadiness(snap.machine, inv);
      bag.set("state", STATE_META[snap.machine.state].label, "live");
      if (r.brewBlockers.length === 0) {
        bag.set("cups", inv.cups.quantity, "live");
        return bag.fill("status.ready");
      }
      bag.set("blockers", r.brewBlockers.map((b) => `- ${b}`).join("\n"), "live");
      bag.set(
        "next_step",
        snap.machine.state === "CLEANING"
          ? "Wait for the cycle to finish or stop it from the Auto-clean panel."
          : snap.machine.state === "ERROR"
            ? "Acknowledge the fault on the Machine view."
            : inv.cups.quantity === 0
              ? "Restock cups from the Operator dashboard."
              : "It will be ready as soon as the current order completes.",
        "knowledge",
      );
      return bag.fill("status.blocked");
    }

    case "CLEANING_HELP": {
      const run = snap.machine.cleaning;
      if (snap.machine.state === "CLEANING" && run) {
        bag.set("started", formatTime(run.startedAt), "live");
        bag.set("stage_no", run.stageIndex + 1, "live");
        bag.set("stage_total", CLEANING.stages.length, "knowledge");
        bag.set("stage", CLEANING.stages[run.stageIndex].label, "live");
        bag.set("remaining", formatDuration(cleaningRemainingMs(run, now, snap.speed)), "live");
        return bag.fill("cleaning.active");
      }
      bag.set("agent_per_cycle", formatQty(CLEANING.agentPerCycleMl, "ml"), "knowledge");
      bag.set("water_per_cycle", formatQty(CLEANING.waterPerCycleMl, "ml"), "knowledge");
      bag.set("agent_stock", formatQty(inv.cleaningAgent.quantity, "ml"), "live");
      bag.set("stages", CLEANING.stages.map((s) => s.label).join(" → "), "knowledge");
      bag.set(
        "last_clean",
        `Last cleaned: ${snap.machine.lastCleanedAt ? formatTime(snap.machine.lastCleanedAt) : "not this session"} · ${snap.machine.ordersSinceClean} orders since (recommended every ${CLEANING.recommendAfterOrders}).`,
        "live",
      );
      return bag.fill("cleaning.howto");
    }

    case "PRODUCT_COMPARISON": {
      const pair = entities.products.map(drinkOf).filter((d): d is PreparedDrink => Boolean(d));
      if (pair.length < 2) {
        bag.set("suggestion", pair.length === 1 ? ` I can compare ${pair[0].name} with another drink.` : "", "query");
        return bag.fill("compare.need_two");
      }
      const [a, b] = pair;
      const row = (label: string, va: string, vb: string) => `- ${label}: ${va} vs ${vb}`;
      const amt = (d: PreparedDrink, id: keyof PreparedDrink["recipe"], unit: "ml" | "g") => (d.recipe[id] ? formatQty(d.recipe[id]!, unit) : "none");
      bag.set("a", a.name, "query");
      bag.set("b", b.name, "query");
      bag.set(
        "rows",
        [
          row("Price", formatINR(a.price), formatINR(b.price)),
          row("Coffee", amt(a, "coffee", "g"), amt(b, "coffee", "g")),
          row("Milk", amt(a, "milk", "ml"), amt(b, "milk", "ml")),
          row("Strength", `${a.strength}/5`, `${b.strength}/5`),
          row("Prep time", `${Math.round(a.prepSeconds)}s`, `${Math.round(b.prepSeconds)}s`),
        ].join("\n"),
        "knowledge",
      );
      const compareDoc = docs.find((d) => d.doc.category === "comparison" && a && b && d.doc.entities.includes(a.id) && d.doc.entities.includes(b.id));
      bag.set("summary", compareDoc ? compareDoc.highlights.join(" ") : `${a.name}: ${a.tasteProfile} ${b.name}: ${b.tasteProfile}`, "knowledge");
      return bag.fill("compare.two");
    }

    case "LOW_STOCK": {
      const items = [
        ...(Object.keys(inv) as ResourceId[]).map((id) => ({ label: inv[id].label, status: resourceStatus(inv[id]), detail: formatQty(inv[id].quantity, inv[id].unit), pct: percentRemaining(inv[id].quantity, inv[id].capacity) })),
        ...PACKAGED_ITEMS.map((p) => ({ label: p.name, status: packagedStatus(snap.packaged[p.id]), detail: `${snap.packaged[p.id].quantity} left`, pct: percentRemaining(snap.packaged[p.id].quantity, snap.packaged[p.id].capacity) })),
      ];
      const low = items.filter((i) => i.status !== "normal");
      if (low.length === 0) {
        const lowest = [...items].sort((x, y) => x.pct - y.pct)[0];
        bag.set("lowest", `${lowest.label} at ${Math.round(lowest.pct)}%`, "live");
        return bag.fill("low.none");
      }
      bag.set("lines", low.map((i) => `- **${i.label}** — ${i.status.toUpperCase()} (${i.detail})`).join("\n"), "live");
      return bag.fill("low.list");
    }

    case "ORDER_HELP": {
      if (has(nq, "reject", "why")) {
        const rej = snap.lastRejection ?? null;
        const failed = snap.orders.find((o) => o.status === "failed");
        if (!rej && !failed) return bag.fill("order.no_rejection");
        bag.set("order_id", rej?.orderId ?? failed?.id ?? "—", "live");
        bag.set("time", formatTime(rej?.at ?? failed?.updatedAt ?? now), "live");
        bag.set("reasons", (rej?.reasons ?? [failed?.failureReason ?? ""]).map((r) => `- ${r}`).join("\n"), "live");
        bag.set("fix", (rej?.reasons ?? []).some((r) => /replenish|restock|cups/i.test(r)) ? " Restock the item from Operator and try again." : "", "knowledge");
        return bag.fill("order.rejection");
      }
      const product = entities.products[0] ? PRODUCT_MAP[entities.products[0]] : null;
      if (product) {
        const a = productAvailability(product, inv, snap.packaged);
        const r = getReadiness(snap.machine, inv);
        const blockers = product.kind === "prepared_drink" ? r.brewBlockers : r.blockers;
        const yes = a.available && blockers.length === 0;
        bag.set("answer", yes ? "Yes —" : "Not right now —", "live");
        bag.set("name", product.name, "query");
        bag.set("price", formatINR(product.price), "knowledge");
        bag.set(
          "detail",
          !a.available
            ? `${a.reason}. ${product.kind === "prepared_drink" ? `It needs ${ingredientList(product)} and a cup.` : "Restock it from Operator."}`
            : blockers.length
              ? blockers.join(" ")
              : product.kind === "prepared_drink"
                ? `all ingredients and a cup are available (${a.servings} possible, limited by ${a.limiting?.toLowerCase()}).`
                : `${a.servings} in stock.`,
          "live",
        );
        return bag.fill("order.availability");
      }
      if (has(nq, "what can i", "menu", "stock") || has(nq, "now")) {
        const r = getReadiness(snap.machine, inv);
        const avail = [...PREPARED_DRINKS, ...PACKAGED_ITEMS].map((p) => ({ p, a: productAvailability(p, inv, snap.packaged) }));
        const ok = avail.filter(({ p, a }) => a.available && (p.kind === "packaged_item" ? r.canOrder : r.canBrew));
        const no = avail.filter((x) => !ok.includes(x));
        const groups = CATEGORY_ORDER.map((c) => ({ c, items: ok.filter(({ p }) => p.category === c) })).filter((g) => g.items.length);
        bag.set(
          "lines",
          groups.length
            ? groups.map((g) => `- **${CATEGORY_LABELS[g.c]}**: ${g.items.map(({ p }) => `${p.name} ${formatINR(p.price)}`).join(", ")}`).join("\n")
            : "- Nothing — " + (r.brewBlockers[0] ?? "stock is empty"),
          "live",
        );
        bag.set("unavailable", no.length ? `\nUnavailable: ${no.map(({ p, a }) => `${p.name} (${(a.reason ?? r.brewBlockers[0] ?? "machine busy").toLowerCase()})`).join(", ")}.` : "", "live");
        return bag.fill("order.menu");
      }
      return bag.fill("order.howto");
    }

    case "SALES_SUMMARY": {
      const s = summarizeSales(snap.orders, now);
      const top = revenueByProduct(snap.orders)[0];
      bag.set("revenue_today", formatINR(s.revenueToday), "live");
      bag.set("orders_today", s.ordersToday, "live");
      bag.set("orders_s", s.ordersToday === 1 ? "" : "s", "live");
      bag.set("drinks", s.drinksServed, "live");
      bag.set("vended", s.itemsVended, "live");
      bag.set("avg", formatINR(s.averageTicket), "live");
      bag.set("top", top ? `${top.name} (${top.units} sold, ${formatINR(top.revenue)})` : "no sales yet", "live");
      return bag.fill("sales.summary");
    }

    case "GENERAL_HELP":
      return bag.fill("help.general");

    case "FALLBACK":
    default:
      bag.set("closest", docs[0]?.doc.title ?? "none", "knowledge");
      return bag.fill("fallback");
  }
}
