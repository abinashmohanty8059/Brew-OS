"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Mic, MicOff } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { getProduct } from "@/data/products";
import { parseVoiceOrder } from "@/lib/voice-order";
import { startListening, speechInputSupported, type ListenStatus } from "@/lib/speech-input";
import { playSound } from "@/lib/sound";
import { announce } from "@/store/announce";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

const noop = () => () => {};
const SPOKEN_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const PREF_KEY = "brew-os-mic";

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

const STATUS_TEXT: Record<ListenStatus, string> = {
  listening: "Listening — just say a drink",
  paused: "Paused while the guide speaks",
  blocked: "Microphone blocked",
  offline: "Mic unavailable",
  unsupported: "Voice needs Chrome or Edge",
};

function sound(name: Parameters<typeof playSound>[0]) {
  if (useBrewStore.getState().settings.soundEnabled) playSound(name);
}

/** Always-on voice ordering: say "coffee", "two cappuccinos and a latte", "checkout", "clear my order". */
export function VoiceOrderButton({ onCheckout }: { onCheckout: () => void }) {
  // true on the server so the control renders enabled, then the real answer on the client
  const supported = useSyncExternalStore(noop, speechInputSupported, () => true);
  const begun = useUi((s) => s.begun);
  const [micOn, setMicOn] = useState(readPref);
  const [status, setStatus] = useState<ListenStatus | null>(null);
  const [heard, setHeard] = useState("");
  const [live, setLive] = useState("");
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const checkoutRef = useRef(onCheckout);

  useEffect(() => {
    checkoutRef.current = onCheckout;
  });

  // Mic runs continuously once the visitor is past the welcome screen.
  useEffect(() => {
    if (!begun || !micOn || !supported) return;
    const stop = startListening({
      onInterim: setLive,
      onPhrase: (text) => {
        setLive("");
        setHeard(text);
        runCommand(text, true, () => checkoutRef.current());
      },
      onStatus: (next, message) => {
        setStatus(next);
        setError(next === "blocked" || next === "offline" ? (message ?? "") : "");
      },
    });
    return () => {
      stop();
      setStatus(null);
      setLive("");
    };
  }, [begun, micOn, supported]);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    try {
      localStorage.setItem(PREF_KEY, next ? "on" : "off");
    } catch {
      /* preference just won't be remembered */
    }
    sound("tap");
    announce(next ? "Microphone on. Just say a drink." : "Microphone off.");
  };

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setHeard(text);
    setTyped("");
    runCommand(text, false, onCheckout);
  };

  const active = micOn && supported && status === "listening";
  const label = !supported ? STATUS_TEXT.unsupported : !micOn ? "Mic off — tap to listen" : status ? STATUS_TEXT[status] : "Starting mic…";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!supported}
          aria-pressed={micOn}
          aria-label={micOn ? "Turn microphone off" : "Turn microphone on"}
          title={micOn ? "Always listening for drink names. Click to turn off." : "Click to listen for drink names"}
          className={cn(
            "relative flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
            micOn && supported
              ? status === "blocked" || status === "offline"
                ? "border-amber/50 bg-amber/10 text-amber"
                : "border-lime/60 bg-lime/15 text-lime"
              : "border-white/[0.12] bg-white/[0.04] text-mute hover:border-white/25 hover:text-ivory",
            !supported && "cursor-not-allowed opacity-50",
          )}
        >
          {active && <span className="absolute inset-0 animate-ping rounded-full border border-lime/30 [animation-duration:2s]" aria-hidden />}
          {micOn && supported ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
          {label}
        </button>
        <form onSubmit={submitTyped} className="flex h-10 items-center rounded-full border border-white/[0.08] bg-white/[0.02] pl-4 pr-1 focus-within:border-white/25">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="…or type: two cappuccinos"
            aria-label="Type your order"
            className="w-44 bg-transparent text-[13px] text-ivory placeholder:text-faint focus-visible:outline-none!"
          />
          <button type="submit" aria-label="Send order" className="flex size-8 items-center justify-center rounded-full text-mute hover:bg-white/[0.08] hover:text-ivory">
            <CornerDownLeft className="size-3.5" aria-hidden />
          </button>
        </form>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={error ? "error" : live ? "live" : heard ? `heard-${heard}` : "hint"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn("text-[12.5px]", error ? "text-amber" : "text-mute")}
          aria-live="polite"
        >
          {error ? (
            error
          ) : live ? (
            <span className="text-ivory-dim">“{live}…”</span>
          ) : heard ? (
            <>
              Heard: <span className="text-ivory">“{heard}”</span>
            </>
          ) : (
            "Say “coffee”, “cappuccino”, “two lattes” — then “checkout”"
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Applies one spoken or typed phrase to the cart. */
function runCommand(text: string, fromMic: boolean, checkout: () => void) {
  const store = useBrewStore.getState();
  const cmd = parseVoiceOrder(text);

  if (cmd.kind === "unknown") {
    // the mic is always on, so ordinary conversation is simply ignored
    if (fromMic) return;
    sound("error");
    toast("warning", `Didn't find a drink in “${cmd.text}”`, "Try a drink name, like “coffee” or “two cappuccinos”.");
    announce("Sorry, I didn't catch a drink. Try coffee, or cappuccino.");
    return;
  }
  if (cmd.kind === "clear") {
    if (store.cart.length === 0) return;
    store.clearCart();
    sound("remove");
    announce("Order cleared.");
    return;
  }
  if (cmd.kind === "checkout") {
    if (store.cart.length === 0) {
      sound("error");
      announce("Your order is empty. Say a drink name first.");
      return;
    }
    checkout();
    return;
  }

  const wasEmpty = store.cart.length === 0;
  const added: string[] = [];
  const failed: string[] = [];
  for (const item of cmd.items) {
    const product = getProduct(item.productId);
    if (!product) continue;
    let count = 0;
    let reason = "";
    for (let i = 0; i < item.quantity; i++) {
      const r = useBrewStore.getState().addToCart(item.productId);
      if (!r.ok) {
        reason = r.message;
        break;
      }
      count++;
    }
    const generic = !product.name.toLowerCase().includes(item.heard.replace(/s$/, ""));
    if (count > 0) {
      const qty = SPOKEN_NUMBERS[count] ?? String(count);
      const name = count > 1 && !/[sh]$/i.test(product.name) ? `${product.name}s` : product.name;
      added.push(`${qty} ${name}${generic ? ` for “${item.heard}”` : ""}`);
    }
    if (count < item.quantity) failed.push(`${product.name} — ${reason}`);
  }

  if (added.length) {
    sound("add");
    toast("success", "Added by voice", added.join(", "));
  }
  if (failed.length) {
    sound("error");
    toast("warning", "Couldn't add everything", failed.join(". "));
  }
  const spoken = [added.length ? `${added.join(", ")} added.` : "", failed.length ? `Sorry. ${failed.join(". ")}.` : ""]
    .filter(Boolean)
    .join(" ");

  if (cmd.checkout && added.length && !failed.length) {
    // checkout reads the total aloud; the toast already lists what was added
    checkout();
  } else {
    announce(`${spoken}${added.length && wasEmpty ? " Say checkout when you're ready." : ""}`);
  }
}
