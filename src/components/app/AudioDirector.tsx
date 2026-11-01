"use client";

import { useEffect } from "react";
import type { AppView, PlanStep } from "@/types";
import { useBrewStore, type BrewStore } from "@/store/machine-store";
import { announce } from "@/store/announce";
import { getProduct } from "@/data/products";
import { CLEANING } from "@/data/config";
import { worsenedStatuses } from "@/lib/inventory-engine";
import { playMachineSound, playSound, type MachineSound } from "@/lib/sound";

const VIEW_NAMES: Record<AppView, string> = {
  pos: "Order screen.",
  machine: "Machine view.",
  operator: "Operator dashboard.",
};

export const spokenOrder = (id: string) => id.replace(/^BRW-/, "Order number ");

function stepSound(step: PlanStep, hasMilk: boolean): MachineSound | null {
  if (step.phase === "pour") return "pour";
  if (step.phase === "vend") return "vend";
  if (step.phase === "present") return null;
  switch (step.state) {
    case "GRINDING":
      return "grind";
    case "BREWING":
      return "brewing";
    case "MIXING":
      return hasMilk ? "steam" : "brewing";
    case "VALIDATING":
      return "hum";
    default:
      return null;
  }
}

function narrate(step: PlanStep, prev: PlanStep | null, s: BrewStore): string {
  const prep = s.machine.prep!;
  const unit = step.unitIndex !== null ? prep.units[step.unitIndex] : null;
  const name = unit?.name.toLowerCase() ?? "";
  const total = prep.units.length;
  const firstOfUnit = unit && prev?.unitIndex !== step.unitIndex;
  const intro = firstOfUnit && unit.kind === "prepared_drink" ? `Now preparing your ${name}${total > 1 ? `, item ${unit.index + 1} of ${total}` : ""}. ` : "";

  // The payment dialog announces approval together with the order number.
  if (step.state === "ORDER_RECEIVED") return "";
  if (step.state === "VALIDATING") return "Running safety checks. Temperature, pressure and cup sensor.";
  if (step.phase === "vend") return `Releasing your ${name}.`;
  if (step.phase === "present") return `Your ${name} is ready at the collection slot.`;
  if (step.phase === "pour") return `${intro}Pouring your ${name}.`;
  if (step.state === "GRINDING") return `${intro}Grinding fresh beans.`;
  return `${intro}${step.label}.`;
}

/** Turns assistant markdown into something pleasant to listen to. */
function speakable(text: string): string {
  return text
    .replace(/^\d+\.\s/gm, "")
    .replace(/^- /gm, "")
    .replace(/·/g, ",")
    .replace(/\n+/g, ". ")
    .replace(/\.\s*\./g, ".");
}

/**
 * The app's sound and voice layer. Listens to store transitions so every
 * stage of preparation and cleaning is narrated and has a matching sound.
 */
