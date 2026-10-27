"use client";

import { motion } from "motion/react";
import type { RetrievalWeights, RetrievedDoc } from "@/lib/assistant/types";
import { cn } from "@/lib/cn";
import { Highlight } from "./Highlight";

const COMPONENTS: Array<{ key: keyof RetrievalWeights; label: string }> = [
  { key: "keyword", label: "Keyword overlap" },
  { key: "tag", label: "Tag match" },
  { key: "intent", label: "Intent match" },
  { key: "entity", label: "Entity match" },
];

export function ScoreBreakdown({ result, weights }: { result: RetrievedDoc; weights: RetrievalWeights }) {
  return (
    <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {COMPONENTS.map(({ key, label }) => {
        const raw = result.breakdown[key];
        const contribution = raw * weights[key];
        return (
          <div key={key} className="rounded-lg bg-black/25 px-2.5 py-1.5">
            <div className="flex items-baseline justify-between gap-2 font-mono text-[10.5px]">
              <dt className="text-faint">
                {label} <span className="text-ink-500">· {Math.round(weights[key] * 100)}%</span>
              </dt>
              <dd className="tabular text-ivory-dim">
                {raw.toFixed(2)} × {weights[key].toFixed(2)} = <span className="text-ivory">{contribution.toFixed(3)}</span>
              </dd>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div className="h-full bg-crema" initial={{ width: 0 }} animate={{ width: `${raw * 100}%` }} transition={{ duration: 0.6 }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

export function RetrievedDocuments({ results, weights }: { results: RetrievedDoc[]; weights: RetrievalWeights }) {
  if (results.length === 0) {
    return <p className="text-[13px] text-faint">No document scored above zero for this query.</p>;
  }
  const max = results[0].score || 1;
  return (
    <ol className="flex flex-col gap-3">
      {results.map((r, i) => (
        <motion.li
          key={r.doc.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12, duration: 0.4 }}
          className={cn("rounded-xl border p-4", i === 0 ? "border-lime/25 bg-lime/[0.025]" : "border-white/[0.06] bg-white/[0.015]")}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] text-faint">
                #{i + 1} · {r.doc.id} · {r.doc.category}
              </p>
              <h4 className="mt-0.5 text-[14px] font-medium text-ivory">{r.doc.title}</h4>
            </div>
            <div className="text-right">
              <p className="tabular font-mono text-[18px] text-lime">{r.score.toFixed(3)}</p>
              <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-lime" style={{ width: `${(r.score / max) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <ScoreBreakdown result={r} weights={weights} />
          </div>
          {r.matchedTerms.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Matched</span>
              {r.matchedTerms.map((t) => (
                <span key={t} className="rounded bg-lime/10 px-1.5 py-0.5 font-mono text-[10.5px] text-lime">
                  {t}
                </span>
              ))}
            </div>
          )}
          <blockquote className="mt-3 border-l-2 border-crema/40 pl-3 text-[12.5px] leading-relaxed text-ivory-dim">
            <Highlight text={r.highlights.join(" ")} terms={r.matchedTerms} />
          </blockquote>
        </motion.li>
      ))}
    </ol>
  );
}
