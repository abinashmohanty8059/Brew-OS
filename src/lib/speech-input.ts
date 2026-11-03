/* Microphone input via the browser's Web Speech API (SpeechRecognition).
   Supported in Chrome and Edge; other browsers get a disabled mic button. */

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

export interface ListenHandlers {
  /** Live partial transcript while the person is still speaking. */
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone is blocked — click the mic icon in the address bar and allow it",
  "service-not-allowed": "Microphone is blocked — click the mic icon in the address bar and allow it",
  "no-speech": "I didn't hear anything — check your microphone and speak right after tapping",
  "audio-capture": "No microphone was found",
  network: "Speech recognition needs an internet connection",
};

/** Stop this long after the last word was heard. */
const SILENCE_MS = 1400;
/** Never listen longer than this. */
const MAX_MS = 10000;

/** Starts one listening session. Returns a function that stops it (and still uses what was heard). */
export function listenOnce(handlers: ListenHandlers): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    handlers.onError?.("Voice ordering needs Chrome or Edge");
    handlers.onEnd?.();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "en-IN";
  rec.interimResults = true;
  rec.continuous = true; // keep the mic open through short pauses; we stop it ourselves
  rec.maxAlternatives = 1;

  let finalText = "";
  let interimText = "";
  let errored = false;
  let done = false;
  let silenceTimer = 0;
  const maxTimer = window.setTimeout(() => rec.stop(), MAX_MS);

  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(silenceTimer);
    window.clearTimeout(maxTimer);
    // Chrome often ends (especially on a manual stop) with words still marked interim — use them.
    const text = (finalText + " " + interimText).trim();
    if (text) handlers.onFinal(text);
    else if (!errored) handlers.onError?.(ERRORS["no-speech"]);
    handlers.onEnd?.();
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += " " + r[0].transcript;
      else interim += r[0].transcript;
    }
    interimText = interim;
    handlers.onInterim?.((finalText + " " + interimText).trim());
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => rec.stop(), SILENCE_MS);
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") return;
    errored = true;
    handlers.onError?.(ERRORS[e.error] ?? `Voice input failed (${e.error})`);
  };
  rec.onend = finish;
  try {
    rec.start();
  } catch {
    errored = true;
    handlers.onError?.("Microphone is busy — try again");
    finish();
  }
  return () => rec.stop();
}
