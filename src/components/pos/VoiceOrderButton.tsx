"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, MicOff, Square } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { getProduct } from "@/data/products";
import { parseVoiceOrder } from "@/lib/voice-order";
import { listenOnce, speechInputSupported } from "@/lib/speech-input";
import { stopSpeaking } from "@/lib/voice";
import { playSound } from "@/lib/sound";
import { announce } from "@/store/announce";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

const noop = () => () => {};
const SPOKEN_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Speak an order: "coffee", "two cappuccinos and a latte", "checkout", "clear my order". */
export function VoiceOrderButton({ onCheckout }: { onCheckout: () => void }) {
  // true on the server so the button renders enabled, then the real answer on the client
  const supported = useSyncExternalStore(noop, speechInputSupported, () => true);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  const sound = (name: Parameters<typeof playSound>[0]) => {
    if (useBrewStore.getState().settings.soundEnabled) playSound(name);
  };

  const handle = (text: string) => {
    const store = useBrewStore.getState();
    const cmd = parseVoiceOrder(text);

    if (cmd.kind === "unknown") {
      sound("error");
      toast("warning", `Heard “${cmd.text}”`, "Try a drink name, like “coffee” or “two cappuccinos”.");
      announce("Sorry, I didn't catch a drink. Try saying coffee, or cappuccino.");
      return;
    }
    if (cmd.kind === "clear") {
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
      onCheckout();
      return;
    }

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
    const spoken = [
      added.length ? `${added.join(", ")} added.` : "",
      failed.length ? `Sorry. ${failed.join(". ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (cmd.checkout && added.length && !failed.length) {
      // checkout reads the total aloud; the toast already lists what was added
      onCheckout();
    } else {
      announce(`${spoken}${added.length ? " Tap the mic and say checkout when you're ready." : ""}`);
    }
  };

  const toggle = () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    stopSpeaking(); // don't let the voice guide talk into the microphone
    sound("tap");
    setHeard("");
    setListening(true);
    stopRef.current = listenOnce({
      onInterim: setHeard,
      onFinal: (text) => {
        setHeard(text);
        handle(text);
      },
      onError: (message) => {
        sound("error");
        toast("warning", message);
        announce(`Sorry. ${message}.`);
      },
      onEnd: () => {
        setListening(false);
        stopRef.current = null;
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Order by voice"}
        title={supported ? "Say a drink, e.g. “coffee” or “two cappuccinos”" : "Voice ordering needs Chrome or Edge"}
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
          listening
            ? "border-lime/60 bg-lime/15 text-lime"
            : "border-white/[0.12] bg-white/[0.04] text-ivory hover:border-white/25 hover:bg-white/[0.08]",
          !supported && "cursor-not-allowed opacity-50",
        )}
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full border border-lime/40" aria-hidden />}
        {!supported ? <MicOff className="size-4" aria-hidden /> : listening ? <Square className="size-3.5 fill-current" aria-hidden /> : <Mic className="size-4" aria-hidden />}
        {listening ? "Listening… tap to stop" : "Order by voice"}
      </button>
      <AnimatePresence mode="wait">
        <motion.p
          key={listening ? "live" : heard ? "heard" : "hint"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-[12.5px] text-mute"
          aria-live="polite"
        >
          {heard ? (
            <>
              Heard: <span className="text-ivory">“{heard}”</span>
            </>
          ) : listening ? (
            "Say a drink — “coffee”, “cappuccino”, “two lattes and checkout”"
          ) : (
            "Try “coffee” or “cappuccino”"
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
