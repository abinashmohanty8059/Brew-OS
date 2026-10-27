"use client";

import type { PlanStep, PrepRun, Product } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { getProduct } from "@/data/products";
import { CLEANING } from "@/data/config";
import { BUSY_STATES, cleaningRemainingMs, remainingPlanMs, totalPlanMs } from "@/lib/machine-engine";
import { useNow } from "@/components/app/LiveClock";

export interface MachineProgress {
  prep: PrepRun | null;
  step: PlanStep | null;
  product: Product | null;
  /** 0–1 progress through the current step. */
  stepProgress: number;
  /** 0–1 progress through the whole order. */
  overall: number;
  remainingMs: number;
  cleaningStageIndex: number;
  cleaningStageProgress: number;
  cleaningOverall: number;
  cleaningRemainingMs: number;
}

/** Derives smooth, time-based progress from the store's step timestamps. */
export function useMachineProgress(): MachineProgress {
  const machine = useBrewStore((s) => s.machine);
  const speed = useBrewStore((s) => s.settings.speed);
  const active = BUSY_STATES.includes(machine.state) || machine.state === "CLEANING";
  const now = useNow(100, active);

  const prep = machine.prep;
  const running = prep && prep.stepIndex < prep.plan.length ? prep : null;
  const step = running ? running.plan[running.stepIndex] : null;
  const unit = step && step.unitIndex !== null && prep ? prep.units[step.unitIndex] : null;
  const elapsed = running ? Math.max(0, now - running.stepStartedAt) : 0;
  const stepProgress = step ? Math.min(1, (elapsed * speed) / step.durationMs) : prep ? 1 : 0;
  const total = prep ? totalPlanMs(prep.plan, speed) : 0;
  const remainingMs = running ? remainingPlanMs(running.plan, running.stepIndex, Math.min(elapsed, step!.durationMs / speed), speed) : 0;
  const overall = prep ? (running ? Math.min(1, 1 - remainingMs / total) : 1) : 0;

  const run = machine.cleaning;
  const cleaningTotal = CLEANING.stages.reduce((s, x) => s + (x.seconds * 1000) / speed, 0);
  const cRemaining = run ? cleaningRemainingMs(run, now, speed) : 0;
  const stage = run ? CLEANING.stages[run.stageIndex] : null;

  return {
    prep,
    step,
    product: unit ? getProduct(unit.productId) ?? null : null,
    stepProgress,
    overall,
    remainingMs,
    cleaningStageIndex: run?.stageIndex ?? -1,
    cleaningStageProgress: run && stage ? Math.min(1, ((now - run.stageStartedAt) * speed) / (stage.seconds * 1000)) : 0,
    cleaningOverall: run ? Math.min(1, 1 - cRemaining / cleaningTotal) : 0,
    cleaningRemainingMs: cRemaining,
  };
}
