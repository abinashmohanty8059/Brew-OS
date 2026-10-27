"use client";

import { motion } from "motion/react";
import { Coffee, CupSoda, GlassWater, Leaf, Milk, Sparkles, Sandwich, LayoutGrid, Receipt } from "lucide-react";
import type { MenuCategory } from "@/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/data/config";
import { PRODUCTS } from "@/data/products";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { formatINR, formatTime } from "@/lib/currency";
import { ORDER_STATUS_LABELS } from "@/lib/order-engine";
import { cn } from "@/lib/cn";

const ICONS: Record<MenuCategory | "all", typeof Coffee> = {
  all: LayoutGrid,
  espresso: Coffee,
  black: GlassWater,
  milk: Milk,
  specialty: Sparkles,
  cold: CupSoda,
  tea: Leaf,
  pantry: Sandwich,
};

const ITEMS: Array<MenuCategory | "all"> = ["all", ...CATEGORY_ORDER];

function count(c: MenuCategory | "all") {
  return c === "all" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === c).length;
}

/** Horizontal chips on small screens, vertical list in the desktop sidebar. */
export function CategoryNav({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const category = useUi((s) => s.category);
  const setCategory = useUi((s) => s.setCategory);
  const vertical = orientation === "vertical";

  return (
    <nav aria-label="Menu categories">
      <ul className={cn(vertical ? "flex flex-col gap-0.5" : "flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]")}>
        {ITEMS.map((c) => {
          const Icon = ICONS[c];
          const active = c === category;
          return (
            <li key={c} className={cn(!vertical && "shrink-0")}>
              <button
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg text-left text-[13px] transition-colors",
                  vertical ? "px-3 py-2" : "border border-white/[0.07] px-3 py-1.5",
                  active ? "text-ivory" : "text-mute hover:text-ivory",
                  !vertical && active && "border-lime/40",
                )}
              >
                {active && vertical && (
                  <motion.span
                    layoutId="cat-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                {active && vertical && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-lime" />}
                <Icon className={cn("relative size-4", active ? "text-lime" : "text-faint")} aria-hidden />
                <span className="relative flex-1 whitespace-nowrap">{c === "all" ? "All products" : CATEGORY_LABELS[c]}</span>
                <span className="relative font-mono text-[10.5px] text-faint">{count(c)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RecentOrders() {
  const orders = useBrewStore((s) => s.orders);
  const openReceipt = useUi((s) => s.openReceipt);
  const recent = orders.filter((o) => o.status !== "awaiting_payment").slice(0, 6);

  return (
    <section aria-labelledby="recent-orders-title" className="min-h-0">
      <h2 id="recent-orders-title" className="eyebrow mb-2 px-3">
        Order history
      </h2>
      {recent.length === 0 ? (
        <p className="px-3 text-[12px] leading-relaxed text-faint">No orders yet. Completed orders and receipts appear here.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {recent.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => openReceipt(o.id)}
                className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                aria-label={`View receipt for ${o.id}, ${ORDER_STATUS_LABELS[o.status]}`}
              >
                <Receipt className="size-3.5 shrink-0 text-faint group-hover:text-ivory-dim" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11.5px] text-ivory-dim">{o.id}</span>
                    <span className="tabular text-[11.5px] text-ivory-dim">{formatINR(o.total)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-faint">
                    <span className="truncate">{formatTime(o.createdAt)}</span>
                    <span
                      className={cn(
                        o.status === "completed" && "text-lime/80",
                        (o.status === "failed" || o.status === "cancelled") && "text-[#ff8a7f]/80",
                        (o.status === "preparing" || o.status === "paid") && "text-amber",
                      )}
                    >
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
