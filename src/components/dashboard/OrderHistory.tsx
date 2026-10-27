"use client";

import { Receipt } from "lucide-react";
import type { OrderStatus } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { formatDateTime, formatINR } from "@/lib/currency";
import { ORDER_STATUS_LABELS, PAYMENT_LABELS } from "@/lib/order-engine";
import { cn } from "@/lib/cn";

const STATUS_TONE: Record<OrderStatus, string> = {
  draft: "text-faint",
  awaiting_payment: "text-amber",
  paid: "text-amber",
  preparing: "text-amber",
  completed: "text-lime",
  failed: "text-[#ff8a7f]",
  cancelled: "text-faint",
};

export function OrderHistory() {
  const orders = useBrewStore((s) => s.orders);
  const openReceipt = useUi((s) => s.openReceipt);

  return (
    <section aria-labelledby="orders-title" className="rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="orders-title" className="eyebrow">
          Recent transactions
        </h2>
        <span className="font-mono text-[10.5px] text-faint">{orders.length} total</span>
      </div>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">No transactions yet. Place an order on the POS to see it here.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12.5px]">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                <th className="px-2 pb-2 font-normal">Order</th>
                <th className="px-2 pb-2 font-normal">Time</th>
                <th className="px-2 pb-2 font-normal">Items</th>
                <th className="px-2 pb-2 font-normal">Payment</th>
                <th className="px-2 pb-2 font-normal">Status</th>
                <th className="px-2 pb-2 text-right font-normal">Total</th>
                <th className="px-2 pb-2">
                  <span className="sr-only">Receipt</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 25).map((o) => (
                <tr key={o.id} className="border-t border-white/[0.04] align-top">
                  <td className="px-2 py-2.5 font-mono text-ivory-dim">{o.id}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-faint">{formatDateTime(o.createdAt)}</td>
                  <td className="px-2 py-2.5 text-ivory-dim">{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-faint">{o.paymentMethod ? PAYMENT_LABELS[o.paymentMethod].replace(" (simulated)", "") : "—"}</td>
                  <td className={cn("whitespace-nowrap px-2 py-2.5", STATUS_TONE[o.status])}>{ORDER_STATUS_LABELS[o.status]}</td>
                  <td className="tabular px-2 py-2.5 text-right text-ivory">{formatINR(o.total)}</td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => openReceipt(o.id)}
                      aria-label={`View receipt for ${o.id}`}
                      className="rounded-md p-1.5 text-faint hover:bg-white/5 hover:text-ivory"
                    >
                      <Receipt className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
