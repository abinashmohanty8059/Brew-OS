"use client";

/* The spoken welcome: a few short lines, and the menu scrolls to each section
   as it is named. Saying "OK" (or tapping Skip) stops it so ordering can start. */

import { speakSequence, stopSpeaking, type SpeechStep } from "@/lib/voice";
import { useUi } from "./ui-store";

/** Brings a menu section into view inside the scrolling menu and makes its heading glow. */
function showSection(id: string | null) {
  const menu = document.getElementById("menu");
  if (!menu) return;
  if (!id) {
    menu.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const heading = document.getElementById(`sec-${id}`);
  if (!heading) return;
  heading.scrollIntoView({ behavior: "smooth", block: "start" });
  heading.animate(
    [{ color: "var(--color-ivory)" }, { color: "var(--color-lime)", offset: 0.25 }, { color: "var(--color-ivory)" }],
    { duration: 2600, easing: "ease-in-out" },
  );
}

// No line may contain "OK" / "skip": the mic listens for those words while the guide talks.
const TOUR: { text: string; section: string | null }[] = [
  { text: "Welcome to BREW.OS.", section: null },
  { text: "Signature coffees: espresso, cappuccino, latte, mocha and more.", section: "signature" },
  { text: "Cold coffee and iced latte.", section: "cold" },
  { text: "Teas and hot chocolate.", section: "tea" },
  { text: "And chilled water.", section: "pantry" },
  { text: "Just say a drink to order.", section: null },
];

export function startWelcomeTour(): void {
  const ui = useUi.getState();
  ui.setCategory("all"); // every section must be on screen to scroll to it
  ui.setTouring(true);
  const steps: SpeechStep[] = TOUR.map((line) => ({ text: line.text, onStart: () => showSection(line.section) }));
  // finished: back to the top. Cut off by another announcement (a drink was tapped): stay put.
  speakSequence(steps, (finished) => (finished ? endTour() : useUi.getState().setTouring(false)));
}

/** Stops the tour (voice and scrolling) and returns to the top of the menu. */
export function endTour(): void {
  if (!useUi.getState().touring) return;
  useUi.getState().setTouring(false);
  stopSpeaking();
  showSection(null);
}
