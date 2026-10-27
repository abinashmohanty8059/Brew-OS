"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Database, FlaskConical, Play } from "lucide-react";
import type { Intent, QueryTrace } from "@/lib/assistant/types";
import { useBrewStore } from "@/store/machine-store";
import { useUi } from "@/store/ui-store";
import { SAMPLE_QUESTIONS, STOPWORDS } from "@/lib/assistant/knowledge-base";
import { CORPUS_SIZE } from "@/lib/assistant/retrieval";
import { RAG_DOCUMENTS } from "@/data/rag-documents";
import { formatTimeSeconds } from "@/lib/currency";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { RichText } from "@/components/ui/RichText";
import { cn } from "@/lib/cn";
import { PIPELINE, PipelineStages } from "./PipelineStages";
import { RetrievedDocuments } from "./RetrievedDocuments";
import { CorpusViewer } from "./CorpusViewer";

const DISCLAIMER = "Local mock corpus · deterministic keyword retrieval · template-based response generation · no external AI API";

function Stage({ id, n, title, revealed, children, note }: { id: string; n: number; title: string; revealed: boolean; children: ReactNode; note?: string }) {
  return (
    <motion.section
      id={id}
      initial={false}
      animate={{ opacity: revealed ? 1 : 0.25, y: revealed ? 0 : 6 }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-4 rounded-2xl border border-white/[0.06] bg-ink-900/70 p-5"
      aria-labelledby={`${id}-title`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] text-crema">STAGE {n}</span>
          <span className="text-[15px] font-medium text-ivory">{title}</span>
        </h3>
        {note && <span className="font-mono text-[10.5px] text-faint">{note}</span>}
      </header>
      {children}
    </motion.section>
  );
}

function Chips({ items, tone = "default", struck }: { items: string[]; tone?: "default" | "lime" | "crema"; struck?: Set<string> }) {
  if (items.length === 0) return <span className="text-[12px] text-faint">none</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[11px]",
            tone === "lime" ? "bg-lime/10 text-lime" : tone === "crema" ? "bg-crema/10 text-crema" : "bg-white/[0.05] text-ivory-dim",
            struck?.has(t) && "text-faint line-through opacity-60",
          )}
        >
          {t}
        </span>
      ))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-white/[0.04] py-2.5 first:border-0 first:pt-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{label}</span>
      <div className="min-w-0 text-[13px] text-ivory-dim">{children}</div>
    </div>
  );
}

