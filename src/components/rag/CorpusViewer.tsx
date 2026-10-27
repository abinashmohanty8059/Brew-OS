"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DocCategory, QueryTrace } from "@/lib/assistant/types";
import { RAG_DOCUMENTS } from "@/data/rag-documents";
import { retrieve } from "@/lib/assistant/retrieval";
import { normalizeText } from "@/lib/assistant/intent-matcher";
import { cn } from "@/lib/cn";
import { Highlight } from "./Highlight";

const CATEGORIES = [...new Set(RAG_DOCUMENTS.map((d) => d.category))].sort() as DocCategory[];

/** Searchable view of the whole mock corpus, scored against the current trace if there is one. */
export function CorpusViewer({ trace }: { trace: QueryTrace | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocCategory | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const scores = useMemo(() => {
    if (!trace) return new Map<string, number>();
    const { all } = retrieve(trace.normalized, trace.intent.intent, trace.entities, { topK: RAG_DOCUMENTS.length });
    return new Map(all.map((r) => [r.doc.id, r.score]));
  }, [trace]);

  const needle = normalizeText(query);
  const docs = RAG_DOCUMENTS.filter(
    (d) =>
      (category === "all" || d.category === category) &&
      (!needle || normalizeText(`${d.id} ${d.title} ${d.content} ${d.tags.join(" ")}`).includes(needle)),
  ).sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1) || a.id.localeCompare(b.id));
  const searchTerms = needle ? needle.split(" ") : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search corpus</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${RAG_DOCUMENTS.length} documents…`}
            className="h-10 w-full rounded-lg border border-white/10 bg-ink-800 pl-9 pr-3 text-[13px] text-ivory placeholder:text-faint focus:border-lime/40 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em]",
                category === c ? "border-lime/40 bg-lime/10 text-lime" : "border-white/[0.07] text-faint hover:text-ivory-dim",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="font-mono text-[11px] text-faint">
        {docs.length} of {RAG_DOCUMENTS.length} documents{trace ? ` · sorted by score for “${trace.query}”` : ""}
      </p>

      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {docs.map((d) => {
          const score = scores.get(d.id);
          const expanded = open === d.id;
          return (
            <li key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
              <button type="button" onClick={() => setOpen(expanded ? null : d.id)} aria-expanded={expanded} className="w-full p-3.5 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10.5px] text-faint">
                      {d.id} · {d.category} · prior {d.prior.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-[13.5px] text-ivory">{d.title}</p>
                  </div>
                  {score !== undefined && <span className="tabular shrink-0 font-mono text-[12px] text-lime">{score.toFixed(3)}</span>}
                </div>
                <p className={cn("mt-2 text-[12px] leading-relaxed text-mute", !expanded && "line-clamp-2")}>
                  <Highlight text={d.content} terms={[...searchTerms, ...(trace?.normalized.expanded ?? [])]} />
                </p>
                {expanded && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.tags.map((t) => (
                      <span key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-ivory-dim">
                        #{t}
                      </span>
                    ))}
                    {d.intents.map((t) => (
                      <span key={t} className="rounded bg-crema/10 px-1.5 py-0.5 font-mono text-[10px] text-crema">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
