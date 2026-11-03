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
  "not-allowed": "Microphone permission was denied",
  "service-not-allowed": "Microphone permission was denied",
  "no-speech": "I didn't hear anything",
  "audio-capture": "No microphone was found",
  network: "Speech recognition needs an internet connection",
};

/** Starts one listening session. Returns a function that stops it. */
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
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    handlers.onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error !== "aborted") handlers.onError?.(ERRORS[e.error] ?? `Voice input failed (${e.error})`);
  };
  rec.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd?.();
  };
  try {
    rec.start();
  } catch {
    handlers.onError?.("Microphone is busy");
    handlers.onEnd?.();
  }
  return () => rec.stop();
}
