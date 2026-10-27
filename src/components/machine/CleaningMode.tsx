"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { Check, Droplets, Square, Sparkles } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { CLEANING, CLEANING_TOTAL_SECONDS } from "@/data/config";
import { canStartCleaning } from "@/lib/machine-engine";
import { formatDuration, formatQty, formatTime } from "@/lib/currency";
import { percentRemaining, resourceStatus } from "@/lib/inventory-engine";
import { Button } from "@/components/ui/Button";
import { STATUS_STYLES } from "@/components/ui/StatusIndicator";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { useMachineProgress } from "./use-machine-progress";

/** Auto-clean controls. Start/stop go through store actions that guard against duplicates. */
export function CleaningMode({ className }: { className?: string }) {
  const machine = useBrewStore((s) => s.machine);
  const inventory = useBrewStore((s) => s.inventory);
  const speed = useBrewStore((s) => s.settings.speed);
  const startCleaning = useBrewStore((s) => s.startCleaning);
  const cancelCleaning = useBrewStore((s) => s.cancelCleaning);
  const progress = useMachineProgress();
  const lastClick = useRef(0);

  const running = machine.state === "CLEANING" && machine.cleaning !== null;
  const check = canStartCleaning(machine.state === "COMPLETED" ? { ...machine, state: "IDLE" } : machine, inventory);
  const agent = inventory.cleaningAgent;
  const agentStatus = resourceStatus(agent);
  const due = machine.ordersSinceClean >= CLEANING.recommendAfterOrders;

  const start = () => {
    // Debounce rapid double-clicks; the store also refuses a second cycle.
    if (Date.now() - lastClick.current < 600) return;
    lastClick.current = Date.now();
    const r = startCleaning();
    if (r.ok) toast("info", "Cleaning cycle started", `${CLEANING.agentPerCycleMl} ml cleaning agent used. Ordering is paused.`);
    else toast("warning", r.message, r.details?.join(" "));
  };

  const stop = () => {
    const r = cancelCleaning();
    if (r.ok) toast("warning", "Cleaning cancelled", r.details?.join(" "));
  };

  return (
    <section className={cn("rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5", running && "border-aqua/25", className)} aria-labelledby="clean-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Auto-clean</p>
          <h3 id="clean-title" className="mt-1.5 flex items-center gap-2 text-[16px] font-medium">
            <span
              className={cn("size-2 rounded-full", running ? "anim-breathe bg-aqua shadow-[0_0_10px_rgba(132,212,230,0.8)]" : due ? "bg-amber" : "bg-lime")}
              aria-hidden
            />
            {running ? "Cycle running" : due ? "Cleaning recommended" : "Clean & sanitised"}
          </h3>
          <p className="mt-1 text-[12px] text-faint">
            {machine.lastCleanedAt ? `Last cleaned ${formatTime(machine.lastCleanedAt)}` : "Not cleaned this session"} · {machine.ordersSinceClean} order
            {machine.ordersSinceClean === 1 ? "" : "s"} since
          </p>
        </div>
        {running ? (
          <Button variant="danger" size="sm" onClick={stop} icon={<Square className="size-3" />}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={start} disabled={!check.ok} icon={<Sparkles className="size-3.5 text-aqua" />}>
            Start cycle
          </Button>
        )}
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11.5px]">
          <span className="text-ivory-dim">Cleaning agent</span>
          <span className={cn("tabular", STATUS_STYLES[agentStatus].text)}>
            {formatQty(agent.quantity, "ml")} / {formatQty(agent.capacity, "ml")}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className={cn("h-full rounded-full", agentStatus === "normal" ? "bg-aqua" : STATUS_STYLES[agentStatus].bar)}
            initial={false}
            animate={{ width: `${percentRemaining(agent.quantity, agent.capacity)}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          Each cycle uses {CLEANING.agentPerCycleMl} ml agent + {CLEANING.waterPerCycleMl} ml water · ~{Math.round(CLEANING_TOTAL_SECONDS / speed)}s
        </p>
      </div>

      {!running && !check.ok && check.reason && (
        <p className="mt-3 rounded-lg border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[12px] leading-relaxed text-amber" role="status">
          {check.reason}
        </p>
      )}

      {running && (
        <div className="mt-4" aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-aqua">
              <Droplets className="size-3.5" aria-hidden />
              {Math.round(progress.cleaningOverall * 100)}%
            </span>
            <span className="tabular text-faint">{formatDuration(progress.cleaningRemainingMs)} remaining</span>
          </div>
          <ol className="flex flex-col gap-1">
            {CLEANING.stages.map((stage, i) => {
              const done = i < progress.cleaningStageIndex;
              const active = i === progress.cleaningStageIndex;
              return (
                <li key={stage.id} className={cn("relative overflow-hidden rounded-lg px-3 py-2", active ? "bg-aqua/[0.07]" : "")}>
                  {active && (
                    <div className="absolute inset-y-0 left-0 bg-aqua/[0.08]" style={{ width: `${progress.cleaningStageProgress * 100}%` }} aria-hidden />
                  )}
                  <div className="relative flex items-center gap-2.5 text-[12.5px]">
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                        done ? "border-lime/50 text-lime" : active ? "border-aqua text-aqua" : "border-white/10 text-faint",
                      )}
                    >
                      {done ? <Check className="size-2.5" /> : i + 1}
                    </span>
                    <span className={active ? "text-ivory" : done ? "text-ivory-dim" : "text-faint"}>{stage.label}</span>
                  </div>
                  {active && <p className="relative ml-[26px] mt-0.5 text-[11px] text-mute">{stage.detail}</p>}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-faint">Stopping early does not refund cleaning agent (demo policy).</p>
        </div>
      )}
    </section>
  );
}
