"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Droplets, TriangleAlert } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { CLEANING } from "@/data/config";
import { formatDuration } from "@/lib/currency";
import { STATE_META } from "@/lib/machine-engine";
import { LiveClock } from "@/components/app/LiveClock";
import type { MachineProgress } from "./use-machine-progress";

const VALIDATION_CHECKS = ["Boiler 93 °C", "Pump 9 bar", "Cup sensor", "Dispense path"];

/** The machine's upper screen. Purely presentational over store state. */
export function MachineDisplay({ progress }: { progress: MachineProgress }) {
  const state = useBrewStore((s) => s.machine.state);
  const error = useBrewStore((s) => s.machine.error);
  const cups = useBrewStore((s) => s.inventory.cups.quantity);
  const lastOrder = useBrewStore((s) => s.machine.lastCompletedOrderId);
  const { prep, step, product, stepProgress, remainingMs } = progress;
  const unitCount = prep?.units.length ?? 0;

  let screenKey: string = state;
  if (step) screenKey = `${state}-${step.id}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-black bg-[#05070a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_10px_30px_rgba(0,0,0,0.9)]">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.018)_0_1px,transparent_1px_3px)]" />
      <div className="pointer-events-none absolute -left-1/4 -top-1/2 h-full w-[70%] rotate-12 bg-gradient-to-b from-white/[0.06] to-transparent" />
      <div className="relative flex h-full flex-col px-[6%] py-[5%] font-mono text-[clamp(8px,1.6vw,11px)] text-ivory-dim">
        <div className="flex items-center justify-between text-[0.85em] uppercase tracking-[0.18em] text-faint">
          <span>{STATE_META[state].label}</span>
          <LiveClock />
        </div>
        <div className="relative mt-[4%] flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={screenKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex flex-col"
            >
              {state === "IDLE" && (
                <>
                  <p className="text-[2.1em] font-semibold tracking-[0.06em] text-lime [text-shadow:0_0_14px_rgba(200,243,60,0.55)]">READY</p>
                  <p className="mt-1 text-faint">Select a drink on the POS</p>
                  <p className="mt-auto flex justify-between text-faint">
                    <span>{cups} cups loaded</span>
                    {lastOrder && <span>last {lastOrder}</span>}
                  </p>
                </>
              )}

              {(state === "ORDER_RECEIVED" || state === "VALIDATING") && prep && (
                <>
                  <p className="text-[1.5em] font-semibold text-amber">{prep.orderId}</p>
                  <p className="text-faint">
                    {unitCount} item{unitCount === 1 ? "" : "s"} · {state === "ORDER_RECEIVED" ? "order received" : "validating"}
                  </p>
                  {state === "VALIDATING" && (
                    <ul className="mt-auto grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {VALIDATION_CHECKS.map((c, i) => {
                        const done = stepProgress > (i + 1) / (VALIDATION_CHECKS.length + 1);
                        return (
                          <li key={c} className={done ? "text-lime" : "text-faint"}>
                            {done ? "✓" : "·"} {c}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {state === "VALIDATING" && <div className="anim-scan pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-amber/10 to-transparent" />}
                </>
              )}

              {(state === "GRINDING" || state === "BREWING" || state === "MIXING" || state === "DISPENSING") && step && (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[1.45em] font-semibold text-ivory">{product?.name ?? step.label}</p>
                    {step.unitIndex !== null && (
                      <span className="shrink-0 text-faint">
                        {step.unitIndex + 1}/{unitCount}
                      </span>
                    )}
                  </div>
                  <p className="text-amber">{step.label}</p>
                  <p className="truncate text-faint">{step.detail}</p>
                  <div className="mt-auto">
                    <div className="mb-1 flex justify-between text-faint">
                      <span>{Math.round(stepProgress * 100)}%</span>
                      <span>ETA {formatDuration(remainingMs)}</span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber shadow-[0_0_8px_rgba(242,169,59,0.8)]" style={{ width: `${stepProgress * 100}%` }} />
                    </div>
                  </div>
                </>
              )}

              {state === "COMPLETED" && (
                <>
                  <p className="flex items-center gap-2 text-[1.6em] font-semibold text-lime [text-shadow:0_0_14px_rgba(200,243,60,0.5)]">
                    <Check className="size-[1.1em]" aria-hidden /> COLLECT
                  </p>
                  <p className="text-ivory-dim">{prep?.orderId} is ready</p>
                  <p className="mt-auto text-faint">Take your order from the lit slot →</p>
                </>
              )}

              {state === "CLEANING" && (
                <>
                  <p className="flex items-center gap-2 text-[1.4em] font-semibold text-aqua">
                    <Droplets className="size-[1em]" aria-hidden /> CLEANING
                  </p>
                  <p className="text-ivory-dim">
                    {progress.cleaningStageIndex + 1}/{CLEANING.stages.length} · {CLEANING.stages[progress.cleaningStageIndex]?.label}
                  </p>
                  <div className="mt-auto">
                    <div className="mb-1 flex justify-between text-faint">
                      <span>{Math.round(progress.cleaningOverall * 100)}%</span>
                      <span>{formatDuration(progress.cleaningRemainingMs)} left</span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-aqua" style={{ width: `${progress.cleaningOverall * 100}%` }} />
                    </div>
                  </div>
                </>
              )}

              {state === "ERROR" && (
                <>
                  <p className="flex items-center gap-2 text-[1.4em] font-semibold text-danger">
                    <TriangleAlert className="size-[1em]" aria-hidden /> FAULT
                  </p>
                  <p className="text-ivory-dim">{error?.message}</p>
                  <p className="mt-auto line-clamp-2 text-faint">{error?.details[0]}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
