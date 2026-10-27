import type { StockStatus } from "@/types";
import { cn } from "@/lib/cn";

export const STATUS_STYLES: Record<StockStatus, { label: string; text: string; bg: string; dot: string; bar: string }> = {
  normal: { label: "Normal", text: "text-lime", bg: "bg-lime/10", dot: "bg-lime", bar: "bg-lime" },
  low: { label: "Low", text: "text-amber", bg: "bg-amber/10", dot: "bg-amber", bar: "bg-amber" },
  critical: { label: "Critical", text: "text-ember", bg: "bg-ember/10", dot: "bg-ember", bar: "bg-ember" },
  empty: { label: "Empty", text: "text-danger", bg: "bg-danger/10", dot: "bg-danger", bar: "bg-danger" },
};

export function StatusDot({ status, pulse = false, className }: { status: StockStatus; pulse?: boolean; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 anim-breathe", s.dot)} />}
      <span className={cn("relative size-2 rounded-full", s.dot)} />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        s.bg,
        s.text,
        className,
      )}
    >
      <StatusDot status={status} />
      {s.label}
    </span>
  );
}

/** Generic coloured indicator for non-stock states (machine, connection). */
export function Signal({
  tone,
  label,
  pulse = false,
  className,
}: {
  tone: "lime" | "amber" | "danger" | "aqua" | "mute";
  label: string;
  pulse?: boolean;
  className?: string;
}) {
  const dot = {
    lime: "bg-lime shadow-[0_0_10px_rgba(200,243,60,0.7)]",
    amber: "bg-amber shadow-[0_0_10px_rgba(242,169,59,0.6)]",
    danger: "bg-danger shadow-[0_0_10px_rgba(255,93,79,0.6)]",
    aqua: "bg-aqua shadow-[0_0_10px_rgba(132,212,230,0.6)]",
    mute: "bg-faint",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-1.5 rounded-full", dot, pulse && "anim-breathe")} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
