"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, CircleDot, Plus, Receipt, TriangleAlert } from "lucide-react";
import type { MachineState, ResourceId } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { getProduct } from "@/data/products";
import { SUGAR_LABELS } from "@/data/config";
import { formatDuration, formatINR, formatQty } from "@/lib/currency";
import { describeAmount, percentRemaining, resourceStatus } from "@/lib/inventory-engine";
import { STATE_META } from "@/lib/machine-engine";
import { ProductArt } from "@/components/product/ProductArt";
import { Button } from "@/components/ui/Button";
import { STATUS_STYLES } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/cn";
import { useMachineProgress } from "./use-machine-progress";

const STAGES: MachineState[] = ["ORDER_RECEIVED", "VALIDATING", "GRINDING", "BREWING", "MIXING", "DISPENSING", "COMPLETED"];
const STAGE_SHORT: Partial<Record<MachineState, string>> = {
  ORDER_RECEIVED: "Received",
  VALIDATING: "Validate",
  GRINDING: "Grind",
  BREWING: "Brew",
  MIXING: "Mix",
  DISPENSING: "Dispense",
  COMPLETED: "Done",
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5 backdrop-blur", className)}>{children}</section>;
}

export function PreparationPanel() {
  const machine = useBrewStore((s) => s.machine);
  const orders = useBrewStore((s) => s.orders);
  const inventory = useBrewStore((s) => s.inventory);
  const finishOrder = useBrewStore((s) => s.finishOrder);
  const acknowledgeError = useBrewStore((s) => s.acknowledgeError);
  const setView = useBrewStore((s) => s.setView);
  const openReceipt = useUi((s) => s.openReceipt);
  const progress = useMachineProgress();
  const { prep, step, stepProgress, overall, remainingMs } = progress;
  const state = machine.state;
  const order = prep ? orders.find((o) => o.id === prep.orderId) : undefined;

  if (state === "ERROR") {
    return (
      <Card className="border-danger/25">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-danger/80">Machine fault</p>
            <h2 className="mt-1 text-[17px] font-medium">{machine.error?.message}</h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {machine.error?.details.map((d) => (
                <li key={d} className="text-[13px] leading-relaxed text-ivory-dim">
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-faint">No stock was deducted. Restock from the Operator dashboard, then acknowledge.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={acknowledgeError}>
                Acknowledge fault
              </Button>
              <Button variant="secondary" onClick={() => setView("operator")}>
                Open operator dashboard
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!prep || !order) {
    return (
      <Card>
        <p className="eyebrow">Preparation</p>
        <h2 className="mt-2 font-display text-[30px] leading-none">
          {state === "CLEANING" ? "Cleaning in progress" : "Ready for the next order"}
        </h2>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-mute">
          {state === "CLEANING"
            ? "Ordering is paused until the cycle completes. Progress is shown on the machine display and the cleaning panel."
            : "Orders placed on the POS appear here with their preparation queue, live stage, ingredients being drawn and time remaining."}
        </p>
        {state !== "CLEANING" && (
          <Button variant="primary" className="mt-4" onClick={() => setView("pos")} icon={<Plus className="size-4" />}>
            Start an order
          </Button>
        )}
      </Card>
    );
  }

  const completed = state === "COMPLETED";
  const planStates = new Set(prep.plan.map((s) => s.state));
  const currentStageIdx = completed ? STAGES.length - 1 : STAGES.indexOf(state);
  const lastStepOfUnit = new Map<number, number>();
  prep.plan.forEach((s, i) => s.unitIndex !== null && lastStepOfUnit.set(s.unitIndex, i));
  const queued = prep.units.filter((u) => !completed && (step?.unitIndex ?? -1) < u.index && (lastStepOfUnit.get(u.index) ?? 0) >= prep.stepIndex);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{completed ? "Order complete" : "Now preparing"}</p>
            <h2 className="mt-1.5 font-mono text-[22px] tracking-[-0.01em] text-ivory">{prep.orderId}</h2>
          </div>
          <div className="text-right">
            <p className="eyebrow">{completed ? "Total paid" : "Remaining"}</p>
            <p className="tabular mt-1.5 text-[22px] font-medium">{completed ? formatINR(order.total) : formatDuration(remainingMs)}</p>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Order progress">
          <div className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", completed ? "bg-lime" : "bg-amber")} style={{ width: `${overall * 100}%` }} />
        </div>

        <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Preparation stages">
          {STAGES.map((s, i) => {
            const skipped = s !== "COMPLETED" && !planStates.has(s);
            const done = i < currentStageIdx || completed;
            const active = i === currentStageIdx && !completed;
            return (
              <li key={s} className="flex flex-col items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-[10px] transition-colors",
                    done && !skipped && "border-lime/50 bg-lime/15 text-lime",
                    active && "border-amber bg-amber/15 text-amber",
                    !done && !active && "border-white/10 text-faint",
                    skipped && "border-dashed opacity-40",
                  )}
                >
                  {done && !skipped ? <Check className="size-3" /> : active ? <CircleDot className="size-3 anim-breathe" /> : i + 1}
                </span>
                <span className={cn("text-[9.5px] leading-tight", active ? "text-amber" : done ? "text-ivory-dim" : "text-faint")}>
                  {STAGE_SHORT[s]}
                </span>
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait">
          {step && (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-5 rounded-xl border border-white/[0.05] bg-black/25 p-4"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-ivory">{step.label}</p>
                <span className="font-mono text-[11px] text-amber">{STATE_META[step.state].label}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-mute">{step.detail}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-amber/80" style={{ width: `${stepProgress * 100}%` }} />
              </div>
              {Object.keys(step.consumes).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.entries(step.consumes) as Array<[ResourceId, number]>).map(([id, qty]) => (
                    <span key={id} className="rounded-md border border-amber/20 bg-amber/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-amber">
                      {describeAmount(inventory[id], qty)}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {completed && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => finishOrder("pos")} icon={<Plus className="size-4" />}>
              New order
            </Button>
            <Button variant="secondary" onClick={() => openReceipt(prep.orderId)} icon={<Receipt className="size-4" />}>
              View receipt
            </Button>
            <Button variant="ghost" onClick={() => finishOrder("operator")} icon={<ArrowLeft className="size-4" />}>
              Operator view
            </Button>
          </motion.div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="eyebrow">Preparation queue</h3>
          <span className="font-mono text-[10.5px] text-faint">
            {prep.units.length} item{prep.units.length === 1 ? "" : "s"}
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {prep.units.map((u) => {
            const product = getProduct(u.productId);
            const active = !completed && step?.unitIndex === u.index;
            const done = completed || (lastStepOfUnit.get(u.index) ?? Infinity) < prep.stepIndex;
            const queuePos = queued.findIndex((q) => q.index === u.index);
            return (
              <motion.li
                key={u.index}
                layout
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                  active ? "border-amber/40 bg-amber/[0.05]" : "border-white/[0.04] bg-white/[0.015]",
                )}
              >
                <span className="size-9 shrink-0">{product && <ProductArt product={product} className="size-9" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ivory">{u.name}</span>
                  <span className="block text-[11px] text-faint">
                    {u.kind === "packaged_item" ? "Packaged · vended" : u.sugar ? SUGAR_LABELS[u.sugar] : "Prepared"}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-mono text-[10.5px]",
                    done ? "text-lime" : active ? "text-amber" : "text-faint",
                  )}
                >
                  {done ? "Ready" : active ? "In progress" : queuePos >= 0 ? `Queue #${queuePos + 1}` : "Waiting"}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </Card>

      {completed && order.consumption && (
        <Card>
          <h3 className="eyebrow mb-3">Remaining stock after this order</h3>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {(Object.entries(order.consumption.resources) as Array<[ResourceId, number]>).map(([id, used]) => {
              const level = inventory[id];
              const status = resourceStatus(level);
              return (
                <li key={id}>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-ivory-dim">{level.label}</span>
                    <span className="tabular text-faint">
                      −{formatQty(used, level.unit)} · <span className={STATUS_STYLES[status].text}>{formatQty(level.quantity, level.unit)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={cn("h-full rounded-full", STATUS_STYLES[status].bar)} style={{ width: `${percentRemaining(level.quantity, level.capacity)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