export function AudioDirector() {
  // Soft tap on every button press.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!useBrewStore.getState().settings.soundEnabled) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("button:not(:disabled), [role='tab'], [role='radio'], select, a")) playSound("tap");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    let stopMachine: (() => void) | null = null;
    let chatTimer: number | null = null;

    const unsub = useBrewStore.subscribe((s, prev) => {
      const sound = s.settings.soundEnabled;
      const speed = s.settings.speed;

      const preparing = Boolean(s.machine.prep && s.machine.prep.stepIndex < s.machine.prep.plan.length);
      // The automatic jump to the machine after payment is covered by the narration.
      if (s.view !== prev.view && !(s.view === "machine" && preparing)) announce(VIEW_NAMES[s.view]);

      // Preparation: narrate and sound each step.
      const step = s.machine.prep && s.machine.prep.stepIndex < s.machine.prep.plan.length ? s.machine.prep.plan[s.machine.prep.stepIndex] : null;
      const prevStep =
        prev.machine.prep && prev.machine.prep.stepIndex < prev.machine.prep.plan.length ? prev.machine.prep.plan[prev.machine.prep.stepIndex] : null;
      const stepChanged = step && (step.id !== prevStep?.id || s.machine.prep?.orderId !== prev.machine.prep?.orderId);
      if (stepChanged && step) {
        stopMachine?.();
        stopMachine = null;
        const unit = step.unitIndex !== null ? s.machine.prep!.units[step.unitIndex] : null;
        const product = unit ? getProduct(unit.productId) : undefined;
        const hasMilk = product?.kind === "prepared_drink" && Boolean(product.recipe.milk);
        const kind = stepSound(step, hasMilk);
        if (sound) {
          if (step.state === "ORDER_RECEIVED") playSound("success");
          if (kind) stopMachine = playMachineSound(kind, step.durationMs / speed / 1000);
        }
        const line = narrate(step, prevStep && s.machine.prep?.orderId === prev.machine.prep?.orderId ? prevStep : null, s);
        // Validation follows the payment announcement, so let that finish first.
        if (line) announce(line, { interrupt: step.state !== "VALIDATING" });
      }

      if (s.machine.state !== prev.machine.state) {
        if (s.machine.state === "COMPLETED") {
          stopMachine?.();
          if (sound) playSound("complete");
          const n = s.machine.prep?.units.length ?? 1;
          announce(`Your order is complete. Please collect your ${n > 1 ? "drinks" : "drink"} from the illuminated slot. Enjoy!`);
        }
        if (s.machine.state === "ERROR") {
          if (sound) playSound("error");
          announce(`Attention. ${s.machine.error?.message ?? "Machine fault"}. ${s.machine.error?.details[0] ?? ""}`);
        }
        if (prev.machine.state === "ERROR" && s.machine.state === "IDLE") announce("Fault cleared. The machine is ready.");
      }

      // Cleaning: start, every stage, completion and cancellation.
      const run = s.machine.cleaning;
      const prevRun = prev.machine.cleaning;
      if (run && (!prevRun || run.id !== prevRun.id || run.stageIndex !== prevRun.stageIndex)) {
        stopMachine?.();
        const stage = CLEANING.stages[run.stageIndex];
        if (sound) stopMachine = playMachineSound("rinse", stage.seconds / speed);
        const intro = !prevRun || run.id !== prevRun.id ? "Cleaning cycle started. Ordering is paused. " : "";
        announce(`${intro}Stage ${run.stageIndex + 1} of ${CLEANING.stages.length}: ${stage.label}.`);
      }
      if (!run && prevRun) {
        stopMachine?.();
        stopMachine = null;
        if (s.machine.lastCleanedAt !== prev.machine.lastCleanedAt) {
          if (sound) playSound("clean");
          announce("Cleaning complete. The machine is clean and ready for orders.");
        } else {
          if (sound) playSound("warning");
          announce("Cleaning stopped. Cleaning agent is not refunded.");
        }
      }

      // Stock warnings.
      if (s.inventory !== prev.inventory || s.packaged !== prev.packaged) {
        const changes = worsenedStatuses(prev, s);
        if (changes.length) {
          if (sound) playSound("warning");
          const words = changes.map((c) => `${c.label} is ${c.to === "empty" ? "empty" : c.to === "critical" ? "critically low" : "running low"}`);
          announce(`Warning. ${words.join(". ")}.`, { interrupt: false });
        }
      }

      // BREW AI reads each answer aloud when it starts appearing.
      if (s.chat.length > prev.chat.length) {
        const last = s.chat[s.chat.length - 1];
        if (last?.role === "assistant" && last.revealAt) {
          if (chatTimer) window.clearTimeout(chatTimer);
          chatTimer = window.setTimeout(() => announce(speakable(last.text)), Math.max(0, last.revealAt - Date.now()));
        }
      }
      if (s.chat.length === 0 && prev.chat.length > 0) announce("Chat cleared.");
    });

    return () => {
      unsub();
      stopMachine?.();
      if (chatTimer) window.clearTimeout(chatTimer);
    };
  }, []);

  return null;
}
