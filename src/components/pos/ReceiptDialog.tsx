"use client";

import { RotateCcw } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { MACHINE, SUGAR_LABELS } from "@/data/config";
import { formatDateTime, formatINR } from "@/lib/currency";
import { ORDER_STATUS_LABELS, PAYMENT_LABELS } from "@/lib/order-engine";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

const DISPENSE_LABELS = {
  pending: "Pending",
  in_progress: "Dispensing",
  dispensed: "Dispensed",
  not_dispensed: "Not dispensed",
};

export function ReceiptDialog() {
  const orderId = useUi((s) => s.receiptOrderId);
  const close = useUi((s) => s.closeReceipt);
  const order = useBrewStore((s) => s.orders.find((o) => o.id === orderId));
  const addToCart = useBrewStore((s) => s.addToCart);
  const setView = useBrewStore((s) => s.setView);

  const reorder = () => {
    if (!order) return;
    const failures: string[] = [];
    for (const line of order.lines) {
      for (let i = 0; i < line.quantity; i++) {
        const r = addToCart(line.productId, line.sugar);
        if (!r.ok) {
          failures.push(r.message);
          break;
        }
      }
    }
    close();
    setView("pos");
    if (failures.length) toast("warning", "Some items couldn't be re-added", failures.join(" · "));
    else toast("success", `${order.id} added to a new order`);
  };

  const ok = order?.status === "completed";

  return (
    <Dialog
      open={Boolean(order)}
      onClose={close}
      size="sm"
      eyebrow="Receipt"
      title={order ? `Order ${order.id}` : "Receipt"}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button variant="secondary" onClick={reorder} icon={<RotateCcw className="size-3.5" />}>
            Order again
          </Button>
        </>
      }
    >
      {order && (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-white/[0.07] bg-[#f2ebdd] p-5 font-mono text-[12px] text-[#1b1a17] shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
            <div className="text-center">
              <p className="text-[15px] font-bold tracking-[0.2em]">BREW.OS</p>
              <p className="text-[10.5px] opacity-70">
                {MACHINE.id} · {MACHINE.location}
              </p>
              <p className="mt-1 text-[10.5px] opacity-70">{formatDateTime(order.createdAt)}</p>
            </div>
            <div className="my-3 border-t border-dashed border-black/30" />
            <table className="w-full">
              <caption className="sr-only">Items</caption>
              <thead>
                <tr className="text-left text-[10px] uppercase opacity-60">
                  <th className="pb-1 font-normal">Item</th>
                  <th className="pb-1 text-right font-normal">Qty</th>
                  <th className="pb-1 text-right font-normal">Price</th>
                  <th className="pb-1 text-right font-normal">Amt</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={`${l.productId}-${l.sugar}`} className="align-top">
                    <td className="py-0.5 pr-2">
                      {l.name}
                      {l.sugar && <span className="block text-[10px] opacity-60">{SUGAR_LABELS[l.sugar]}</span>}
                    </td>
                    <td className="py-0.5 text-right">{l.quantity}</td>
                    <td className="py-0.5 text-right">{formatINR(l.unitPrice)}</td>
                    <td className="py-0.5 text-right">{formatINR(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="my-3 border-t border-dashed border-black/30" />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between opacity-60">
              <span>GST</span>
              <span>incl.</span>
            </div>
            <div className="mt-1 flex justify-between text-[14px] font-bold">
              <span>{order.paymentStatus === "paid" ? "TOTAL PAID" : "TOTAL"}</span>
              <span>{formatINR(order.total)}</span>
            </div>
            <div className="my-3 border-t border-dashed border-black/30" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
              <dt className="opacity-60">Payment</dt>
              <dd className="text-right">{order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] : "—"}</dd>
              <dt className="opacity-60">Pay status</dt>
              <dd className="text-right uppercase">{order.paymentStatus}</dd>
              {order.paymentRef && (
                <>
                  <dt className="opacity-60">Ref</dt>
                  <dd className="text-right">{order.paymentRef}</dd>
                </>
              )}
              <dt className="opacity-60">Order</dt>
              <dd className="text-right">{ORDER_STATUS_LABELS[order.status]}</dd>
              <dt className="opacity-60">Dispense</dt>
              <dd className={cn("text-right font-bold", ok ? "text-[#3d6b00]" : "")}>{DISPENSE_LABELS[order.dispenseStatus]}</dd>
            </dl>
            {order.failureReason && <p className="mt-3 text-[10.5px] leading-relaxed opacity-70">{order.failureReason}</p>}
            <p className="mt-4 text-center text-[10px] opacity-50">Simulated transaction · not a tax invoice</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
