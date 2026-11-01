"use client";

import { motion } from "motion/react";
import { Plus, Snowflake, Timer } from "lucide-react";
import type { Product } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { productAvailability } from "@/lib/inventory-engine";
import { formatINR } from "@/lib/currency";
import { ProductArt } from "@/components/product/ProductArt";
import { toast } from "@/components/ui/Toaster";
import { playSound } from "@/lib/sound";
import { announce } from "@/store/announce";
import { cn } from "@/lib/cn";

const INGREDIENT_SHORT: Record<string, string> = {
  coffee: "coffee",
  water: "water",
  milk: "milk",
  chocolate: "choc",
  tea: "tea",
  spice: "masala",
  ice: "ice",
  sugar: "sugar",
};

/** The ingredient that best distinguishes a drink on a small card, e.g. "120ml milk". */
function signatureIngredient(recipe: Partial<Record<string, number>>): string {
  const pick = ["chocolate", "milk", "spice", "tea", "water", "coffee"].find((id) => recipe[id]);
  if (!pick) return "";
  return `${recipe[pick]}${pick === "milk" || pick === "water" ? "ml" : "g"} ${INGREDIENT_SHORT[pick]}`;
}

export function StrengthMeter({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} role="img" aria-label={`Strength ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full", i <= value ? "bg-crema" : "bg-white/10")}
          style={{ height: 4 + i * 2 }}
        />
      ))}
    </span>
  );
}

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const inventory = useBrewStore((s) => s.inventory);
  const packaged = useBrewStore((s) => s.packaged);
  const inCart = useBrewStore((s) => s.cart.filter((l) => l.productId === product.id).reduce((n, l) => n + l.quantity, 0));
  const addToCart = useBrewStore((s) => s.addToCart);
  const soundOn = useBrewStore((s) => s.settings.soundEnabled);

  const availability = productAvailability(product, inventory, packaged);
  const isDrink = product.kind === "prepared_drink";
  const lowStock = availability.available && availability.servings <= 5;

  const onAdd = () => {
    const result = addToCart(product.id);
    if (result.ok) {
      if (soundOn) playSound("add");
      const qty = useBrewStore.getState().cart.filter((l) => l.productId === product.id).reduce((n, l) => n + l.quantity, 0);
      announce(`${product.name} added.${qty > 1 ? ` ${qty} in your order.` : ` ${formatINR(product.price)}.`}`);
    } else {
      if (soundOn) playSound("error");
      toast("warning", result.message, result.details?.join(" "));
      announce(`Sorry. ${result.message}. ${result.details?.[0] ?? ""}`);
    }
  };

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, delay: Math.min(index, 10) * 0.035, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        onClick={onAdd}
        disabled={!availability.available}
        aria-label={`Add ${product.name}, ${formatINR(product.price)}${availability.available ? "" : ` — unavailable: ${availability.reason}`}`}
        className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-850 text-left transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.9)] disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <div className="relative h-40 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_100%,rgba(255,255,255,0.05),transparent_60%)]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <ProductArt
            product={product}
            className={cn(
              "mx-auto mt-2 h-36 w-36 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]",
              !availability.available && "opacity-30 grayscale",
            )}
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {isDrink && product.primary && (
              <span className="rounded-full border border-crema/30 bg-crema/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-crema">
                Signature
              </span>
            )}
            {isDrink && product.temperature === "iced" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-aqua/25 bg-aqua/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-aqua">
                <Snowflake className="size-2.5" /> Iced
              </span>
            )}
          </div>
          {lowStock && (
            <span className="absolute right-3 top-3 rounded-full bg-amber/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-amber">
              {availability.servings} left
            </span>
          )}
          {!availability.available && (
            <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-md border border-danger/30 bg-ink-900/90 px-2 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#ff8a7f]">
              {availability.reason}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ivory">{product.name}</h3>
            <span className="tabular text-[14px] font-medium text-ivory">{formatINR(product.price)}</span>
          </div>
          <p className="line-clamp-2 text-[12.5px] leading-snug text-mute">{product.tagline}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
            {isDrink ? (
              <div className="flex min-w-0 items-center gap-3 font-mono text-[10.5px] text-faint">
                <StrengthMeter value={product.strength} />
                <span className="inline-flex items-center gap-1">
                  <Timer className="size-3" aria-hidden />
                  {Math.round(product.prepSeconds)}s
                </span>
                <span className="truncate">{signatureIngredient(product.recipe)}</span>
              </div>
            ) : (
              <span className="font-mono text-[10.5px] text-faint">
                {availability.servings} {product.unitLabel}
                {availability.servings === 1 ? "" : "s"} in stock · no cup
              </span>
            )}
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                availability.available
                  ? "border-white/10 bg-white/[0.04] text-ivory group-hover:border-lime/60 group-hover:bg-lime group-hover:text-ink-950"
                  : "border-white/5 text-faint",
              )}
              aria-hidden
            >
              <Plus className="size-4" />
              {inCart > 0 && (
                <motion.span
                  key={inCart}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 flex size-4.5 min-w-[18px] items-center justify-center rounded-full bg-lime px-1 font-mono text-[10px] font-semibold text-ink-950"
                >
                  {inCart}
                </motion.span>
              )}
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}
