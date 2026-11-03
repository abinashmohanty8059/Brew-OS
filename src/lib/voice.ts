/* Voice guide built on the browser's Web Speech API (speechSynthesis).
   Fully local — no audio files, no API keys. Browsers only allow speech
   after the visitor has interacted with the page, so the first utterance
   is triggered from the welcome screen's "Tap to begin". */

let chosen: SpeechSynthesisVoice | null = null;
let listening = false;

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Prefers a natural Indian-English voice, then any natural English voice. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name.toLowerCase();
  if (v.lang === "en-IN") score += 6;
  else if (v.lang.startsWith("en-GB")) score += 3;
  else if (v.lang.startsWith("en")) score += 2;
  else return -1;
  if (/natural|neural|online/.test(name)) score += 4;
  if (/google/.test(name)) score += 2;
  if (/neerja|heera|aria|jenny|samantha|female|sonia|libby/.test(name)) score += 1;
  return score;
}

function voice(): SpeechSynthesisVoice | null {
  if (!voiceSupported()) return null;
  if (!listening) {
    listening = true;
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      chosen = null;
    });
  }
  if (chosen) return chosen;
  const voices = window.speechSynthesis.getVoices();
  const best = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  chosen = best && scoreVoice(best) >= 0 ? best : null;
  return chosen;
}

export interface SpeakOptions {
  /** Cancel whatever is being said first (default). Use false to queue. */
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
}

/** Makes spoken text sound natural: rupee amounts, the product name. */
export function forSpeech(text: string): string {
  return text
    .replace(/₹\s?([\d,]+)/g, (_, n: string) => `${n.replace(/,/g, "")} rupees`)
    .replace(/BREW\.OS|BREW OS/gi, "Brew O S")
    .replace(/\*\*/g, "");
}

export interface SpeechStep {
  text: string;
  /** Fires when this line starts playing (used to scroll the menu in sync). */
  onStart?: () => void;
}

/** Speaks several lines back to back. `onDone(finished)` runs once: true if all
    lines played, false if they were cut off (e.g. the visitor said "OK"). */
export function speakSequence(steps: SpeechStep[], onDone?: (finished: boolean) => void): void {
  if (!voiceSupported() || steps.length === 0) {
    onDone?.(false);
    return;
  }
  window.speechSynthesis.cancel();
  let settled = false;
  const settle = (finished: boolean) => {
    if (settled) return;
    settled = true;
    onDone?.(finished);
  };
  steps.forEach((step, i) => {
    const u = utteranceFor(step.text);
    const prevEnd = u.onend;
    u.onstart = () => step.onStart?.();
    u.onend = (e) => {
      prevEnd?.call(u, e);
      if (i === steps.length - 1) settle(true);
    };
    u.onerror = () => {
      lastSpokeAt = Date.now();
      settle(false);
    };
    window.speechSynthesis.speak(u);
  });
  lastSpokeAt = Date.now();
}

export function speak(text: string, { interrupt = true, rate = 1, pitch = 1.02 }: SpeakOptions = {}): void {
  if (!voiceSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  const utterance = utteranceFor(text, rate, pitch);
  lastSpokeAt = Date.now();
  synth.speak(utterance);
}

function utteranceFor(text: string, rate = 1, pitch = 1.02): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(forSpeech(text));
  const v = voice();
  if (v) {
    utterance.voice = v;
    utterance.lang = v.lang;
  } else {
    utterance.lang = "en-IN";
  }
  utterance.rate = rate;
  utterance.pitch = pitch;
  const done = () => {
    lastSpokeAt = Date.now();
  };
  utterance.onend = done;
  utterance.onerror = done;
  return utterance;
}

export function stopSpeaking(): void {
  if (voiceSupported()) window.speechSynthesis.cancel();
}

let lastSpokeAt = 0;

/** True while the voice guide is talking, and for a short tail after, so the
    always-on microphone doesn't order the drinks the guide itself names. */
export function guideIsTalking(tailMs = 800): boolean {
  if (!voiceSupported()) return false;
  const synth = window.speechSynthesis;
  return synth.speaking || synth.pending || Date.now() - lastSpokeAt < tailMs;
}
