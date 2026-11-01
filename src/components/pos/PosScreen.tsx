"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { CLEANING, MACHINE } from "@/data/config";
import { getReadiness, STATE_META } from "@/lib/machine-engine";
import { buildOrderLines, orderTotals } from "@/lib/order-engine";
import { formatINR } from "@/lib/currency";
import { Signal } from "@/components/ui/StatusIndicator";
import { Dialog } from "@/components/ui/Dialog";
import { CategoryNav, RecentOrders } from "./CategoryNav";
import { ProductGrid } from "./ProductGrid";
import { OrderPanel } from "./OrderPanel";
import { PaymentDialog } from "./PaymentDialog";
import { announce } from "@/store/announce";

function PosHero() {
  const machine = useBrewStore((s) => s.machine);
  const inventory = useBrewStore((s) => s.inventory);
  const readiness = getReadiness(machine, inventory);
  const meta = STATE_META[machine.state];
  const untilClean = Math.max(0, CLEANING.recommendAfterOrders - machine.ordersSinceClean);

  return (
    <header className="relative mb-8 flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-[radial-gradient(90%_140%_at_100%_0%,rgba(201,154,106,0.14),transparent_55%),linear-gradient(180deg,#121215,#0c0c0e)] p-6 sm:p-8 md:flex-row md:items-end md:justify-between">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-crema/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="eyebrow mb-3">
          {MACHINE.model} · {MACHINE.location}
        </p>
        <h1 className="font-display text-[40px] leading-[0.95] tracking-[-0.02em] text-ivory sm:text-[52px]">
          Intelligence in <em className="whitespace-nowrap text-crema">every pour.</em>
        </h1>
        <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-mute">
          Choose a drink, pay with a simulated UPI, card or cash flow, then watch the machine grind, brew and dispense it — with
          every gram and millilitre tracked.
        </p>
      </div>
      <dl className="relative grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.06] text-left">
        <div className="bg-ink-900/90 px-4 py-3">
          <dt className="eyebrow">Machine</dt>
          <dd className="mt-1.5 text-[13px]">
            <Signal
              tone={readiness.canBrew ? "lime" : readiness.canOrder ? "amber" : meta.tone}
              label={readiness.canBrew ? "Ready" : readiness.canOrder ? "Bottled only" : meta.label}
              pulse={!readiness.canBrew}
            />
          </dd>
        </div>
        <div className="bg-ink-900/90 px-4 py-3">
          <dt className="eyebrow">Cups</dt>
          <dd className="tabular mt-1.5 text-[13px] text-ivory">
            {inventory.cups.quantity}
            <span className="text-faint"> / {inventory.cups.capacity}</span>
          </dd>
        </div>
        <div className="bg-ink-900/90 px-4 py-3">
          <dt className="eyebrow">Next clean</dt>
          <dd className="mt-1.5 text-[13px] text-ivory">{untilClean === 0 ? <span className="text-amber">Due now</span> : `${untilClean} orders`}</dd>
        </div>
      </dl>
    </header>
  );
}

export function PosScreen() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentKey, setPaymentKey] = useState(0);
  const sheetOpen = useUi((s) => s.orderSheetOpen);
  const setSheetOpen = useUi((s) => s.setOrderSheetOpen);
  const cart = useBrewStore((s) => s.cart);
  const totals = orderTotals(buildOrderLines(cart));

  const openCheckout = () => {
    setSheetOpen(false);
    setPaymentKey((k) => k + 1);
    setPaymentOpen(true);
    announce(`Checkout. Your total is ${formatINR(totals.total)}. Choose UPI, card or cash, then press pay.`);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[228px_minmax(0,1fr)_372px]">
      <aside className="hidden min-h-0 flex-col gap-8 overflow-y-auto border-r border-white/[0.05] px-3 py-6 lg:flex" aria-label="Menu navigation">
        <div>
          <p className="eyebrow mb-2 px-3">Menu</p>
          <CategoryNav orientation="vertical" />
        </div>
        <RecentOrders />
      </aside>

      <main className="relative min-h-0 overflow-y-auto px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6" id="menu">
        <PosHero />
        <div className="sticky top-0 z-10 -mx-4 mb-5 bg-ink-950/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
          <CategoryNav orientation="horizontal" />
        </div>
        <ProductGrid />
      </main>

      <aside className="hidden min-h-0 border-l border-white/[0.05] bg-ink-900/60 lg:block" aria-label="Current order">
        <OrderPanel onCheckout={openCheckout} />
      </aside>

      {cart.length > 0 && (
        <div className="fixed inset-x-3 bottom-14 z-30 lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.9)]"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-medium">
              <ShoppingBag className="size-4 text-lime" aria-hidden />
              View order · {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}
            </span>
            <span className="tabular text-[15px] font-semibold">{formatINR(totals.total)}</span>
          </button>
        </div>
      )}

      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Your order" size="md" className="h-[85dvh]">
        <OrderPanel onCheckout={openCheckout} />
      </Dialog>

      <PaymentDialog key={paymentKey} open={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </div>
  );
}
