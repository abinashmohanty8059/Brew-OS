import type { Order } from "@/types";

export interface SalesSummary {
  revenueToday: number;
  revenueAll: number;
  ordersToday: number;
  ordersAll: number;
  drinksServed: number;
  itemsVended: number;
  failedOrders: number;
  averageTicket: number;
}

const isPaid = (o: Order) => o.paymentStatus === "paid";

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Revenue and counts are always derived from orders — never stored twice. */
export function summarizeSales(orders: Order[], now = Date.now()): SalesSummary {
  const today = startOfToday(now);
  const paid = orders.filter(isPaid);
  const paidToday = paid.filter((o) => o.createdAt >= today);
  const dispensed = paid.filter((o) => o.dispenseStatus === "dispensed");
  const revenueAll = paid.reduce((sum, o) => sum + o.total, 0);
  return {
    revenueToday: paidToday.reduce((sum, o) => sum + o.total, 0),
    revenueAll,
    ordersToday: paidToday.length,
    ordersAll: paid.length,
    drinksServed: dispensed.reduce((sum, o) => sum + o.drinkCount, 0),
    itemsVended: dispensed.reduce((sum, o) => sum + (o.itemCount - o.drinkCount), 0),
    failedOrders: orders.filter((o) => o.status === "failed").length,
    averageTicket: paid.length ? Math.round(revenueAll / paid.length) : 0,
  };
}

export function revenueByProduct(orders: Order[]): Array<{ name: string; revenue: number; units: number }> {
  const map = new Map<string, { name: string; revenue: number; units: number }>();
  for (const o of orders) {
    if (!isPaid(o)) continue;
    for (const l of o.lines) {
      const row = map.get(l.productId) ?? { name: l.name, revenue: 0, units: 0 };
      row.revenue += l.lineTotal;
      row.units += l.quantity;
      map.set(l.productId, row);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
