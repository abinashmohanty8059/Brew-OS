"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ResourceId } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { getProduct } from "@/data/products";
import { CLEANING } from "@/data/config";
import { percentRemaining, resourceStatus } from "@/lib/inventory-engine";
import { STATUS_STYLES } from "@/components/ui/StatusIndicator";
import { PackagedArt } from "@/components/product/ProductArt";
import { cn } from "@/lib/cn";
import { MachineDisplay } from "./MachineDisplay";
import { MachineCup } from "./MachineCup";
import { useMachineProgress } from "./use-machine-progress";

/** Positions an overlay using the 500×800 machine coordinate system. */
const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${x / 5}%`,
  top: `${y / 8}%`,
  width: `${w / 5}%`,
  height: `${h / 8}%`,
});

const METERS: ResourceId[] = ["coffee", "milk", "water", "sugar", "chocolate"];
const METER_SHORT: Partial<Record<ResourceId, string>> = { coffee: "BEAN", milk: "MILK", water: "H2O", sugar: "SUGR", chocolate: "CHOC" };

const CUP_BREW_X = 172;
const CUP_SLOT_X = 362;
const CUP_ENTRY_X = 60;
const NOZZLE_X = 207;

const AMBIENT = {
  idle: "rgba(200,243,60,0.10)",
  busy: "rgba(242,169,59,0.22)",
  done: "rgba(200,243,60,0.24)",
  clean: "rgba(132,212,230,0.22)",
  error: "rgba(255,93,79,0.22)",
};

export function VendingMachine({ className }: { className?: string }) {
  const machine = useBrewStore((s) => s.machine);
  const inventory = useBrewStore((s) => s.inventory);
  const reduce = useReducedMotion();
  const progress = useMachineProgress();
  const { prep, step, stepProgress } = progress;
  const state = machine.state;

  const busy = ["ORDER_RECEIVED", "VALIDATING", "GRINDING", "BREWING", "MIXING", "DISPENSING"].includes(state);
  const ambient =
    state === "CLEANING" ? AMBIENT.clean : state === "ERROR" ? AMBIENT.error : state === "COMPLETED" ? AMBIENT.done : busy ? AMBIENT.busy : AMBIENT.idle;

  // Which cup (if any) is in the bay, and where.
  const lastDrinkUnit = prep ? [...prep.units].reverse().find((u) => u.kind === "prepared_drink") ?? null : null;
  const activeUnit = step && step.unitIndex !== null && prep ? prep.units[step.unitIndex] : null;
  const cupUnit = activeUnit?.kind === "prepared_drink" ? activeUnit : state === "COMPLETED" ? lastDrinkUnit : null;
  const cupProduct = cupUnit ? getProduct(cupUnit.productId) : undefined;
  const cupDrink = cupProduct?.kind === "prepared_drink" ? cupProduct : null;
  const atSlot = state === "COMPLETED" || step?.phase === "present";
  const cupFill = atSlot ? 1 : step?.phase === "pour" ? stepProgress : 0;

  const vendUnit = step?.phase === "vend" && activeUnit ? getProduct(activeUnit.productId) : undefined;
  const pouring = step?.phase === "pour";
  const streamColor = cupDrink?.visual.layers[cupDrink.visual.layers.length - 1]?.color ?? "#3b2216";

  // Brewing-chamber contents per stage.
  let chamberLevel = 0;
  let chamberColor = "#3b2216";
  if (state === "GRINDING") {
    chamberLevel = 0.08 + 0.18 * stepProgress;
    chamberColor = "#5a3a24";
  } else if (state === "BREWING") {
    chamberLevel = 0.26 + 0.4 * stepProgress;
    chamberColor = cupDrink?.recipe.tea ? "#a8672f" : "#4a2816";
  } else if (state === "MIXING") {
    chamberLevel = 0.66 + 0.14 * stepProgress;
    chamberColor = cupDrink?.visual.layers[cupDrink.visual.layers.length - 1]?.color ?? "#a87b57";
  } else if (pouring) {
    chamberLevel = 0.8 * (1 - stepProgress);
    chamberColor = streamColor;
  } else if (state === "CLEANING") {
    chamberLevel = 0.35 + 0.25 * Math.sin(progress.cleaningOverall * Math.PI * 6) ** 2;
    chamberColor = "rgba(132,212,230,0.55)";
  }

  const cupsShown = Math.min(10, inventory.cups.quantity);
  const cleanDue = machine.ordersSinceClean >= CLEANING.recommendAfterOrders;

  const leds = [
    { label: "Power", on: true, color: "#c8f33c", pulse: state === "IDLE" },
    { label: "Brew", on: busy, color: "#f2a93b", pulse: busy },
    { label: "Clean", on: state === "CLEANING" || cleanDue, color: "#84d4e6", pulse: state === "CLEANING" || cleanDue },
    { label: "Fault", on: state === "ERROR", color: "#ff5d4f", pulse: state === "ERROR" },
  ];

  return (
    <div className={cn("relative mx-auto aspect-[5/8] w-full", className)} role="img" aria-label={`Vending machine, state ${state.toLowerCase()}`}>
      {/* Ambient light behind the machine */}
      <motion.div
        aria-hidden
        className="absolute -inset-[12%] -z-10 rounded-full blur-3xl"
        animate={{ background: `radial-gradient(closest-side, ${ambient}, transparent)` }}
        transition={{ duration: 1.2 }}
      />

      {/* Shell */}
      <svg viewBox="0 0 500 800" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="vm-shell" x1="0" x2="1">
            <stop offset="0" stopColor="#2a2a30" />
            <stop offset="0.06" stopColor="#141417" />
            <stop offset="0.5" stopColor="#18181c" />
            <stop offset="0.94" stopColor="#121215" />
            <stop offset="1" stopColor="#2e2e35" />
          </linearGradient>
          <linearGradient id="vm-steel" x1="0" x2="1">
            <stop offset="0" stopColor="#5d5d66" />
            <stop offset="0.3" stopColor="#b9b9c2" />
            <stop offset="0.55" stopColor="#7d7d87" />
            <stop offset="1" stopColor="#3c3c44" />
          </linearGradient>
          <linearGradient id="vm-bay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050506" />
            <stop offset="1" stopColor="#101013" />
          </linearGradient>
          <linearGradient id="vm-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <pattern id="vm-brush" width="3" height="800" patternUnits="userSpaceOnUse">
            <rect width="1" height="800" fill="#fff" opacity="0.025" />
          </pattern>
        </defs>

        {/* body */}
        <rect x="14" y="10" width="472" height="780" rx="32" fill="#09090b" />
        <rect x="18" y="14" width="464" height="772" rx="30" fill="url(#vm-shell)" stroke="rgba(255,255,255,0.09)" />
        <rect x="18" y="14" width="464" height="772" rx="30" fill="url(#vm-brush)" />
        <rect x="18" y="14" width="10" height="772" rx="5" fill="url(#vm-steel)" opacity="0.5" />
        <rect x="472" y="14" width="10" height="772" rx="5" fill="url(#vm-steel)" opacity="0.35" />

        {/* header */}
        <text x="52" y="70" fill="#f2ebdd" fontSize="22" fontWeight="600" letterSpacing="3" fontFamily="var(--font-geist-sans), sans-serif">
          BREW<tspan fill="#c8f33c">.</tspan>OS
        </text>
        <text x="53" y="88" fill="#5f5a52" fontSize="9" letterSpacing="2.4" fontFamily="var(--font-geist-mono), monospace">
          SERIES K · AUTONOMOUS BARISTA
        </text>

        {/* display bezel */}
        <rect x="44" y="98" width="412" height="190" rx="16" fill="#0a0a0c" stroke="rgba(255,255,255,0.08)" />

        {/* chamber housing */}
        <rect x="44" y="300" width="152" height="216" rx="14" fill="#0b0b0d" stroke="rgba(255,255,255,0.07)" />
        <rect x="58" y="300" width="124" height="10" rx="3" fill="url(#vm-steel)" opacity="0.6" />
        <rect x="58" y="506" width="124" height="10" rx="3" fill="url(#vm-steel)" opacity="0.6" />

        {/* meters housing */}
        <rect x="208" y="300" width="186" height="216" rx="14" fill="#0b0b0d" stroke="rgba(255,255,255,0.07)" />
        {/* cup stack housing */}
        <rect x="404" y="300" width="52" height="216" rx="14" fill="#0b0b0d" stroke="rgba(255,255,255,0.07)" />

        {/* bay */}
        <rect x="44" y="530" width="412" height="182" rx="16" fill="url(#vm-bay)" stroke="rgba(255,255,255,0.08)" />
        <rect x="340" y="546" width="104" height="152" rx="10" fill="#060607" stroke="rgba(255,255,255,0.1)" />
        <text x="392" y="563" textAnchor="middle" fill="#5f5a52" fontSize="8" letterSpacing="2" fontFamily="var(--font-geist-mono), monospace">
          COLLECT
        </text>
        {/* nozzle */}
        <rect x={NOZZLE_X - 26} y="530" width="58" height="16" rx="4" fill="url(#vm-steel)" opacity="0.75" />
        <rect x={NOZZLE_X - 5} y="544" width="16" height="14" rx="3" fill="#2b2b31" />
        {/* drip tray */}
        <rect x="70" y="692" width="250" height="10" rx="3" fill="#1a1a1e" />
        {Array.from({ length: 24 }).map((_, i) => (
          <rect key={i} x={76 + i * 10} y="694" width="5" height="6" rx="1" fill="#070708" />
        ))}

        {/* vents */}
        {Array.from({ length: 5 }).map((_, i) => (
          <rect key={i} x="70" y={728 + i * 9} width="250" height="3" rx="1.5" fill="#050506" />
        ))}
        <text x="440" y="744" textAnchor="end" fill="#5f5a52" fontSize="8" letterSpacing="2" fontFamily="var(--font-geist-mono), monospace">
          AUTO-CLEAN
        </text>

        <rect x="18" y="14" width="464" height="772" rx="30" fill="url(#vm-sheen)" pointerEvents="none" />
      </svg>

      {/* LEDs */}
      <div className="absolute flex items-center justify-end gap-[3.5%]" style={box(300, 52, 156, 30)}>
        {leds.map((l) => (
          <span key={l.label} className="flex flex-col items-center gap-[2px]" title={l.label}>
            <span
              className={cn("block aspect-square w-[9px] rounded-full", l.on && l.pulse && "anim-breathe")}
              style={{
                background: l.on ? l.color : "#26262b",
                boxShadow: l.on ? `0 0 10px ${l.color}` : "inset 0 1px 1px rgba(0,0,0,0.6)",
              }}
            />
            <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-faint">{l.label}</span>
          </span>
        ))}
      </div>

      {/* Display */}
      <div className="absolute" style={box(54, 108, 392, 170)}>
        <MachineDisplay progress={progress} />
      </div>

      {/* Brewing chamber */}
      <div className={cn("absolute overflow-hidden rounded-[10px]", state === "GRINDING" && "anim-rumble")} style={box(64, 314, 112, 188)}>
        <div className="absolute inset-0 border-x border-white/15 bg-gradient-to-r from-white/[0.08] via-white/[0.02] to-white/[0.07]" />
        <div
          className="absolute inset-x-0 bottom-0 transition-[height,background-color] duration-300 ease-linear"
          style={{ height: `${chamberLevel * 100}%`, backgroundColor: chamberColor }}
        >
          <div className="absolute inset-x-0 top-0 h-[3px] bg-white/25" />
          {(state === "BREWING" || state === "CLEANING" || state === "MIXING") && !reduce && (
            <div className="absolute inset-0 overflow-hidden">
              {[12, 34, 58, 76, 44].map((left, i) => (
                <span
                  key={i}
                  className="anim-bubble absolute bottom-0 size-[5px] rounded-full bg-white/40"
                  style={{ left: `${left}%`, animationDelay: `${i * 0.35}s` }}
                />
              ))}
            </div>
          )}
          {state === "GRINDING" && <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.35)_1px,transparent_1.5px)] [background-size:5px_5px]" />}
        </div>
        {state === "GRINDING" && (
          <svg viewBox="0 0 40 40" className="anim-spin absolute left-1/2 top-[8%] w-[34%] -translate-x-1/2 text-crema" aria-hidden>
            <path
              fill="currentColor"
              d="M20 4l2.6 4.6 5.2-1.4.6 5.3 5 1.8-2.2 4.8 3.3 4.2-4.4 3 .4 5.3-5.3.4-2 5-4.6-2.6-4.6 2.6-2-5-5.3-.4.4-5.3-4.4-3 3.3-4.2-2.2-4.8 5-1.8.6-5.3 5.2 1.4z"
              opacity="0.85"
            />
            <circle cx="20" cy="20" r="6" fill="#0b0b0d" />
          </svg>
        )}
        <div className="absolute inset-y-0 left-[12%] w-[6%] bg-white/10 blur-[1px]" />
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[7px] tracking-[0.2em] text-white/30">CHAMBER</span>
      </div>

      {/* Ingredient meters (live from inventory) */}
      <div className="absolute flex items-end justify-between px-[2.5%] pb-[1%]" style={box(220, 316, 162, 190)}>
        {METERS.map((id) => {
          const level = inventory[id];
          const pct = percentRemaining(level.quantity, level.capacity);
          const status = resourceStatus(level);
          const consuming = step?.consumes[id] !== undefined;
          return (
            <div key={id} className="flex h-full w-[15%] flex-col items-center gap-1">
              <div className={cn("relative w-full flex-1 overflow-hidden rounded-full border bg-black/60", consuming ? "border-amber/60" : "border-white/10")}>
                <motion.div
                  className={cn("absolute inset-x-0 bottom-0 rounded-full", STATUS_STYLES[status].bar)}
                  initial={false}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ opacity: 0.85 }}
                />
                {consuming && <div className="anim-shimmer absolute inset-0" />}
              </div>
              <span className={cn("font-mono text-[7px] tracking-[0.06em]", consuming ? "text-amber" : "text-faint")}>{METER_SHORT[id]}</span>
            </div>
          );
        })}
      </div>

      {/* Cup stack */}
      <div className="absolute flex flex-col items-center justify-end pb-[2%]" style={box(410, 314, 40, 188)}>
        <div className="flex w-[70%] flex-1 flex-col-reverse items-center justify-start gap-[2px] overflow-hidden">
          <AnimatePresence initial={false}>
            {Array.from({ length: cupsShown }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="block h-[8px] w-full rounded-b-sm border-x border-t border-white/30 bg-white/[0.07]"
              />
            ))}
          </AnimatePresence>
        </div>
        <span className={cn("mt-1 font-mono text-[9px]", STATUS_STYLES[resourceStatus(inventory.cups)].text)}>{inventory.cups.quantity}</span>
        <span className="font-mono text-[6.5px] tracking-[0.14em] text-faint">CUPS</span>
      </div>

      {/* Bay light */}
      <motion.div
        aria-hidden
        className="absolute rounded-t-[14px]"
        style={box(46, 532, 290, 120)}
        animate={{
          background: `linear-gradient(180deg, ${busy || state === "COMPLETED" ? "rgba(255,226,170,0.16)" : "rgba(255,255,255,0.03)"}, transparent)`,
        }}
        transition={{ duration: 0.8 }}
      />

      {/* Stream */}
      <AnimatePresence>
        {pouring && (
          <motion.div
            key="stream"
            className="anim-stream absolute rounded-full"
            style={{
              ...box(NOZZLE_X - 1, 556, 6, 66),
              backgroundImage: `repeating-linear-gradient(180deg, ${streamColor}, ${streamColor} 10px, rgba(255,255,255,0.25) 12px, ${streamColor} 14px)`,
              transformOrigin: "top",
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0, opacity: 0, transformOrigin: "bottom" }}
            transition={{ duration: 0.25 }}
          />
        )}
        {state === "CLEANING" && (
          <motion.div
            key="rinse"
            className="anim-stream absolute rounded-full opacity-70"
            style={{
              ...box(NOZZLE_X - 3, 556, 10, 132),
              backgroundImage: "repeating-linear-gradient(180deg, rgba(132,212,230,0.7), rgba(132,212,230,0.7) 8px, rgba(255,255,255,0.5) 10px, rgba(132,212,230,0.7) 12px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Cup */}
      <AnimatePresence>
        {cupDrink && cupUnit && (
          <motion.div
            key={`cup-${prep?.orderId}-${cupUnit.index}`}
            className="absolute"
            style={{ top: `${598 / 8}%`, width: `${70 / 5}%`, height: `${96 / 8}%` }}
            initial={{ left: `${CUP_ENTRY_X / 5}%`, opacity: 0 }}
            animate={{ left: `${(atSlot ? CUP_SLOT_X : CUP_BREW_X) / 5}%`, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: reduce ? 0 : atSlot ? 1.1 : 0.9, ease: [0.65, 0, 0.35, 1] }}
          >
            <MachineCup visual={cupDrink.visual} fill={cupFill} hot={cupDrink.temperature === "hot"} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vended packaged item */}
      <AnimatePresence>
        {vendUnit && vendUnit.kind === "packaged_item" && (
          <motion.div
            key={`vend-${step?.id}`}
            className="absolute"
            style={box(352, 600, 80, 80)}
            initial={{ y: "-70%", opacity: 0, rotate: -8 }}
            animate={{ y: "0%", opacity: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            <PackagedArt icon={vendUnit.icon} accent={vendUnit.accent} className="h-full w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collection indicator */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={box(356, 684, 72, 5)}
        animate={{
          backgroundColor: state === "COMPLETED" || step?.phase === "present" || step?.phase === "vend" ? "#c8f33c" : "#1f1f24",
          boxShadow: state === "COMPLETED" ? "0 0 18px rgba(200,243,60,0.9)" : "0 0 0 rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.4 }}
      />

      {/* Vent glow */}
      <div
        aria-hidden
        className={cn("absolute rounded-md transition-opacity duration-700", busy || state === "CLEANING" ? "opacity-100" : "opacity-30")}
        style={{ ...box(70, 726, 250, 42), background: `radial-gradient(closest-side, ${state === "CLEANING" ? "rgba(132,212,230,0.25)" : "rgba(242,169,59,0.18)"}, transparent)` }}
      />
      <span
        className={cn("absolute size-[7px] rounded-full", state === "CLEANING" ? "anim-breathe bg-aqua shadow-[0_0_10px_rgba(132,212,230,0.9)]" : cleanDue ? "bg-amber" : "bg-ink-600")}
        style={{ left: `${446 / 5}%`, top: `${737 / 8}%` }}
        aria-hidden
      />

      {/* Completion light sweep */}
      {state === "COMPLETED" && (
        <div aria-hidden className="pointer-events-none absolute inset-[2%] overflow-hidden rounded-[28px]">
          <div key={prep?.orderId} className="anim-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>
      )}
    </div>
  );
}
