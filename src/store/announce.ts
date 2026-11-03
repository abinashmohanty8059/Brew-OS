"use client";

import { speak, type SpeakOptions } from "@/lib/voice";
import { useBrewStore } from "./machine-store";

/** Speaks only when the visitor has the voice guide switched on. */
export function announce(text: string, options?: SpeakOptions): void {
  if (useBrewStore.getState().settings.voiceEnabled) speak(text, options);
}
