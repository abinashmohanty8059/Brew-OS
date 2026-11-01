"use client";

import { AnimatePresence, motion } from "motion/react";
import { PackagePlus } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { resourceStatus } from "@/lib/inventory-engine";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { STATUS_STYLES, StatusBadge } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/cn";

const STACK_SLOTS = 20;

/** Cups are their own resource: one per prepared drink, none for packaged items. */
export function CupDispenser() {
  const cups = useBrewStore((s) => s.inventory.cups);
  const openRestock = useUi((s) => s.openRestock);
  const status = resourceStatus(cups);
  const filled = Math.round((cups.quantity / cups.capacity) * STACK_SLOTS);

  return (
    <section aria-labelledby="cups-title" className="flex flex-col rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="cups-title" className="eyebrow">
            Cup dispenser
          </h2>
          <p className="mt-2 text-[30px] font-medium leading-none tracking-[-0.02em]">
            <AnimatedNumber value={cups.quantity} />
            <span className="text-[14px] text-faint"> / {cups.capacity}</span>
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 flex h-16 items-end gap-[3px]" aria-hidden>
        <AnimatePresence initial={false}>
          {Array.from({ length: STACK_SLOTS }).map((_, i) => (
            <motion.span
              key={i}
              className={cn("flex-1 rounded-t-[3px] border-x border-t", i < filled ? cn("border-white/25", STATUS_STYLES[status].bar, "opacity-70") : "border-white/[0.06] bg-transparent")}
              initial={false}
              animate={{ height: i < filled ? `${55 + (i % 4) * 10}%` : "20%" }}
              transition={{ duration: 0.5, delay: i * 0.015 }}
            />
          ))}
        </AnimatePresence>
      </div>

      <p className={cn("mt-3 text-[12px] leading-relaxed", status === "normal" ? "text-faint" : STATUS_STYLES[status].text)}>
        {status === "empty"
          ? "Cup dispenser empty — prepared drinks are disabled. Bottled water can still be sold."
          : status === "normal"
            ? `One cup per drink. Low-cup alert at ${cups.lowThreshold}.`
            : `Only ${cups.quantity} cups left — replenish soon.`}
      </p>
      <Button
        size="sm"
        variant={status === "normal" ? "secondary" : "primary"}
        className="mt-3 self-start"
        onClick={() => openRestock({ type: "resource", id: "cups" })}
        icon={<PackagePlus className="size-3.5" />}
      >
        Restock cups
      </Button>
    </section>
  );
}
