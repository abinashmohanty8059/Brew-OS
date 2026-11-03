/* Always-on microphone via the browser's Web Speech API (SpeechRecognition).
   Supported in Chrome and Edge. Chrome ends a recognition session after a
   silence or about a minute, so the listener quietly restarts it. While the
   voice guide is talking the mic is paused, otherwise it would hear the guide
   say "Cappuccino added" and order another one. */

import { guideIsTalking } from "@/lib/voice";

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return ctor() !== null;
}

export type ListenStatus = "listening" | "paused" | "blocked" | "offline" | "unsupported";

export interface ListenHandlers {
  /** Live partial words while someone is speaking. */
  onInterim?: (text: string) => void;
  /** A finished phrase, e.g. "two cappuccinos". */
  onPhrase: (text: string) => void;
  onStatus?: (status: ListenStatus, message?: string) => void;
}

const POLL_MS = 200;

/** Starts listening continuously. Returns a function that turns the mic off. */
export function startListening(handlers: ListenHandlers): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    handlers.onStatus?.("unsupported", "Voice ordering needs Chrome or Edge");
    return () => {};
  }

  let rec: Recognition | null = null;
  let running = false;
  let stopped = false;
  let retryAt = 0;
  let status: ListenStatus | null = null;

  const setStatus = (next: ListenStatus, message?: string) => {
    if (next === status && !message) return;
    status = next;
    handlers.onStatus?.(next, message);
  };

  const begin = () => {
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      // anything heard while the guide talks is the guide's own voice — drop it
      if (guideIsTalking()) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) {
          if (text) handlers.onPhrase(text);
        } else interim += ` ${text}`;
      }
      handlers.onInterim?.(interim.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        setStatus("blocked", "Microphone is blocked — click the mic icon in the address bar and allow it, then reload");
      } else if (e.error === "network") {
        retryAt = Date.now() + 3000;
        setStatus("offline", "Speech recognition needs an internet connection — retrying");
      } else if (e.error === "audio-capture") {
        retryAt = Date.now() + 3000;
        setStatus("offline", "No microphone was found");
      }
      // "no-speech" and "aborted" are normal: the loop just restarts
    };
    r.onend = () => {
      running = false;
      if (rec === r) rec = null;
    };
    try {
      r.start();
      rec = r;
      running = true;
      setStatus("listening");
    } catch {
      retryAt = Date.now() + 1000;
    }
  };

  const tick = () => {
    if (stopped) return;
    if (guideIsTalking()) {
      if (running && rec) {
        rec.abort(); // throw away whatever it picked up from the speakers
        running = false;
      }
      setStatus("paused");
      handlers.onInterim?.("");
      return;
    }
    if (!running && Date.now() >= retryAt) begin();
  };

  const timer = window.setInterval(tick, POLL_MS);
  tick();

  return () => {
    stopped = true;
    window.clearInterval(timer);
    rec?.abort();
    rec = null;
  };
}
