"use client";

import { speak, type SpeakOptions } from "@/lib/voice";
import { COFFEE_RECIPES } from "@/data/coffee-recipes";
import { useBrewStore } from "./machine-store";

/** Speaks only when the visitor has the voice guide switched on. */
export function announce(text: string, options?: SpeakOptions): void {
  if (useBrewStore.getState().settings.voiceEnabled) speak(text, options);
}

const list = (items: string[]) => `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** The spoken welcome, built from the live catalogue. */
export function welcomeScript(): string {
  const coffees = list(COFFEE_RECIPES.map((c) => c.name.toLowerCase()));
  return (
    "Welcome to BREW.OS. Intelligence in every pour. " +
    `Choose from our signature coffees: ${coffees}. ` +
    "We also serve cold coffee and iced latte, tea, masala chai, green tea, lemon tea, hot chocolate, and chilled bottled water. " +
    "Tap any drink to add it to your order, pick your sugar level, then press Pay and dispense. " +
    "I'll guide you at every step."
  );
}
