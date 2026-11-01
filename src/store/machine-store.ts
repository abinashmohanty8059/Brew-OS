"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AppView,
  CartLine,
  EventKind,
  EventLevel,
  Inventory,
  MachineEvent,
  MachineSnapshot,
  Order,
  PackagedInventory,
  PaymentMethod,
  PaymentOutcome,
  Rejection,
  ResourceId,
  Settings,
  SugarLevel,
} from "@/types";
import { INITIAL_INVENTORY, INITIAL_PACKAGED } from "@/data/initial-inventory";
import { CLEANING, SUGAR_LABELS } from "@/data/config";
import { getProduct } from "@/data/products";
import { applyConsumption, describeAmount, restockAmount, worsenedStatuses, type RestockResult } from "@/lib/inventory-engine";
import { createPendingOrder, preflightCart, processOrder, PAYMENT_LABELS } from "@/lib/order-engine";
import { buildPlan, canStartCleaning, cleaningConsumption, getReadiness } from "@/lib/machine-engine";
import { formatINR, formatQty } from "@/lib/currency";
import { runAssistantQuery } from "@/lib/assistant/pipeline";
import type { QueryTrace } from "@/lib/assistant/types";

export type RestockTarget = { type: "resource"; id: ResourceId } | { type: "packaged"; id: string };

export interface ActionResult {
  ok: boolean;
  message: string;
  details?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /** Assistant replies show a "thinking" indicator until this time, then stream. */
  revealAt?: number;
  /** When the streamed reply has fully appeared. */
  streamEndAt?: number;
  traceId?: string;
}

interface DataState {
  chat: ChatMessage[];
  traces: Record<string, QueryTrace>;
  lastTraceId: string | null;
  inventory: Inventory;
  packaged: PackagedInventory;
  orders: Order[];
  events: MachineEvent[];
  cart: CartLine[];
  machine: MachineSnapshot;
  orderSeq: number;
  lastRejection: Rejection | null;
  settings: Settings;
  view: AppView;
}

interface Actions {
  setView: (view: AppView) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addToCart: (productId: string, sugar?: SugarLevel | null) => ActionResult;
  setQuantity: (lineId: string, quantity: number) => ActionResult;
  setLineSugar: (lineId: string, sugar: SugarLevel) => ActionResult;
  removeLine: (lineId: string) => void;
  clearCart: () => void;

  beginPayment: (method: PaymentMethod) => ActionResult & { orderId?: string };
  settlePayment: (orderId: string, outcome: PaymentOutcome) => ActionResult;
  cancelPayment: (orderId: string) => void;

  advancePrep: (expectedStepId: string) => void;
  finishOrder: (nextView?: AppView) => void;
  acknowledgeError: () => void;

  startCleaning: () => ActionResult;
  advanceCleaning: (expectedStageIndex: number) => void;
  cancelCleaning: () => ActionResult;

  restock: (target: RestockTarget, amount: number) => ActionResult & { result?: RestockResult };
  setThreshold: (target: RestockTarget, threshold: number) => void;
  resetDemo: () => void;

  ask: (query: string) => string | null;
  clearChat: () => void;
}

export type BrewStore = DataState & Actions;

const MAX_EVENTS = 150;
const MAX_ORDERS = 150;
const MAX_CHAT = 40;
let querySeq = 0;

const initialMachine = (): MachineSnapshot => ({
  state: "IDLE",
  prep: null,
  cleaning: null,
  error: null,
  lastCompletedOrderId: null,
  lastCleanedAt: null,
  ordersSinceClean: 0,
});

let eventCounter = 0;
function makeEvent(level: EventLevel, kind: EventKind, message: string, at = Date.now()): MachineEvent {
  eventCounter += 1;
  return { id: `${at.toString(36)}-${eventCounter}`, at, level, kind, message };
}

function initialData(settings?: Settings): DataState {
  const now = Date.now();
  return {
    chat: [],
    traces: {},
    lastTraceId: null,
    inventory: structuredClone(INITIAL_INVENTORY),
    packaged: structuredClone(INITIAL_PACKAGED),
    orders: [],
    events: [makeEvent("info", "system", "BREW.OS booted · machine self-test passed", now)],
    cart: [],
    machine: initialMachine(),
    orderSeq: 1041,
    lastRejection: null,
    settings: settings ?? { soundEnabled: false, speed: 1 },
    view: "pos",
  };
}

const lineKey = (productId: string, sugar: SugarLevel | null) => `${productId}:${sugar ?? "na"}`;

