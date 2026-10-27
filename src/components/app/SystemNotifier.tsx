"use client";

import { useEffect } from "react";
import { useBrewStore } from "@/store/machine-store";
import { worsenedStatuses } from "@/lib/inventory-engine";
import { toast } from "@/components/ui/Toaster";

/** Turns store transitions into toasts: low/empty stock, cleaning, completion. */
export function SystemNotifier() {
  useEffect(() => {
    return useBrewStore.subscribe((state, prev) => {
      if (state.inventory !== prev.inventory || state.packaged !== prev.packaged) {
        for (const change of worsenedStatuses(prev, state)) {
          if (change.to === "empty") toast("error", `${change.label} is empty`, "Replenish it from the Operator dashboard.");
          else if (change.to === "critical") toast("warning", `${change.label} is critical`, "Restock soon to avoid rejected orders.");
          else toast("warning", `${change.label} is running low`);
        }
      }
      if (prev.machine.state === "CLEANING" && state.machine.state === "IDLE" && state.machine.lastCleanedAt !== prev.machine.lastCleanedAt) {
        toast("success", "Cleaning cycle complete", "The machine is ready for orders again.");
      }
      if (prev.machine.state !== "COMPLETED" && state.machine.state === "COMPLETED") {
        toast("success", `${state.machine.lastCompletedOrderId} ready`, "Please collect from the illuminated slot.");
      }
    });
  }, []);
  return null;
}
