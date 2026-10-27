"use client";

import { motion } from "motion/react";
import { Bot, Cpu, LayoutDashboard, Network, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import type { AppView } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { MACHINE } from "@/data/config";
import { STATE_META } from "@/lib/machine-engine";
import { playSound } from "@/lib/sound";
import { Signal } from "@/components/ui/StatusIndicator";
import { IconButton } from "@/components/ui/Button";
import { BrandMark, Wordmark } from "./BrandMark";
import { LiveClock } from "./LiveClock";
import { cn } from "@/lib/cn";

const VIEWS: Array<{ id: AppView; label: string; icon: typeof ShoppingBag }> = [
  { id: "pos", label: "Order", icon: ShoppingBag },
  { id: "machine", label: "Machine", icon: Cpu },
  { id: "operator", label: "Operator", icon: LayoutDashboard },
];

export function TopBar() {
  const view = useBrewStore((s) => s.view);
  const setView = useBrewStore((s) => s.setView);
  const machineState = useBrewStore((s) => s.machine.state);
  const soundOn = useBrewStore((s) => s.settings.soundEnabled);
  const setSettings = useBrewStore((s) => s.setSettings);
  const setRagOpen = useUi((s) => s.setRagOpen);
  const setAssistantOpen = useUi((s) => s.setAssistantOpen);
  const meta = STATE_META[machineState];
  const busy = machineState !== "IDLE" && machineState !== "COMPLETED";

  const toggleSound = () => {
    const next = !soundOn;
    setSettings({ soundEnabled: next });
    if (next) playSound("tap");
  };

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-950/90 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex items-center gap-2.5">
        <BrandMark className="size-7" />
        <Wordmark className="hidden text-[14px] sm:inline" />
        <span className="hidden rounded-md border border-white/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-mute xl:inline">{MACHINE.id}</span>
      </div>

      <nav aria-label="Primary" className="mx-auto flex rounded-xl border border-white/[0.07] bg-white/[0.02] p-1 md:mx-0 md:ml-4">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors sm:px-3",
                active ? "text-ivory" : "text-mute hover:text-ivory",
              )}
            >
              {active && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 rounded-lg bg-white/[0.08]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative size-3.5" aria-hidden />
              <span className="relative hidden sm:inline">{v.label}</span>
              {v.id === "machine" && busy && (
                <span
                  className={cn(
                    "relative size-1.5 rounded-full anim-breathe",
                    meta.tone === "aqua" ? "bg-aqua" : meta.tone === "danger" ? "bg-danger" : "bg-amber",
                  )}
                  aria-label={meta.label}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-4 font-mono text-[11px] text-mute lg:flex">
          <Signal tone="lime" label="Online · local sim" />
          <span className="h-3 w-px bg-white/10" />
          <Signal tone={meta.tone} label={meta.label} pulse={busy} />
          <span className="h-3 w-px bg-white/10" />
          <LiveClock className="tabular text-ivory-dim" />
        </div>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="hidden items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-ivory-dim transition-colors hover:border-white/20 hover:text-ivory md:flex"
        >
          <Bot className="size-3.5 text-lime" aria-hidden />
          BREW AI
        </button>
        <button
          type="button"
          onClick={() => setRagOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-crema/30 bg-crema/[0.08] px-2.5 py-1.5 text-[12px] text-crema transition-colors hover:border-crema/60 hover:bg-crema/[0.14]"
        >
          <Network className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">RAG Explorer</span>
          <span className="sm:hidden">RAG</span>
        </button>
        <IconButton label={soundOn ? "Mute sounds" : "Enable sounds"} onClick={toggleSound} active={soundOn} aria-pressed={soundOn}>
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconButton>
      </div>
    </header>
  );
}
