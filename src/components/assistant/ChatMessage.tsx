"use client";

import { motion } from "motion/react";
import { Network } from "lucide-react";
import type { ChatMessage as Message } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { formatTime } from "@/lib/currency";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/cn";

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="BREW AI is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-lime/80"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

export function ChatMessage({ message, typing }: { message: Message; typing: boolean }) {
  const openRag = useUi((s) => s.openRag);
  const mine = message.role === "user";

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
      >
        {typing ? <TypingDots /> : mine ? message.text : <RichText text={message.text} />}
      </div>
      {!typing && (
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
