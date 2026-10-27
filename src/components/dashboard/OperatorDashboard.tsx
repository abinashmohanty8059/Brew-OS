"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { PackagePlus, RotateCcw, TriangleAlert } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { summarizeSales } from "@/store/selectors";
import { RESOURCE_ORDER } from "@/data/initial-inventory";
import { PACKAGED_ITEMS } from "@/data/products";
import { MACHINE } from "@/data/config";
import { formatINR, formatQty } from "@/lib/currency";
import { packagedStatus, resourceStatus } from "@/lib/inventory-engine";
import { getReadiness, STATE_META } from "@/lib/machine-engine";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Signal, StatusBadge } from "@/components/ui/StatusIndicator";
import { toast } from "@/components/ui/Toaster";
import { InventorySidebar } from "@/components/inventory/InventorySidebar";
import { CleaningMode } from "@/components/machine/CleaningMode";
import { cn } from "@/lib/cn";
import { ActivityLog } from "./ActivityLog";
import { CupDispenser } from "./CupDispenser";
import { OrderHistory } from "./OrderHistory";
import { RevenueChart } from "./RevenueChart";

function Kpi({ label, value, format, hint }: { label: string; value: number; format?: (n: number) => string; hint?: string }) {
  return (
    <div className="bg-ink-850 px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[26px] font-medium leading-none tracking-[-0.02em] text-ivory">
        <AnimatedNumber value={value} format={format} />
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

function LowStockWarnings() {
  const inventory = useBrewStore((s) => s.inventory);
  const packaged = useBrewStore((s) => s.packaged);
  const openRestock = useUi((s) => s.openRestock);

  const warnings = [
    ...RESOURCE_ORDER.map((id) => ({ key: id, label: inventory[id].label, status: resourceStatus(inventory[id]), detail: formatQty(inventory[id].quantity, inventory[id].unit), target: { type: "resource" as const, id } })),
    ...PACKAGED_ITEMS.map((p) => ({ key: p.id, label: p.name, status: packagedStatus(packaged[p.id]), detail: `${packaged[p.id].quantity} left`, target: { type: "packaged" as const, id: p.id } })),
  ].filter((w) => w.status !== "normal");

  return (
    <section aria-labelledby="warn-title" className={cn("rounded-2xl border p-5", warnings.length ? "border-amber/20 bg-amber/[0.03]" : "border-white/[0.06] bg-ink-850/80")}>
      <h2 id="warn-title" className="eyebrow flex items-center gap-2">
        <TriangleAlert className={cn("size-3.5", warnings.length ? "text-amber" : "text-faint")} aria-hidden />
        Low-stock warnings
      </h2>
      {warnings.length === 0 ? (
        <p className="mt-3 text-[13px] text-faint">All resources are above their alert thresholds.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {warnings.map((w) => (
            <li key={w.key} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <StatusBadge status={w.status} />
                <span className="truncate text-[13px] text-ivory">{w.label}</span>
                <span className="tabular shrink-0 text-[12px] text-faint">{w.detail}</span>
              </span>
              <button type="button" onClick={() => openRestock(w.target)} className="shrink-0 text-[12px] text-lime hover:underline">
                Restock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MachineControls() {
  const machine = useBrewStore((s) => s.machine);
  const inventory = useBrewStore((s) => s.inventory);
  const speed = useBrewStore((s) => s.settings.speed);
  const setSettings = useBrewStore((s) => s.setSettings);
  const acknowledgeError = useBrewStore((s) => s.acknowledgeError);
  const resetDemo = useBrewStore((s) => s.resetDemo);
  const setView = useBrewStore((s) => s.setView);
  const [confirmReset, setConfirmReset] = useState(false);
  const meta = STATE_META[machine.state];
  const readiness = getReadiness(machine, inventory);

  return (
    <section aria-labelledby="ctrl-title" className="flex flex-col rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <h2 id="ctrl-title" className="eyebrow">
        Machine state
      </h2>
      <p className="mt-2 text-[17px] font-medium">
        <Signal tone={meta.tone} label={`${machine.state}`} pulse={machine.state !== "IDLE"} className="font-mono text-[15px]" />
      </p>
      <p className="mt-1 text-[12px] text-faint">{readiness.brewBlockers[0] ?? meta.blurb}</p>
      {machine.state === "ERROR" && (
        <Button size="sm" variant="primary" className="mt-3 self-start" onClick={acknowledgeError}>
          Acknowledge fault
        </Button>
      )}
      {machine.state !== "IDLE" && machine.state !== "ERROR" && (
        <Button size="sm" variant="secondary" className="mt-3 self-start" onClick={() => setView("machine")}>
          View machine
        </Button>
      )}

      <div className="mt-5">
        <p className="eyebrow mb-2">Demo speed</p>
        <div className="flex rounded-lg bg-black/30 p-1" role="radiogroup" aria-label="Demo speed">
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              onClick={() => setSettings({ speed: s })}
              className={cn("flex-1 rounded-md py-1 text-[12px]", speed === s ? "bg-white/10 text-ivory" : "text-faint hover:text-ivory-dim")}
            >
              {s}×
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-faint">Speeds up brewing and cleaning timelines for demos.</p>
      </div>

      <Button variant="danger" size="sm" className="mt-auto self-start" onClick={() => setConfirmReset(true)} icon={<RotateCcw className="size-3.5" />}>
        Reset demo data
      </Button>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Reset demo data?"
        description="Restores the original inventory and clears all orders, revenue, events and the current cart. Sound and speed settings are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)} data-autofocus>
              Keep data
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
                toast("success", "Demo reset", "Inventory, orders and revenue restored to defaults.");
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="px-6 py-4 text-[12.5px] text-mute">This can&apos;t be undone.</p>
      </Dialog>
    </section>
  );
}

export function OperatorDashboard() {
  const orders = useBrewStore((s) => s.orders);
  const openRestock = useUi((s) => s.openRestock);
  const sales = summarizeSales(orders);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">
              Operator · {MACHINE.id} · {MACHINE.location}
            </p>
            <h1 className="mt-2 font-display text-[38px] leading-none tracking-[-0.01em]">Operations</h1>
          </div>
          <Button variant="primary" onClick={() => openRestock(null)} icon={<PackagePlus className="size-4" />}>
            Restock
          </Button>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.05] md:grid-cols-3 xl:grid-cols-5"
        >
          <Kpi label="Revenue today" value={sales.revenueToday} format={formatINR} hint={`${formatINR(sales.revenueAll)} all time`} />
          <Kpi label="Paid orders" value={sales.ordersToday} hint={`${sales.failedOrders} failed or declined`} />
          <Kpi label="Drinks served" value={sales.drinksServed} hint="Dispensed and collected" />
          <Kpi label="Items vended" value={sales.itemsVended} hint="Packaged stock" />
          <Kpi label="Average ticket" value={sales.averageTicket} format={formatINR} />
        </motion.div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-5">
            <LowStockWarnings />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <CupDispenser />
              <CleaningMode />
              <MachineControls />
            </div>
            <RevenueChart />
            <OrderHistory />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <InventorySidebar />
            <ActivityLog />
          </div>
        </div>
      </div>
    </div>
  );
}
