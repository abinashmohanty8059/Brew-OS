"use client";

import { CupSoda, Droplets, Sparkles } from "lucide-react";
import type { ResourceId } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { CLEANING, CLEANING_TOTAL_SECONDS } from "@/data/config";
import { percentRemaining, resourceStatus } from "@/lib/inventory-engine";
import { getReadiness, STATE_META } from "@/lib/machine-engine";
import { STATUS_STYLES } from "@/components/ui/StatusIndicator";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatQty } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { useNow } from "./LiveClock";

const STRIP: ResourceId[] = ["coffee", "milk", "water", "sugar", "chocolate"];

/** Always-visible machine strip: key levels, cups, cleaning and readiness. */
export function StatusStrip() {
  const inventory = useBrewStore((s) => s.inventory);
  const machine = useBrewStore((s) => s.machine);
  const speed = useBrewStore((s) => s.settings.speed);
  const setView = useBrewStore((s) => s.setView);
  const readiness = getReadiness(machine, inventory);
  const now = useNow(500, machine.state === "CLEANING");
  const cups = inventory.cups;
  const cupStatus = resourceStatus(cups);

  let cleaningLabel = "Clean";
  if (machine.cleaning) {
    const elapsedStages = CLEANING.stages.slice(0, machine.cleaning.stageIndex).reduce((s, x) => s + x.seconds, 0);
    const pct = Math.min(99, Math.round(((elapsedStages + ((now - machine.cleaning.stageStartedAt) / 1000) * speed) / CLEANING_TOTAL_SECONDS) * 100));
    cleaningLabel = `Cleaning ${Math.max(0, pct)}%`;
  } else if (machine.ordersSinceClean >= CLEANING.recommendAfterOrders) {
    cleaningLabel = "Clean due";
  } else if (machine.ordersSinceClean > 0) {
    cleaningLabel = `${machine.ordersSinceClean} since clean`;
  }

  return (
    <footer className="relative z-30 flex h-11 shrink-0 items-center gap-4 overflow-x-auto border-t border-white/[0.06] bg-ink-950/95 px-3 font-mono text-[10.5px] text-mute [scrollbar-width:none] sm:px-4">
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full",
            readiness.canBrew ? "bg-lime shadow-[0_0_8px_rgba(200,243,60,0.8)]" : machine.state === "CLEANING" ? "bg-aqua" : "bg-amber",
          )}
          aria-hidden
        />
        <span className="uppercase tracking-[0.12em] text-ivory-dim">{readiness.canBrew ? "Ready to dispense" : STATE_META[machine.state].label}</span>
      </span>
      <span className="h-4 w-px shrink-0 bg-white/10" />

      {STRIP.map((id) => {
        const level = inventory[id];
        const status = resourceStatus(level);
        const pct = percentRemaining(level.quantity, level.capacity);
        return (
          <Tooltip key={id} content={`${level.label}: ${formatQty(level.quantity, level.unit)} of ${formatQty(level.capacity, level.unit)} · ${STATUS_STYLES[status].label}`}>
            <button type="button" onClick={() => setView("operator")} className="flex shrink-0 items-center gap-2 hover:text-ivory">
              <span>{level.label.replace("Coffee beans", "Beans")}</span>
              <span className="relative h-1 w-12 overflow-hidden rounded-full bg-white/[0.07]">
                <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700", STATUS_STYLES[status].bar)} style={{ width: `${pct}%` }} />
              </span>
              <span className={cn("tabular w-7", status !== "normal" && STATUS_STYLES[status].text)}>{Math.round(pct)}%</span>
            </button>
          </Tooltip>
        );
      })}

      <span className="h-4 w-px shrink-0 bg-white/10" />
      <button type="button" onClick={() => setView("operator")} className={cn("flex shrink-0 items-center gap-1.5 hover:text-ivory", cupStatus !== "normal" && STATUS_STYLES[cupStatus].text)}>
        <CupSoda className="size-3.5" aria-hidden />
        <span className="tabular">{cups.quantity} cups</span>
      </button>
      <button type="button" onClick={() => setView("machine")} className={cn("flex shrink-0 items-center gap-1.5 hover:text-ivory", machine.cleaning && "text-aqua")}>
        {machine.cleaning ? <Droplets className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
        <span>{cleaningLabel}</span>
      </button>
      {speed > 1 && <span className="ml-auto shrink-0 rounded border border-amber/30 px-1.5 py-0.5 text-amber">{speed}× demo speed</span>}
    </footer>
  );
}
