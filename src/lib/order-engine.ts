import type {
  CartLine,
  Inventory,
  Order,
  OrderLine,
  PackagedInventory,
  PaymentMethod,
  Product,
  Shortage,
} from "@/types";
import { PRODUCT_MAP } from "@/data/products";
import { applyConsumption, computeConsumption, describeShortage, findShortages } from "./inventory-engine";

/* Order lifecycle:
     draft (cart) → awaiting_payment → paid → preparing → completed
                                    ↘ failed (declined / rejected)
                                    ↘ cancelled (customer backed out)

   Demo stock policy: nothing is reserved while a cart is open or a payment
   is pending. Stock is validated when checkout opens, re-validated and
   consumed atomically in processOrder() at the moment payment succeeds.
   Declined or cancelled payments never touch inventory. Animations only
   change order status, never stock. */

export function makeOrderId(seq: number): string {
  return `BRW-${String(seq).padStart(4, "0")}`;
}

export function buildOrderLines(cart: CartLine[], catalog: Record<string, Product> = PRODUCT_MAP): OrderLine[] {
  return cart.flatMap((line) => {
    const product = catalog[line.productId];
    if (!product || line.quantity <= 0) return [];
    return [
      {
        productId: product.id,
        name: product.name,
        kind: product.kind,
        unitPrice: product.price,
        quantity: line.quantity,
        sugar: product.kind === "prepared_drink" ? line.sugar : null,
        lineTotal: product.price * line.quantity,
      },
    ];
  });
}

export function orderTotals(lines: Pick<OrderLine, "unitPrice" | "quantity" | "kind">[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  return {
    subtotal,
    // Prices are GST-inclusive in this demo, so total equals subtotal.
    total: subtotal,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    drinkCount: lines.filter((l) => l.kind === "prepared_drink").reduce((sum, l) => sum + l.quantity, 0),
  };
}

export function createPendingOrder(seq: number, cart: CartLine[], now: number, method: PaymentMethod): Order {
  const lines = buildOrderLines(cart);
  return {
    id: makeOrderId(seq),
    number: seq,
    createdAt: now,
    updatedAt: now,
    lines,
    ...orderTotals(lines),
    paymentMethod: method,
    paymentRef: null,
    paymentStatus: "pending",
    status: "awaiting_payment",
    dispenseStatus: "pending",
    consumption: null,
    failureReason: null,
    completedAt: null,
  };
}

export interface PreflightResult {
  ok: boolean;
  shortages: Shortage[];
  messages: string[];
}

/** Non-mutating stock check for a cart, used before payment and for UI hints. */
export function preflightCart(cart: CartLine[], inventory: Inventory, packaged: PackagedInventory): PreflightResult {
  const consumption = computeConsumption(cart);
  const shortages = findShortages(inventory, packaged, consumption);
  return { ok: shortages.length === 0, shortages, messages: shortages.map(describeShortage) };
}

export type ProcessResult =
  | {
      ok: true;
      order: Order;
      inventory: Inventory;
      packaged: PackagedInventory;
    }
  | {
      ok: false;
      order: Order;
      reasons: string[];
      shortages: Shortage[];
    };

/**
 * The single transactional commit point. Validates machine readiness and
 * every resource for the complete order, then deducts all of it at once.
 * Idempotent: an order that is not awaiting payment is never processed twice.
 */
export function processOrder(input: {
  order: Order;
  inventory: Inventory;
  packaged: PackagedInventory;
  machineBlockers: string[];
  paymentRef: string;
  now: number;
}): ProcessResult {
  const { order, inventory, packaged, machineBlockers, paymentRef, now } = input;

  const fail = (reasons: string[], shortages: Shortage[] = []): ProcessResult => ({
    ok: false,
    reasons,
    shortages,
    order: {
      ...order,
      status: "failed",
      paymentStatus: order.paymentStatus === "paid" ? "paid" : "declined",
      dispenseStatus: "not_dispensed",
      failureReason: reasons.join(" "),
      updatedAt: now,
    },
  });

  if (order.status !== "awaiting_payment") {
    return { ok: false, order, reasons: [`Order ${order.id} was already processed.`], shortages: [] };
  }
  if (order.lines.length === 0) return fail(["The order is empty."]);
  if (machineBlockers.length > 0) return fail(machineBlockers);

  const consumption = computeConsumption(order.lines);
  const shortages = findShortages(inventory, packaged, consumption);
  if (shortages.length > 0) return fail(shortages.map(describeShortage), shortages);

  const next = applyConsumption(inventory, packaged, consumption);
  return {
    ok: true,
    inventory: next.inventory,
    packaged: next.packaged,
    order: {
      ...order,
      status: "paid",
      paymentStatus: "paid",
      paymentRef,
      consumption,
      updatedAt: now,
    },
  };
}

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  preparing: "Preparing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI (simulated)",
  card: "Card (simulated)",
  cash: "Cash (simulated)",
};
