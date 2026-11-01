"use client";

import { motion } from "motion/react";
import { AudioLines, Hand, VolumeX } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { welcomeScript } from "@/store/announce";
import { MACHINE } from "@/data/config";
import { playSound, unlockAudio } from "@/lib/sound";
import { speak, voiceSupported } from "@/lib/voice";
import { BrandMark, Wordmark } from "./BrandMark";

/**
 * Kiosk attract screen. Browsers only allow audio after a gesture, so the
 * spoken welcome starts from "Tap to begin".
 */
export function WelcomeScreen({ onBegin }: { onBegin: () => void }) {
  const settings = useBrewStore((s) => s.settings);
  const setSettings = useBrewStore((s) => s.setSettings);
  const audioOn = settings.voiceEnabled || settings.soundEnabled;

  const begin = (withAudio: boolean) => {
    unlockAudio();
    if (!withAudio) setSettings({ voiceEnabled: false, soundEnabled: false });
    else {
      if (settings.soundEnabled) playSound("chime");
      if (settings.voiceEnabled) speak(welcomeScript());
    }
    onBegin();
  };

  return (
    <motion.div
      className="ambient fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-crema/10 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative flex flex-col items-center">
        <BrandMark className="size-16" />
        <Wordmark className="mt-5 text-[22px] text-ivory" />
        <p className="eyebrow mt-3">
          {MACHINE.model} · {MACHINE.location}
        </p>
        <h1 id="welcome-title" className="mt-8 font-display text-[44px] leading-[0.95] tracking-[-0.02em] sm:text-[64px]">
          Intelligence in <em className="text-crema">every pour.</em>
        </h1>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-mute">
          Signature coffees, cold brews, teas and hot chocolate — brewed to recipe while you watch. Your voice guide will walk you through it.
        </p>

        <button
          type="button"
          autoFocus
          onClick={() => begin(true)}
          className="group relative mt-10 flex items-center gap-3 rounded-full bg-lime px-8 py-4 text-[16px] font-semibold text-ink-950 shadow-[0_0_0_1px_rgba(200,243,60,0.5),0_20px_60px_-10px_rgba(200,243,60,0.55)] transition-transform active:scale-[0.97]"
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-lime/40 anim-breathe blur-md" aria-hidden />
          <Hand className="size-5" aria-hidden />
          Tap to begin
        </button>

        <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-faint">
          <AudioLines className="size-3.5 text-lime" aria-hidden />
          {audioOn
            ? voiceSupported()
              ? "Voice guide and sounds will play"
              : "Sounds will play · voice not supported in this browser"
            : "Audio is off"}
        </p>
        <button
          type="button"
          onClick={() => begin(false)}
          className="mt-2 flex items-center gap-1.5 text-[12px] text-mute underline-offset-4 hover:text-ivory hover:underline"
        >
          <VolumeX className="size-3.5" aria-hidden />
          Continue without audio
        </button>
      </motion.div>
    </motion.div>
  );
}
