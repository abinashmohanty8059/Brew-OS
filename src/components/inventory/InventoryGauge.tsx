"use client";

import { motion } from "motion/react";
import { PackagePlus } from "lucide-react";
import type { StockStatus, Unit } from "@/types";
import { formatQty } from "@/lib/currency";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { STATUS_STYLES, StatusBadge } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/cn";

interface InventoryGaugeProps {
  label: string;
  quantity: number;
  capacity: number;
  unit: Unit | "units";
  status: StockStatus;
  lowThreshold: number;
  onRestock?: () => void;
  compact?: boolean;
}

/** Horizontal gauge with an animated fill, threshold tick and live counter. */
export function InventoryGauge({ label, quantity, capacity, unit, status, lowThreshold, onRestock, compact = false }: InventoryGaugeProps) {
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (quantity / capacity) * 100)) : 0;
  const thresholdPct = capacity > 0 ? Math.min(100, (lowThreshold / capacity) * 100) : 0;
  const s = STATUS_STYLES[status];

  return (
    <div className={cn("group", compact ? "py-1.5" : "py-2.5")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] text-ivory">{label}</span>
          {status !== "normal" && <StatusBadge status={status} />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular text-[12px] text-ivory-dim">
            <AnimatedNumber value={quantity} format={(n) => formatQty(Math.round(n), unit)} />
            <span className="text-faint"> / {formatQty(capacity, unit)}</span>
          </span>
          {onRestock && (
            <button
              type="button"
              onClick={onRestock}
              aria-label={`Restock ${label}`}
              title={`Restock ${label}`}
              className="rounded-md p-1 text-faint transition-colors hover:bg-white/5 hover:text-lime"
            >
              <PackagePlus className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div
        className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.06]"
        role="meter"
        aria-label={`${label} level`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${formatQty(quantity, unit)} of ${formatQty(capacity, unit)}, ${s.label}`}
      >
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", s.bar)}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <span
          className="absolute -top-0.5 h-2.5 w-px bg-white/30"
          style={{ left: `${thresholdPct}%` }}
          title={`Low-stock threshold: ${formatQty(lowThreshold, unit)}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