export const useBrewStore = create<BrewStore>()(
  persist(
    (set, get) => {
      const log = (events: MachineEvent[]) =>
        set((s) => ({ events: [...events.reverse(), ...s.events].slice(0, MAX_EVENTS) }));

      /** Validates a would-be cart against current stock without changing anything. */
      const checkCart = (cart: CartLine[]): ActionResult => {
        const { inventory, packaged } = get();
        const preflight = preflightCart(cart, inventory, packaged);
        return preflight.ok
          ? { ok: true, message: "OK" }
          : { ok: false, message: "Not enough stock for that", details: preflight.messages };
      };

      return {
        ...initialData(),

        setView: (view) => set({ view }),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        // ── Cart (draft order). Selecting items never touches stock. ──────────
        addToCart: (productId, sugar) => {
          const product = getProduct(productId);
          if (!product) return { ok: false, message: "Unknown product" };
          if (!product.listed) return { ok: false, message: `${product.name} is not available right now` };
          const sugarLevel = product.kind === "prepared_drink" ? (sugar ?? product.defaultSugar) : null;
          const key = lineKey(productId, sugarLevel);
          const cart = get().cart;
          const existing = cart.find((l) => lineKey(l.productId, l.sugar) === key);
          const next = existing
            ? cart.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l))
            : [...cart, { id: key, productId, quantity: 1, sugar: sugarLevel }];
          const check = checkCart(next);
          if (!check.ok) return { ...check, message: `Can't add another ${product.name}` };
          set({ cart: next });
          return { ok: true, message: `${product.name} added` };
        },

        setQuantity: (lineId, quantity) => {
          const cart = get().cart;
          const line = cart.find((l) => l.id === lineId);
          if (!line) return { ok: false, message: "Line not found" };
          const qty = Math.max(0, Math.min(20, Math.floor(quantity)));
          if (qty === 0) {
            set({ cart: cart.filter((l) => l.id !== lineId) });
            return { ok: true, message: "Removed" };
          }
          const next = cart.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l));
          if (qty > line.quantity) {
            const check = checkCart(next);
            if (!check.ok) return check;
          }
          set({ cart: next });
          return { ok: true, message: "Updated" };
        },

        setLineSugar: (lineId, sugar) => {
          const cart = get().cart;
          const line = cart.find((l) => l.id === lineId);
          if (!line || line.sugar === sugar) return { ok: true, message: "Unchanged" };
          const key = lineKey(line.productId, sugar);
          const twin = cart.find((l) => l.id === key);
          const next = twin
            ? cart.filter((l) => l.id !== lineId).map((l) => (l.id === key ? { ...l, quantity: l.quantity + line.quantity } : l))
            : cart.map((l) => (l.id === lineId ? { ...l, id: key, sugar } : l));
          const check = checkCart(next);
          if (!check.ok) return { ...check, message: `Not enough sugar for ${SUGAR_LABELS[sugar]}` };
          set({ cart: next });
          return { ok: true, message: "Updated" };
        },

        removeLine: (lineId) => set((s) => ({ cart: s.cart.filter((l) => l.id !== lineId) })),
        clearCart: () => set({ cart: [] }),

        // ── Payment & commit ──────────────────────────────────────────────────
        beginPayment: (method) => {
          const state = get();
          const pending = state.orders.find((o) => o.status === "awaiting_payment");
          if (pending) return { ok: true, message: "Payment already in progress", orderId: pending.id };
          if (state.cart.length === 0) return { ok: false, message: "Your order is empty" };

          const hasDrinks = state.cart.some((l) => getProduct(l.productId)?.kind === "prepared_drink");
          const readiness = getReadiness(state.machine, state.inventory);
          const blockers = hasDrinks ? readiness.brewBlockers : readiness.blockers;
          if (blockers.length > 0) return { ok: false, message: "The machine can't take this order yet", details: blockers };

          const check = checkCart(state.cart);
          if (!check.ok) return { ...check, message: "Some items can't be fulfilled" };

          const now = Date.now();
          const order = createPendingOrder(state.orderSeq, state.cart, now, method);
          set((s) => ({ orders: [order, ...s.orders].slice(0, MAX_ORDERS), orderSeq: s.orderSeq + 1 }));
          log([makeEvent("info", "payment", `${order.id} awaiting ${PAYMENT_LABELS[method]} · ${formatINR(order.total)}`, now)]);
          return { ok: true, message: "Awaiting payment", orderId: order.id };
        },

        settlePayment: (orderId, outcome) => {
          const state = get();
          const order = state.orders.find((o) => o.id === orderId);
          if (!order) return { ok: false, message: "Order not found" };
          // Idempotency guard: repeated clicks or timers can't settle twice.
          if (order.status !== "awaiting_payment") {
            return { ok: order.paymentStatus === "paid", message: `Order ${order.id} is already ${order.status}` };
          }
          const now = Date.now();
          const replace = (next: Order) => set((s) => ({ orders: s.orders.map((o) => (o.id === next.id ? next : o)) }));

          if (outcome === "decline") {
            const reason = "Payment was declined by the simulated gateway. No stock was used and nothing was charged.";
            replace({ ...order, status: "failed", paymentStatus: "declined", dispenseStatus: "not_dispensed", failureReason: reason, updatedAt: now });
            set({ lastRejection: { at: now, orderId, reasons: [reason] } });
            log([makeEvent("error", "payment", `${order.id} payment declined (simulated)`, now)]);
            return { ok: false, message: "Payment declined", details: [reason] };
          }

          const hasDrinks = order.drinkCount > 0;
          const readiness = getReadiness(state.machine, state.inventory);
          const result = processOrder({
            order,
            inventory: state.inventory,
            packaged: state.packaged,
            machineBlockers: hasDrinks ? readiness.brewBlockers : readiness.blockers,
            paymentRef: `SIM-${order.paymentMethod?.toUpperCase() ?? "PAY"}-${now.toString(36).toUpperCase().slice(-6)}`,
            now,
          });

          if (!result.ok) {
            const voided = { ...result.order, paymentStatus: "cancelled" as const };
            replace(voided);
            set((s) => ({
              lastRejection: { at: now, orderId, reasons: result.reasons },
              machine:
                s.machine.state === "IDLE" || s.machine.state === "COMPLETED"
                  ? { ...s.machine, state: "ERROR", prep: null, error: { message: "Order rejected at validation", details: result.reasons, at: now } }
                  : s.machine,
            }));
            log([makeEvent("error", "order", `${order.id} rejected: ${result.reasons.join(" ")}`, now)]);
            return { ok: false, message: "Order rejected — payment voided", details: result.reasons };
          }

          const { units, plan } = buildPlan(result.order);
          const alerts = worsenedStatuses({ inventory: state.inventory, packaged: state.packaged }, { inventory: result.inventory, packaged: result.packaged });
          replace(result.order);
          set({
            inventory: result.inventory,
            packaged: result.packaged,
            cart: [],
            lastRejection: null,
            view: "machine",
            machine: {
              ...state.machine,
              state: plan[0].state,
              error: null,
              prep: { orderId, units, plan, stepIndex: 0, stepStartedAt: now, startedAt: now },
            },
          });

          const used = Object.entries(result.order.consumption?.resources ?? {})
            .map(([id, qty]) => describeAmount(state.inventory[id as ResourceId], qty))
            .join(", ");
          log([
            makeEvent("success", "payment", `${order.id} paid · ${formatINR(order.total)} via ${PAYMENT_LABELS[order.paymentMethod ?? "upi"]}`, now),
            makeEvent("info", "inventory", `${order.id} committed · used ${used || "packaged stock only"}`, now),
            ...alerts.map((a) =>
              makeEvent(a.to === "empty" ? "error" : "warning", "inventory", `${a.label} is now ${a.to.toUpperCase()}`, now),
            ),
          ]);
          return { ok: true, message: "Payment approved" };
        },

        cancelPayment: (orderId) => {
          const order = get().orders.find((o) => o.id === orderId);
          if (!order || order.status !== "awaiting_payment") return;
          const now = Date.now();
          set((s) => ({
            orders: s.orders.map((o) =>
              o.id === orderId
                ? { ...o, status: "cancelled", paymentStatus: "cancelled", dispenseStatus: "not_dispensed", failureReason: "Cancelled before payment", updatedAt: now }
                : o,
            ),
          }));
          log([makeEvent("info", "payment", `${orderId} cancelled before payment`, now)]);
        },

        // ── Preparation timeline (driven by MachineDriver) ────────────────────
        advancePrep: (expectedStepId) => {
          const { machine, orders } = get();
          const prep = machine.prep;
          if (!prep || prep.stepIndex >= prep.plan.length) return;
          // Guard against duplicate timers advancing the same step twice.
          if (prep.plan[prep.stepIndex].id !== expectedStepId) return;
          const now = Date.now();
          const nextIndex = prep.stepIndex + 1;
          const order = orders.find((o) => o.id === prep.orderId);

          if (nextIndex >= prep.plan.length) {
            set((s) => ({
              machine: {
                ...s.machine,
                state: "COMPLETED",
                prep: { ...prep, stepIndex: nextIndex, stepStartedAt: now },
                lastCompletedOrderId: prep.orderId,
                ordersSinceClean: s.machine.ordersSinceClean + (order && order.drinkCount > 0 ? 1 : 0),
              },
              orders: s.orders.map((o) =>
                o.id === prep.orderId ? { ...o, status: "completed", dispenseStatus: "dispensed", completedAt: now, updatedAt: now } : o,
              ),
            }));
            log([makeEvent("success", "machine", `${prep.orderId} completed · ${prep.units.length} item${prep.units.length === 1 ? "" : "s"} ready for collection`, now)]);
            return;
          }

          const nextStep = prep.plan[nextIndex];
          const startsPreparing = order && order.status === "paid" && nextStep.unitIndex !== null;
          set((s) => ({
            machine: { ...s.machine, state: nextStep.state, prep: { ...prep, stepIndex: nextIndex, stepStartedAt: now } },
            orders: startsPreparing
              ? s.orders.map((o) => (o.id === prep.orderId ? { ...o, status: "preparing", dispenseStatus: "in_progress", updatedAt: now } : o))
              : s.orders,
          }));
        },

        finishOrder: (nextView = "pos") => {
          set((s) => ({
            view: nextView,
            machine: s.machine.state === "COMPLETED" ? { ...s.machine, state: "IDLE", prep: null } : s.machine,
          }));
        },

        acknowledgeError: () => {
          if (get().machine.state !== "ERROR") return;
          set((s) => ({ machine: { ...s.machine, state: "IDLE", error: null } }));
          log([makeEvent("info", "machine", "Fault acknowledged · machine returned to IDLE")]);
        },

        // ── Cleaning ──────────────────────────────────────────────────────────
        startCleaning: () => {
          const state = get();
          if (state.machine.state === "COMPLETED") get().finishOrder(state.view);
          const machine = get().machine;
          const check = canStartCleaning(machine, state.inventory);
          if (!check.ok) return { ok: false, message: "Cleaning can't start", details: check.reason ? [check.reason] : [] };
          const now = Date.now();
          const before = { inventory: state.inventory, packaged: state.packaged };
          const next = applyConsumption(state.inventory, state.packaged, cleaningConsumption());
          const alerts = worsenedStatuses(before, { inventory: next.inventory, packaged: state.packaged });
          set({
            inventory: next.inventory,
            machine: { ...machine, state: "CLEANING", prep: null, cleaning: { id: `CLN-${now.toString(36).toUpperCase()}`, startedAt: now, stageIndex: 0, stageStartedAt: now } },
          });
          log([
            makeEvent("info", "cleaning", `Cleaning cycle started · used ${CLEANING.agentPerCycleMl} ml agent and ${CLEANING.waterPerCycleMl} ml water`, now),
            ...alerts.map((a) => makeEvent("warning", "inventory", `${a.label} is now ${a.to.toUpperCase()}`, now)),
          ]);
          return { ok: true, message: "Cleaning cycle started" };
        },

        advanceCleaning: (expectedStageIndex) => {
          const { machine } = get();
          const run = machine.cleaning;
          if (!run || machine.state !== "CLEANING" || run.stageIndex !== expectedStageIndex) return;
          const now = Date.now();
          const nextIndex = run.stageIndex + 1;
          if (nextIndex >= CLEANING.stages.length) {
            set((s) => ({ machine: { ...s.machine, state: "IDLE", cleaning: null, lastCleanedAt: now, ordersSinceClean: 0 } }));
            log([makeEvent("success", "cleaning", "Cleaning cycle completed · machine ready", now)]);
            return;
          }
          set((s) => ({ machine: { ...s.machine, cleaning: { ...run, stageIndex: nextIndex, stageStartedAt: now } } }));
        },

        cancelCleaning: () => {
          const { machine } = get();
          if (!machine.cleaning) return { ok: false, message: "No cleaning cycle is running" };
          const stage = CLEANING.stages[machine.cleaning.stageIndex];
          const now = Date.now();
          set((s) => ({ machine: { ...s.machine, state: "IDLE", cleaning: null } }));
          log([
            makeEvent(
              "warning",
              "cleaning",
              `Cleaning cancelled during ${stage.label.toLowerCase()} · agent not refunded (demo policy)`,
              now,
            ),
          ]);
          return { ok: true, message: "Cleaning cancelled", details: ["Cleaning agent is not refunded for cancelled cycles."] };
        },

        // ── Operator ──────────────────────────────────────────────────────────
        restock: (target, amount) => {
          if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Enter a quantity greater than zero" };
          const state = get();
          const now = Date.now();
          if (target.type === "resource") {
            const level = state.inventory[target.id];
            const result = restockAmount(level.quantity, level.capacity, amount);
            if (result.added <= 0) return { ok: false, message: `${level.label} is already full` };
            set((s) => ({ inventory: { ...s.inventory, [target.id]: { ...level, quantity: result.quantity } } }));
            log([makeEvent("success", "inventory", `Restocked ${level.label.toLowerCase()} +${formatQty(result.added, level.unit)}`, now)]);
            return { ok: true, message: `${level.label} restocked`, result };
          }
          const stock = state.packaged[target.id];
          const name = getProduct(target.id)?.name ?? target.id;
          const result = restockAmount(stock.quantity, stock.capacity, Math.floor(amount));
          if (result.added <= 0) return { ok: false, message: `${name} is already full` };
          set((s) => ({ packaged: { ...s.packaged, [target.id]: { ...stock, quantity: result.quantity } } }));
          log([makeEvent("success", "inventory", `Restocked ${name} +${result.added}`, now)]);
          return { ok: true, message: `${name} restocked`, result };
        },

        setThreshold: (target, threshold) => {
          const value = Math.max(0, Math.floor(threshold));
          if (target.type === "resource") {
            set((s) => {
              const level = s.inventory[target.id];
              const low = Math.min(value, level.capacity);
              return {
                inventory: {
                  ...s.inventory,
                  [target.id]: { ...level, lowThreshold: low, criticalThreshold: Math.min(level.criticalThreshold, Math.floor(low * 0.4)) },
                },
              };
            });
          } else {
            set((s) => ({ packaged: { ...s.packaged, [target.id]: { ...s.packaged[target.id], lowThreshold: value } } }));
          }
        },

        resetDemo: () => {
          set({ ...initialData(get().settings), view: "pos" });
        },

        // ── BREW AI ───────────────────────────────────────────────────────────
        ask: (query) => {
          const text = query.trim().slice(0, 300);
          if (!text) return null;
          const s = get();
          const now = Date.now();
          querySeq += 1;
          const id = `Q-${now.toString(36).toUpperCase()}-${querySeq}`;
          // Same pipeline as the RAG Explorer, fed the live shared state.
          const trace = runAssistantQuery(
            text,
            { inventory: s.inventory, packaged: s.packaged, machine: s.machine, orders: s.orders, lastRejection: s.lastRejection, speed: s.settings.speed },
            now,
            id,
          );
          // Paced like an LLM: a short "retrieving" pause, then token-by-token streaming.
          const thinkingMs = 700 + Math.min(600, trace.retrieval.top.length * 150);
          const streamMs = Math.min(9000, Math.max(1200, trace.answer.length * 22));
          const chat = [
            ...s.chat,
            { id: `${id}-u`, role: "user" as const, text, at: now },
            {
              id: `${id}-a`,
              role: "assistant" as const,
              text: trace.answer,
              at: now + thinkingMs,
              revealAt: now + thinkingMs,
              streamEndAt: now + thinkingMs + streamMs,
              traceId: id,
            },
          ].slice(-MAX_CHAT);
          const keep = new Set(chat.map((m) => m.traceId).filter(Boolean));
          const traces = Object.fromEntries(Object.entries({ ...s.traces, [id]: trace }).filter(([k]) => keep.has(k)));
          set({ chat, traces, lastTraceId: id });
          return id;
        },

        clearChat: () => set({ chat: [], traces: {}, lastTraceId: null }),
      };
    },
    {
      name: "brew-os-state",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        chat: s.chat,
        traces: s.traces,
        lastTraceId: s.lastTraceId,
        inventory: s.inventory,
        packaged: s.packaged,
        orders: s.orders,
        events: s.events,
        cart: s.cart,
        machine: s.machine,
        orderSeq: s.orderSeq,
        lastRejection: s.lastRejection,
        settings: s.settings,
        view: s.view,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DataState>;
        // Fall back to fresh defaults for any resource missing from older saves,
        // and drop stock or cart lines for products no longer on the menu.
        const packaged = Object.fromEntries(
          Object.entries({ ...current.packaged, ...(p.packaged ?? {}) }).filter(([id]) => id in current.packaged),
        );
        return {
          ...current,
          ...p,
          cart: (p.cart ?? []).filter((l) => getProduct(l.productId)),
          inventory: { ...current.inventory, ...(p.inventory ?? {}) },
          packaged,
          settings: { ...current.settings, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);
