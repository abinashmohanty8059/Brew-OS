/* Always-on microphone via the browser's Web Speech API (SpeechRecognition).
   Supported in Chrome and Edge. Chrome ends a recognition session after a
   silence or about a minute, so the listener quietly restarts it.

   Two modes:
   - "order":   the guide is quiet — every finished phrase is passed on as an order.
   - "barge":   the guide is talking — only "OK" / "skip" count (to cut it off);
                everything else is the guide's own voice through the speakers and
                is thrown away, so it can't order the drinks it names.
   Switching mode restarts the session so no echo carries over. */

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
type Mode = "order" | "barge";

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return ctor() !== null;
}

/** Words that cut the voice guide off. The guide never says these itself. */
const STOP_WORDS = /\b(ok|okay|okey|skip|got it|enough|alright|all right|stop)\b/i;

export function isStopWord(text: string): boolean {
  return STOP_WORDS.test(text);
}

export type ListenStatus = "listening" | "paused" | "blocked" | "offline" | "unsupported";

export interface ListenHandlers {
  /** Live partial words while someone is speaking. */
  onInterim?: (text: string) => void;
  /** A finished phrase, e.g. "two cappuccinos". */
  onPhrase: (text: string) => void;
  /** The visitor said "OK" (or similar) while the guide was talking. */
  onStopWord?: () => void;
  onStatus?: (status: ListenStatus, message?: string) => void;
}

const POLL_MS = 150;

/** Starts listening continuously. Returns a function that turns the mic off. */
export function startListening(handlers: ListenHandlers): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    handlers.onStatus?.("unsupported", "Voice ordering needs Chrome or Edge");
    return () => {};
  }

  let rec: Recognition | null = null;
  let mode: Mode | null = null;
  let stopped = false;
  let retryAt = 0;
  let status: ListenStatus | null = null;

  const setStatus = (next: ListenStatus, message?: string) => {
    if (next === status && !message) return;
    status = next;
    handlers.onStatus?.(next, message);
  };

  const begin = (want: Mode) => {
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      if (rec !== r) return;
      if (want === "barge") {
        // react on interim words too, so "OK" cuts the guide off immediately
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (isStopWord(e.results[i][0].transcript)) {
            r.abort();
            handlers.onStopWord?.();
            return;
          }
        }
        return;
      }
      if (guideIsTalking()) return; // guide just started: let the tick switch modes
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
      if (rec === r) {
        rec = null;
        mode = null;
      }
    };
    try {
      r.start();
      rec = r;
      mode = want;
    } catch {
      retryAt = Date.now() + 1000;
    }
  };

  const tick = () => {
    if (stopped) return;
    const want: Mode = guideIsTalking() ? "barge" : "order";
    if (Date.now() >= retryAt) setStatus(want === "barge" ? "paused" : "listening");
    if (want === "barge") handlers.onInterim?.("");
    if (rec && mode !== want) {
      // drop the old session (and any echo in it) and start fresh in the new mode
      const old = rec;
      rec = null;
      mode = null;
      old.abort();
    }
    if (!rec && Date.now() >= retryAt) begin(want);
  };

  const timer = window.setInterval(tick, POLL_MS);
  tick();

  return () => {
    stopped = true;
    window.clearInterval(timer);
    const old = rec;
    rec = null;
    old?.abort();
  };
}
