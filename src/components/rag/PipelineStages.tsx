"use client";

import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export const PIPELINE = [
  { id: "stage-query", label: "Query" },
  { id: "stage-normalize", label: "Normalize" },
  { id: "stage-retrieve", label: "Retrieve" },
  { id: "stage-rank", label: "Rank" },
  { id: "stage-context", label: "Context" },
  { id: "stage-generate", label: "Generate" },
] as const;

/** Query → Normalize → Retrieve → Rank → Context → Generate, lit up as the trace replays. */
export function PipelineStages({ revealed, onJump }: { revealed: number; onJump: (id: string) => void }) {
  const pct = Math.min(1, revealed / PIPELINE.length);
  return (
    <div className="relative">
      <div className="mb-3 h-[2px] overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label="Pipeline replay" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="h-full bg-gradient-to-r from-crema to-lime" animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.35 }} />
      </div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {PIPELINE.map((stage, i) => {
          const on = i < revealed;
          const current = i === revealed - 1 && revealed < PIPELINE.length;
          return (
            <li key={stage.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onJump(stage.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-300",
                  on ? "border-lime/40 bg-lime/[0.07] text-lime" : "border-white/[0.07] text-faint",
                  current && "shadow-[0_0_18px_rgba(200,243,60,0.25)]",
                )}
              >
                <span className={cn("size-1.5 rounded-full", on ? "bg-lime" : "bg-ink-500", current && "anim-breathe")} />
                {stage.label}
              </button>
              {i < PIPELINE.length - 1 && <ChevronRight className={cn("size-3.5", on ? "text-lime/60" : "text-ink-500")} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
