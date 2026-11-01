"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Minus, Plus, ShoppingBag, Trash2, Zap } from "lucide-react";
import type { ResourceId } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { getProduct } from "@/data/products";
import { SUGAR_GRAMS, SUGAR_LABELS, SUGAR_ORDER } from "@/data/config";
import { computeConsumption, describeAmount } from "@/lib/inventory-engine";
import { buildOrderLines, makeOrderId, orderTotals, preflightCart } from "@/lib/order-engine";
import { getReadiness } from "@/lib/machine-engine";
import { formatINR } from "@/lib/currency";
import { ProductArt } from "@/components/product/ProductArt";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button, IconButton } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

export function OrderPanel({ onCheckout, className }: { onCheckout: () => void; className?: string }) {
  const cart = useBrewStore((s) => s.cart);
  const inventory = useBrewStore((s) => s.inventory);
  const packaged = useBrewStore((s) => s.packaged);
  const machine = useBrewStore((s) => s.machine);
  const orderSeq = useBrewStore((s) => s.orderSeq);
  const setQuantity = useBrewStore((s) => s.setQuantity);
  const setLineSugar = useBrewStore((s) => s.setLineSugar);
  const removeLine = useBrewStore((s) => s.removeLine);
  const clearCart = useBrewStore((s) => s.clearCart);

  const lines = buildOrderLines(cart);
  const totals = orderTotals(lines);
  const preflight = preflightCart(cart, inventory, packaged);
  const readiness = getReadiness(machine, inventory);
  const blockers = totals.drinkCount > 0 ? readiness.brewBlockers : readiness.blockers;
  const problems = [...blockers, ...preflight.messages];
  const consumption = computeConsumption(cart);
  const canPay = cart.length > 0 && problems.length === 0;

  const report = (r: { ok: boolean; message: string; details?: string[] }) => {
    if (!r.ok) toast("warning", r.message, r.details?.join(" "));
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <p className="eyebrow">Current order</p>
          <p className="mt-1 font-mono text-[13px] text-ivory-dim">{makeOrderId(orderSeq)}</p>
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart} icon={<Trash2 className="size-3.5" />}>
            Clear
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-white/10">
              <ShoppingBag className="size-5 text-faint" aria-hidden />
            </div>
            <p className="text-[14px] font-medium text-ivory-dim">Your order is empty</p>
            <p className="max-w-[220px] text-[12.5px] leading-relaxed text-faint">
              Tap any drink to add it. Stock is only used once payment succeeds.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Order items">
            <AnimatePresence initial={false}>
              {cart.map((line) => {
                const product = getProduct(line.productId);
                if (!product) return null;
                const drink = product.kind === "prepared_drink" ? product : null;
                return (
                  <motion.li
                    key={line.id}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24, height: 0, marginTop: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 p-2.5">
                      <div className="size-12 shrink-0 rounded-lg bg-black/30">
                        <ProductArt product={product} className="size-12" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13.5px] font-medium text-ivory">{product.name}</p>
                          <p className="tabular text-[13px] text-ivory">{formatINR(product.price * line.quantity)}</p>
                        </div>
                        <p className="tabular mt-0.5 text-[11.5px] text-faint">
                          {formatINR(product.price)} each{drink ? "" : " · packaged"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] px-2.5 py-2">
                      {drink?.allowsSugar ? (
                        <div className="flex rounded-md bg-black/30 p-0.5" role="group" aria-label={`Sugar for ${product.name}`}>
                          {SUGAR_ORDER.map((level) => (
                            <button
                              key={level}
                              type="button"
                              aria-pressed={line.sugar === level}
                              title={`${SUGAR_LABELS[level]} · ${SUGAR_GRAMS[level]} g`}
                              onClick={() => report(setLineSugar(line.id, level))}
                              className={cn(
                                "rounded px-1.5 py-1 text-[10.5px] transition-colors",
                                line.sugar === level ? "bg-white/10 text-ivory" : "text-faint hover:text-ivory-dim",
                              )}
                            >
                              {level === "none" ? "No sugar" : SUGAR_LABELS[level]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-faint">{drink ? "No sugar option" : "Vended from stock"}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <IconButton
                          size="sm"
                          label={line.quantity === 1 ? `Remove ${product.name}` : `Decrease ${product.name}`}
                          onClick={() => (line.quantity === 1 ? removeLine(line.id) : report(setQuantity(line.id, line.quantity - 1)))}
                        >
                          {line.quantity === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                        </IconButton>
                        <span className="tabular w-6 text-center text-[13px] font-medium" aria-live="polite">
                          {line.quantity}
                        </span>
                        <IconButton size="sm" label={`Increase ${product.name}`} onClick={() => report(setQuantity(line.id, line.quantity + 1))}>
                          <Plus className="size-3" />
                        </IconButton>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <footer className="border-t border-white/[0.06] px-5 pb-5 pt-4">
        {cart.length > 0 && Object.keys(consumption.resources).length > 0 && (
          <div className="mb-3">
            <p className="eyebrow mb-1.5">Will use on payment</p>
            <p className="font-mono text-[10.5px] leading-relaxed text-faint">
              {(Object.entries(consumption.resources) as Array<[ResourceId, number]>)
                .map(([id, qty]) => describeAmount(inventory[id], qty))
                .join(" · ")}
            </p>
          </div>
        )}

        <AnimatePresence>
          {cart.length > 0 && problems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden rounded-lg border border-amber/25 bg-amber/[0.06]"
              role="alert"
            >
              <ul className="flex flex-col gap-1 p-3">
                {problems.map((p) => (
                  <li key={p} className="flex gap-2 text-[12px] leading-snug text-amber">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between text-mute">
            <dt>Subtotal · {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}</dt>
            <dd className="tabular">{formatINR(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-faint">
            <dt>GST</dt>
            <dd>Included</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <dt className="text-[14px] text-ivory">Total</dt>
            <dd className="text-[26px] font-semibold tracking-[-0.02em] text-ivory">
              <AnimatedNumber value={totals.total} format={formatINR} />
            </dd>
          </div>
        </dl>

        <Button
          variant="primary"
          size="lg"
          className="mt-4 w-full"
          disabled={!canPay}
          onClick={onCheckout}
          icon={<Zap className="size-4" />}
        >
          {cart.length === 0 ? "Add items to order" : `Pay & dispense · ${formatINR(totals.total)}`}
        </Button>
        <p className="mt-2 text-center text-[10.5px] text-faint">Demo checkout — no real payment is taken</p>
      </footer>
    </div>
  );
}
