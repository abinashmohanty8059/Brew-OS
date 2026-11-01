"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import type { ResourceId } from "@/types";
import { useBrewStore, type RestockTarget } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { RESOURCE_ORDER } from "@/data/initial-inventory";
import { PACKAGED_ITEMS, getProduct } from "@/data/products";
import { formatQty } from "@/lib/currency";
import { restockAmount } from "@/lib/inventory-engine";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { announce } from "@/store/announce";

const encode = (t: RestockTarget) => `${t.type}:${t.id}`;
function decode(v: string): RestockTarget {
  const [type, id] = v.split(":");
  return type === "resource" ? { type: "resource", id: id as ResourceId } : { type: "packaged", id };
}

export function RestockDialog() {
  const open = useUi((s) => s.restock.open);
  const initial = useUi((s) => s.restock.target);
  const close = useUi((s) => s.closeRestock);
  // Remount the form each time it opens so it starts from the chosen target.
  return (
    <Dialog open={open} onClose={close} size="sm" eyebrow="Operator" title="Restock machine" description="Adds stock to the shared inventory used by the POS, machine and assistant.">
      {open && <RestockForm key={initial ? encode(initial) : "none"} initial={initial ?? { type: "resource", id: "coffee" }} onDone={close} />}
    </Dialog>
  );
}

function RestockForm({ initial, onDone }: { initial: RestockTarget; onDone: () => void }) {
  const inventory = useBrewStore((s) => s.inventory);
  const packaged = useBrewStore((s) => s.packaged);
  const restock = useBrewStore((s) => s.restock);
  const setThreshold = useBrewStore((s) => s.setThreshold);

  const [target, setTarget] = useState<RestockTarget>(initial);
  const level =
    target.type === "resource"
      ? { label: inventory[target.id].label, quantity: inventory[target.id].quantity, capacity: inventory[target.id].capacity, unit: inventory[target.id].unit as string, low: inventory[target.id].lowThreshold }
      : { label: getProduct(target.id)?.name ?? target.id, quantity: packaged[target.id].quantity, capacity: packaged[target.id].capacity, unit: "units", low: packaged[target.id].lowThreshold };
  const space = Math.max(0, level.capacity - level.quantity);

  const [amount, setAmount] = useState<string>(String(space));
  const [threshold, setThresholdValue] = useState<string>(String(level.low));
  const [error, setError] = useState<string | null>(null);

  const changeTarget = (value: string) => {
    const next = decode(value);
    setTarget(next);
    const nextLevel = next.type === "resource" ? inventory[next.id] : packaged[next.id];
    const nextLow = next.type === "resource" ? inventory[next.id].lowThreshold : packaged[next.id].lowThreshold;
    setAmount(String(Math.max(0, nextLevel.capacity - nextLevel.quantity)));
    setThresholdValue(String(nextLow));
    setError(null);
  };

  const parsed = Number(amount);
  const preview = restockAmount(level.quantity, level.capacity, Number.isFinite(parsed) ? parsed : 0);
  const unit = level.unit === "units" ? "units" : (level.unit as "g" | "ml" | "cups");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const thresholdNum = Number(threshold);
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0 || thresholdNum > level.capacity) {
      setError(`Alert threshold must be between 0 and ${formatQty(level.capacity, unit)}.`);
      return;
    }
    if (thresholdNum !== level.low) setThreshold(target, thresholdNum);

    if (amount.trim() === "" || parsed === 0) {
      if (thresholdNum !== level.low) {
        toast("success", `${level.label} threshold updated`);
        onDone();
        return;
      }
      setError("Enter a quantity greater than zero.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid positive quantity.");
      return;
    }
    const r = restock(target, parsed);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    announce(`${r.message}. Now ${formatQty(r.result?.quantity ?? 0, unit)}.`);
    toast(
      "success",
      r.message,
      `+${formatQty(r.result?.added ?? 0, unit)}${r.result?.clamped ? " (capped at capacity)" : ""} → ${formatQty(r.result?.quantity ?? 0, unit)}`,
    );
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 sm:p-6" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Item</span>
        <select
          value={encode(target)}
          onChange={(e) => changeTarget(e.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-ink-800 px-3 text-[13.5px] text-ivory outline-none focus:border-lime/50"
        >
          <optgroup label="Machine resources">
            {RESOURCE_ORDER.map((id) => (
              <option key={id} value={`resource:${id}`}>
                {inventory[id].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Packaged items">
            {PACKAGED_ITEMS.map((p) => (
              <option key={p.id} value={`packaged:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-mute">Current</span>
          <span className="tabular text-ivory-dim">
            {formatQty(level.quantity, unit)} / {formatQty(level.capacity, unit)}
          </span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="absolute inset-y-0 left-0 bg-lime/30" style={{ width: `${(preview.quantity / level.capacity) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-lime" style={{ width: `${(level.quantity / level.capacity) * 100}%` }} />
        </div>
        <p className="mt-2 text-[11.5px] text-faint">
          After restock: <span className="tabular text-ivory-dim">{formatQty(preview.quantity, unit)}</span>
          {preview.clamped && <span className="text-amber"> · capped at capacity</span>}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Quantity to add ({unit})</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={level.capacity}
          value={amount}
          data-autofocus
          onChange={(e) => {
            setAmount(e.target.value);
            setError(null);
          }}
          className="tabular h-10 rounded-lg border border-white/10 bg-ink-800 px-3 text-[14px] text-ivory outline-none focus:border-lime/50"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "restock-error" : undefined}
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {[0.1, 0.25, 0.5].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setAmount(String(Math.round(level.capacity * f)))}
            className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[11.5px] text-ivory-dim hover:border-white/20"
          >
            +{Math.round(f * 100)}%
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(String(space))}
          className="rounded-md border border-lime/30 px-2.5 py-1 text-[11.5px] text-lime hover:border-lime/60"
        >
          Fill to max
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Low-stock alert threshold ({unit})</span>
        <input
          type="number"
          min={0}
          max={level.capacity}
          value={threshold}
          onChange={(e) => {
            setThresholdValue(e.target.value);
            setError(null);
          }}
          className="tabular h-10 rounded-lg border border-white/10 bg-ink-800 px-3 text-[14px] text-ivory outline-none focus:border-lime/50"
        />
      </label>

      {error && (
        <p id="restock-error" role="alert" className="text-[12.5px] text-[#ff8a7f]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={<PackagePlus className="size-4" />} disabled={space === 0 && Number(threshold) === level.low}>
          {space === 0 ? "Save threshold" : "Restock"}
        </Button>
      </div>
    </form>
  );
}
