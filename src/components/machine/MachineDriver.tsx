"use client";

import { useEffect } from "react";
import { useBrewStore } from "@/store/machine-store";
import { CLEANING } from "@/data/config";

/**
 * The single clock for the machine. Mounted once at the app root so view
 * changes never pause, restart or duplicate a preparation or cleaning run.
 * Each timer passes the step it expects to finish; the store ignores stale ones.
 */
export function MachineDriver() {
  const prep = useBrewStore((s) => s.machine.prep);
  const cleaning = useBrewStore((s) => s.machine.cleaning);
  const state = useBrewStore((s) => s.machine.state);
  const speed = useBrewStore((s) => s.settings.speed);
  const advancePrep = useBrewStore((s) => s.advancePrep);
  const advanceCleaning = useBrewStore((s) => s.advanceCleaning);

  useEffect(() => {
    if (!prep || prep.stepIndex >= prep.plan.length) return;
    const step = prep.plan[prep.stepIndex];
    const wait = Math.max(0, step.durationMs / speed - (Date.now() - prep.stepStartedAt));
    const id = window.setTimeout(() => advancePrep(step.id), wait);
    return () => window.clearTimeout(id);
  }, [prep, speed, advancePrep]);

  useEffect(() => {
    if (!cleaning || state !== "CLEANING") return;
    const stage = CLEANING.stages[cleaning.stageIndex];
    if (!stage) return;
    const wait = Math.max(0, (stage.seconds * 1000) / speed - (Date.now() - cleaning.stageStartedAt));
    const id = window.setTimeout(() => advanceCleaning(cleaning.stageIndex), wait);
    return () => window.clearTimeout(id);
  }, [cleaning, state, speed, advanceCleaning]);

  return null;
}
