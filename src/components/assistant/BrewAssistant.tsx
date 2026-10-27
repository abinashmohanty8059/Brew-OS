"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Bot, Eraser, Network, SendHorizontal, X } from "lucide-react";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { SAMPLE_QUESTIONS } from "@/lib/assistant/knowledge-base";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ChatMessage } from "./ChatMessage";

/** Returns a clock value that ticks once when the latest reply is due. */
function useRevealClock(latestReveal: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const wait = latestReveal - Date.now();
    if (wait <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), wait + 20);
    return () => window.clearTimeout(id);
  }, [latestReveal]);
  return now;
}

/** BREW AI — the machine-integrated, fully offline assistant. */
export function BrewAssistant({ className, autoFocus = false, onClose }: { className?: string; autoFocus?: boolean; onClose?: () => void }) {
  const chat = useBrewStore((s) => s.chat);
  const ask = useBrewStore((s) => s.ask);
  const clearChat = useBrewStore((s) => s.clearChat);
  const openRag = useUi((s) => s.openRag);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = useRevealClock(Math.max(0, ...chat.map((m) => m.revealAt ?? 0)));
  const typing = chat.some((m) => m.revealAt && m.revealAt > now);
  const askedTexts = new Set(chat.filter((m) => m.role === "user").map((m) => m.text));
  const suggestions = SAMPLE_QUESTIONS.filter((q) => !askedTexts.has(q)).slice(0, chat.length ? 3 : 6);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.length, typing]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const send = (text: string) => {
    if (typing) return;
    if (ask(text)) setDraft("");
  };

  return (
    <section
      aria-labelledby="brewai-title"
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(22,22,26,0.88),rgba(10,10,12,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-lg border border-lime/25 bg-lime/[0.07]">
            <Bot className="size-4 text-lime" aria-hidden />
            <span className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full bg-lime shadow-[0_0_8px_rgba(200,243,60,0.9)]", typing && "anim-breathe")} />
          </span>
          <div>
            <h2 id="brewai-title" className="text-[13.5px] font-semibold tracking-[0.02em]">
              BREW AI
            </h2>
            <p className="font-mono text-[10px] text-faint">{typing ? "retrieving · composing…" : "offline · local knowledge · live machine data"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton size="sm" label="Open RAG Explorer for the latest answer" onClick={() => openRag(null)}>
            <Network className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Clear chat" onClick={clearChat} disabled={chat.length === 0}>
            <Eraser className="size-3.5" />
          </IconButton>
          {onClose && (
            <IconButton size="sm" label="Close BREW AI" onClick={onClose}>
              <X className="size-3.5" />
            </IconButton>
          )}
        </div>
      </header>

      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-label="Conversation">
        {chat.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/[0.08] p-4 text-[12.5px] leading-relaxed text-mute">
            Ask about recipes, prices, stock, cups, cleaning, machine status, orders or sales. Answers come from a local document corpus
            plus live machine state — no external AI.
          </li>
        )}
        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <ChatMessage key={m.id} message={m} typing={Boolean(m.revealAt && m.revealAt > now)} />
          ))}
        </AnimatePresence>
      </ol>

      {suggestions.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" aria-label="Suggested questions">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={typing}
              className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11.5px] text-ivory-dim transition-colors hover:border-lime/40 hover:text-ivory disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-white/[0.06] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="brewai-input" className="sr-only">
          Ask BREW AI
        </label>
        <input
          id="brewai-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask BREW AI… e.g. how much milk is left?"
          autoComplete="off"
          maxLength={300}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 text-[13px] text-ivory placeholder:text-faint focus:border-lime/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || typing}
          aria-label="Send question"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime text-ink-950 transition-opacity disabled:opacity-30"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </section>
  );
}
