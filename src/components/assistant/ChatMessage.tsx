"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Network } from "lucide-react";
import type { ChatMessage as Message } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { formatTime } from "@/lib/currency";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/cn";

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-2 py-1" aria-label="BREW AI is retrieving">
      <span className="inline-flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-lime/80"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      <span className="font-mono text-[10.5px] text-faint">retrieving</span>
    </span>
  );
}

/** Splits into word/space tokens so streaming reveals whole words, like LLM tokens. */
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

/**
 * Re-renders every frame while a reply is streaming, and returns how much
 * of the text is visible. Purely presentational: the full answer already exists.
 */
function useStreamedText(message: Message, onProgress?: () => void): { phase: "thinking" | "streaming" | "done"; text: string } {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const end = message.streamEndAt ?? message.revealAt ?? 0;
  const active = now < end;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const start = message.revealAt ?? 0;
  const phase = now < start ? "thinking" : now < end && !reduce ? "streaming" : "done";
  const tokens = tokenize(message.text);
  const progress = phase === "streaming" ? (now - start) / Math.max(1, end - start) : 1;
  const visible = phase === "streaming" ? tokens.slice(0, Math.max(1, Math.floor(tokens.length * progress))).join("") : message.text;

  useEffect(() => {
    if (phase === "streaming") onProgress?.();
  }, [visible.length, phase, onProgress]);

  return { phase, text: visible };
}

export function ChatMessage({ message, onStream }: { message: Message; onStream?: () => void }) {
  const openRag = useUi((s) => s.openRag);
  const mine = message.role === "user";
  const { phase, text } = useStreamedText(message, onStream);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px]",
          mine ? "rounded-br-md bg-ivory text-ink-950" : "rounded-bl-md border border-white/[0.07] bg-white/[0.04] text-ivory-dim",
        )}
        aria-busy={phase !== "done" || undefined}
      >
        {mine ? (
          message.text
        ) : phase === "thinking" ? (
          <TypingDots />
        ) : (
          <div
            className={cn(
              phase === "streaming" &&
                "[&>div>:last-child]:after:ml-0.5 [&>div>:last-child]:after:text-lime [&>div>:last-child]:after:content-['▍'] [&>div>ol:last-child>li:last-child]:after:content-['▍'] [&>div>ul:last-child>li:last-child]:after:content-['▍'] [&>div>ol:last-child]:after:content-none [&>div>ul:last-child]:after:content-none [&_li:last-child]:after:text-lime",
            )}
          >
            <RichText text={text} />
          </div>
        )}
      </div>
      {phase === "done" && (
        <div className="flex items-center gap-2 px-1 font-mono text-[10px] text-faint">
          <span>{formatTime(message.at)}</span>
          {message.traceId && (
            <button
              type="button"
              onClick={() => openRag(message.traceId)}
              className="inline-flex items-center gap-1 text-crema/80 transition-colors hover:text-crema"
            >
              <Network className="size-3" aria-hidden />
              Inspect trace
            </button>
          )}
        </div>
      )}
    </motion.li>
  );
}