function TemplateText({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-ivory-dim">
      {text.split(/(\{\w+\})/g).map((part, i) =>
        /^\{\w+\}$/.test(part) ? (
          <span key={i} className="rounded bg-crema/15 text-crema">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </pre>
  );
}

function TraceView({ trace }: { trace: QueryTrace }) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(reduce ? PIPELINE.length : 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setRevealed((r) => (r >= PIPELINE.length ? r : r + 1)), 380);
    return () => window.clearInterval(id);
  }, [reduce]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const n = trace.normalized;
  const topScores = (Object.entries(trace.intent.scores) as Array<[Intent, number]>).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxScore = topScores[0]?.[1] ?? 1;
  const liveSlots = trace.slots.filter((s) => s.source === "live");
  const staticSlots = trace.slots.filter((s) => s.source !== "live");
  const categories = new Set(RAG_DOCUMENTS.map((d) => d.category)).size;

  return (
    <div ref={scrollRef} className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-1 bg-ink-850/95 px-1 py-2 backdrop-blur">
        <PipelineStages revealed={revealed} onJump={jump} />
      </div>

      <Stage id="stage-query" n={1} title="User query" revealed={revealed >= 1} note={`${trace.id} · ${formatTimeSeconds(trace.at)}`}>
        <p className="font-display text-[26px] leading-tight text-ivory">“{trace.query}”</p>
      </Stage>

      <Stage id="stage-normalize" n={2} title="Query normalization" revealed={revealed >= 2} note="lowercase · strip punctuation · stopwords · synonyms">
        <Row label="Normalized">
          <code className="font-mono text-[12.5px] text-ivory">{n.normalized || "∅"}</code>
        </Row>
        <Row label="Tokens">
          <Chips items={n.tokens} struck={new Set(n.tokens.filter((t) => STOPWORDS.has(t)))} />
        </Row>
        <Row label="Keywords">
          <Chips items={n.keywords} />
        </Row>
        <Row label="Synonyms">
          {n.synonymHits.length ? (
            <span className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {n.synonymHits.map((s) => (
                <span key={`${s.from}-${s.to}`} className="rounded bg-white/[0.04] px-1.5 py-0.5">
                  {s.from} <span className="text-faint">→</span> <span className="text-crema">{s.to}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-[12px] text-faint">none applied</span>
          )}
        </Row>
        <Row label="Entities">
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] text-faint">products</span>
              <Chips items={trace.entities.products} tone="lime" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] text-faint">ingredients</span>
              <Chips items={trace.entities.ingredients} tone="lime" />
            </span>
          </span>
        </Row>
        <Row label="Detected intent">
          <div className="flex flex-col gap-2">
            <p>
              <span className="font-mono text-[13px] text-lime">{trace.intent.intent}</span>
              <span className="ml-2 font-mono text-[11px] text-faint">confidence {trace.intent.confidence.toFixed(2)}</span>
              {trace.intent.rescued && <span className="ml-2 text-[11px] text-amber">rescued by top document</span>}
            </p>
            {topScores.length > 0 && (
              <ul className="flex flex-col gap-1">
                {topScores.map(([intent, score]) => (
                  <li key={intent} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 font-mono text-[10.5px]">
                    <span className={intent === trace.intent.intent ? "text-ivory" : "text-faint"}>{intent}</span>
                    <span className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <span className="block h-full bg-crema" style={{ width: `${(score / maxScore) * 100}%` }} />
                    </span>
                    <span className="tabular text-right text-faint">{score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-mono text-[10.5px] leading-relaxed text-faint">signals: {trace.intent.signals.join(" · ") || "none"}</p>
          </div>
        </Row>
      </Stage>

      <Stage id="stage-retrieve" n={3} title="Document corpus" revealed={revealed >= 3} note="local, in-memory">
        <p className="text-[13px] text-ivory-dim">
          {CORPUS_SIZE} mock documents across {categories} categories were scanned. Recipe and pricing documents are generated from the same product
          catalogue the POS uses. Every document has an id, title, content, category, tags, intents and a static prior used only to break ties.
        </p>
      </Stage>

      <Stage id="stage-rank" n={4} title="Retrieval & ranking" revealed={revealed >= 4} note={`top ${trace.retrieval.top.length} of ${trace.retrieval.candidates}`}>
        <p className="mb-3 text-[12px] text-faint">
          score = Σ weight × component. Weights are configurable illustrative values (keyword {trace.retrieval.weights.keyword * 100}%, tag{" "}
          {trace.retrieval.weights.tag * 100}%, intent {trace.retrieval.weights.intent * 100}%, entity {trace.retrieval.weights.entity * 100}%) — not
          measured model accuracy. Same query, same state → same ranking.
        </p>
        <RetrievedDocuments results={trace.retrieval.top} weights={trace.retrieval.weights} />
      </Stage>

      <Stage id="stage-context" n={5} title="Context assembly" revealed={revealed >= 5} note="retrieved excerpts + live state">
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-ivory-dim">
          {trace.context || "(empty)"}
        </pre>
      </Stage>

      <Stage id="stage-generate" n={6} title="Response generation" revealed={revealed >= 6} note={`template ${trace.template.id}`}>
        <TemplateText text={trace.template.text} />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">Knowledge & query slots</p>
            <SlotTable slots={staticSlots} />
          </div>
          <div>
            <p className="eyebrow mb-2 text-lime/80">Live state slots</p>
            <SlotTable slots={liveSlots} empty="This answer used no live machine data." />
          </div>
        </div>
      </Stage>

      <Stage id="stage-answer" n={7} title="Final answer" revealed={revealed >= 6} note="exactly as shown in BREW AI">
        <div className="rounded-xl border border-lime/20 bg-lime/[0.03] p-4 text-[13.5px] text-ivory-dim">
          <RichText text={trace.answer} />
        </div>
      </Stage>
    </div>
  );
}

function SlotTable({ slots, empty = "No slots." }: { slots: QueryTrace["slots"]; empty?: string }) {
  if (slots.length === 0) return <p className="text-[12px] text-faint">{empty}</p>;
  return (
    <table className="w-full table-fixed text-[11.5px]">
      <tbody>
        {slots.map((s) => (
          <tr key={s.name} className="border-t border-white/[0.04] align-top">
            <td className="w-[34%] py-1.5 pr-2 font-mono text-crema">{`{${s.name}}`}</td>
            <td className="py-1.5 pr-2 text-ivory-dim">
              <span className="line-clamp-3 whitespace-pre-wrap break-words">{s.value || "∅"}</span>
            </td>
            <td className="w-16 py-1.5 text-right font-mono text-[10px] uppercase text-faint">{s.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RagExplorer() {
  const open = useUi((s) => s.ragOpen);
  const traceId = useUi((s) => s.ragTraceId);
  const setOpen = useUi((s) => s.setRagOpen);
  const openRag = useUi((s) => s.openRag);
  const traces = useBrewStore((s) => s.traces);
  const lastTraceId = useBrewStore((s) => s.lastTraceId);
  const ask = useBrewStore((s) => s.ask);
  const [tab, setTab] = useState<"trace" | "corpus">("trace");
  const [draft, setDraft] = useState(SAMPLE_QUESTIONS[0]);

  const trace = (traceId && traces[traceId]) || (lastTraceId && traces[lastTraceId]) || null;
  const recent = Object.values(traces).sort((a, b) => b.at - a.at);

  const run = (q: string) => {
    const id = ask(q);
    if (id) {
      openRag(id);
      setTab("trace");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      size="full"
      eyebrow={
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-amber">MOCK RAG · SIMULATED PIPELINE</span>
          <span>{DISCLAIMER}</span>
        </span>
      }
      title="RAG Explorer"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-3 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex rounded-lg bg-black/30 p-1" role="tablist" aria-label="Explorer view">
            {(
              [
                ["trace", "Pipeline trace", FlaskConical],
                ["corpus", `Corpus · ${CORPUS_SIZE}`, Database],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px]", tab === id ? "bg-white/10 text-ivory" : "text-faint hover:text-ivory-dim")}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(draft);
            }}
          >
            <label htmlFor="rag-query" className="sr-only">
              Query to run through the pipeline
            </label>
            <input
              id="rag-query"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 text-[13px] text-ivory focus:border-lime/40 focus:outline-none"
              placeholder="Type a question to trace…"
              maxLength={300}
            />
            <Button type="submit" size="sm" variant="primary" icon={<Play className="size-3.5" />} disabled={!draft.trim()}>
              Run
            </Button>
          </form>
          {recent.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Trace</span>
              <select
                value={trace?.id ?? ""}
                onChange={(e) => openRag(e.target.value)}
                className="h-9 max-w-[260px] rounded-lg border border-white/10 bg-ink-800 px-2 text-[12px] text-ivory"
              >
                {recent.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatTimeSeconds(t.at)} — {t.query.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <AnimatePresence mode="wait">
            {tab === "corpus" ? (
              <motion.div key="corpus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CorpusViewer trace={trace} />
              </motion.div>
            ) : trace ? (
              <motion.div key={trace.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TraceView trace={trace} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
                <FlaskConical className="size-8 text-crema" aria-hidden />
                <h3 className="font-display text-[28px]">No query traced yet</h3>
                <p className="text-[13px] leading-relaxed text-mute">
                  Ask BREW AI a question, or run a sample below. The explorer shows the exact trace produced by the chatbot’s pipeline — normalization,
                  retrieval scores, assembled context, the template and the final answer.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SAMPLE_QUESTIONS.slice(0, 4).map((q) => (
                    <Button key={q} size="sm" variant="secondary" onClick={() => run(q)} icon={<Play className="size-3" />}>
                      {q}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Dialog>
  );
}
