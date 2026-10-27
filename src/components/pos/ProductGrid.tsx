"use client";

import { AnimatePresence } from "motion/react";
import type { Product } from "@/types";
import { PRODUCTS, isDrink } from "@/data/products";
import { CATEGORY_LABELS } from "@/data/config";
import { useUi } from "@/store/ui-store";
import { ProductCard } from "./ProductCard";

interface Section {
  id: string;
  title: string;
  subtitle: string;
  products: Product[];
}

function sectionsFor(category: ReturnType<typeof useUi.getState>["category"]): Section[] {
  if (category !== "all") {
    return [
      {
        id: category,
        title: CATEGORY_LABELS[category],
        subtitle: category === "pantry" ? "Packaged items — vended from spiral stock, no cup required" : "Brewed to recipe on demand",
        products: PRODUCTS.filter((p) => p.category === category),
      },
    ];
  }
  return [
    {
      id: "signature",
      title: "Signature coffees",
      subtitle: "Seven recipes, double-shot base, ground to order",
      products: PRODUCTS.filter((p) => isDrink(p) && p.primary),
    },
    {
      id: "cold",
      title: CATEGORY_LABELS.cold,
      subtitle: "Shaken, blended and poured over ice",
      products: PRODUCTS.filter((p) => p.category === "cold"),
    },
    {
      id: "tea",
      title: CATEGORY_LABELS.tea,
      subtitle: "Steeped leaves, masala and dark cocoa",
      products: PRODUCTS.filter((p) => p.category === "tea"),
    },
    {
      id: "pantry",
      title: CATEGORY_LABELS.pantry,
      subtitle: "Packaged items — vended from spiral stock, no cup required",
      products: PRODUCTS.filter((p) => p.category === "pantry"),
    },
  ];
}

export function ProductGrid() {
  const category = useUi((s) => s.category);
  const sections = sectionsFor(category);

  return (
    <div className="flex flex-col gap-9">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`sec-${section.id}`}>
          <div className="mb-3.5 flex items-baseline justify-between gap-4 border-b border-white/[0.05] pb-2.5">
            <h2 id={`sec-${section.id}`} className="font-display text-[26px] leading-none tracking-[-0.01em] text-ivory">
              {section.title}
            </h2>
            <p className="hidden text-right text-[12px] text-faint sm:block">{section.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {section.products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
