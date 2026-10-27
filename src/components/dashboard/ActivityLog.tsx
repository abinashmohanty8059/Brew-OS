"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { EventLevel } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { formatTimeSeconds } from "@/lib/currency";
import { cn } from "@/lib/cn";

const ICON: Record<EventLevel, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };
const TONE: Record<EventLevel, string> = { info: "text-mute", success: "text-lime", warning: "text-amber", error: "text-danger" };

export function ActivityLog({ limit = 40 }: { limit?: number }) {
  const events = useBrewStore((s) => s.events);
  const shown = events.slice(0, limit);

  return (
    <section aria-labelledby="log-title" className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="log-title" className="eyebrow">
          Machine events
        </h2>
        <span className="font-mono text-[10.5px] text-faint">{events.length} logged</span>
      </div>
      <ol className="flex max-h-[420px] flex-col overflow-y-auto pr-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.map((e) => {
            const Icon = ICON[e.level];
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex gap-2.5 border-b border-white/[0.03] py-2 last:border-0"
              >
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", TONE[e.level])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug text-ivory-dim">{e.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {formatTimeSeconds(e.at)} · {e.kind}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
