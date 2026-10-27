"use client";

import { PackagePlus } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { INGREDIENT_ORDER } from "@/data/initial-inventory";
import { PACKAGED_ITEMS } from "@/data/products";
import { packagedStatus, resourceStatus } from "@/lib/inventory-engine";
import { Button } from "@/components/ui/Button";
import { InventoryGauge } from "./InventoryGauge";

/** Live inventory for every machine resource and packaged item. */
export function InventorySidebar() {
  const inventory = useBrewStore((s) => s.inventory);
  const packaged = useBrewStore((s) => s.packaged);
  const openRestock = useUi((s) => s.openRestock);

  return (
    <section aria-labelledby="inv-title" className="rounded-2xl border border-white/[0.06] bg-ink-850/80 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="inv-title" className="eyebrow">
          Machine inventory
        </h2>
        <Button size="sm" variant="secondary" onClick={() => openRestock(null)} icon={<PackagePlus className="size-3.5" />}>
          Restock
        </Button>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {[...INGREDIENT_ORDER, "cleaningAgent" as const].map((id) => {
          const level = inventory[id];
          return (
            <InventoryGauge
              key={id}
              label={level.label}
              quantity={level.quantity}
              capacity={level.capacity}
              unit={level.unit}
              status={resourceStatus(level)}
              lowThreshold={level.lowThreshold}
              onRestock={() => openRestock({ type: "resource", id })}
            />
          );
        })}
      </div>

      <h3 className="eyebrow mb-1 mt-6">Packaged stock</h3>
      <div className="divide-y divide-white/[0.04]">
        {PACKAGED_ITEMS.map((p) => {
          const stock = packaged[p.id];
          return (
            <InventoryGauge
              key={p.id}
              compact
              label={p.name}
              quantity={stock.quantity}
              capacity={stock.capacity}
              unit="units"
              status={packagedStatus(stock)}
              lowThreshold={stock.lowThreshold}
              onRestock={() => openRestock({ type: "packaged", id: p.id })}
            />
          );
        })}
      </div>
    </section>
  );
}
