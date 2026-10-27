import type { AssistantSnapshot, QueryTrace, RetrievedDoc, Slot } from "./types";
import { classifyIntent, extractEntities, normalizeQuery } from "./intent-matcher";
import { retrieve } from "./retrieval";
import { generateResponse } from "./response-generator";
import { RETRIEVAL_WEIGHTS } from "./knowledge-base";

/** Below this retrieval score a FALLBACK query is not rescued by a document. */
const RESCUE_SCORE = 0.45;

function assembleContext(docs: RetrievedDoc[], live: Slot[]): string {
  const blocks = docs.map((r) => `[${r.doc.id}] ${r.doc.title} (score ${r.score.toFixed(3)})\n${r.highlights.join(" ")}`);
  if (live.length) blocks.push(`[LIVE STATE]\n${live.map((s) => `${s.name} = ${s.value.replace(/\n/g, " ⏎ ")}`).join("\n")}`);
  return blocks.join("\n\n");
}

/**
 * The single query pipeline shared by BREW AI and the RAG Explorer:
 * normalize → entities → intent → retrieve → generate → context.
 * Pure given (query, snapshot, now), so the same input always yields the same trace.
 */
export function runAssistantQuery(query: string, snap: AssistantSnapshot, now: number, id: string): QueryTrace {
  const nq = normalizeQuery(query);
  const entities = extractEntities(nq);
  let intent = classifyIntent(nq, entities);
  let retrieval = retrieve(nq, intent.intent, entities);

  // Unmatched intent: let a strong document decide (and say so in the trace).
  if (intent.intent === "FALLBACK" && retrieval.top[0] && retrieval.top[0].score >= RESCUE_SCORE) {
    const rescuedIntent = retrieval.top[0].doc.intents[0];
    intent = { ...intent, intent: rescuedIntent, confidence: retrieval.top[0].score, rescued: true, signals: [...intent.signals, `${rescuedIntent}:+rescued by ${retrieval.top[0].doc.id}`] };
    retrieval = retrieve(nq, intent.intent, entities);
  }

  const generated = generateResponse({ intent: intent.intent, nq, entities, docs: retrieval.top, snap, now });
  const live = generated.slots.filter((s) => s.source === "live");

  return {
    id,
    at: now,
    query,
    normalized: nq,
    entities,
    intent,
    retrieval: { candidates: retrieval.candidates, weights: RETRIEVAL_WEIGHTS, top: retrieval.top },
    context: assembleContext(retrieval.top, live),
    template: { id: generated.templateId, text: generated.template },
    slots: generated.slots,
    answer: generated.answer,
  };
}
