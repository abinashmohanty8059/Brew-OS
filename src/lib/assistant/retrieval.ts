import type { Entities, Intent, NormalizedQuery, RagDocument, RetrievalWeights, RetrievedDoc } from "./types";
import { RAG_DOCUMENTS } from "@/data/rag-documents";
import { RETRIEVAL_WEIGHTS, STOPWORDS } from "./knowledge-base";
import { canonical, normalizeText } from "./intent-matcher";

interface IndexedDoc {
  doc: RagDocument;
  terms: Set<string>;
  tags: Set<string>;
}

function termsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of normalizeText(text).split(" ")) {
    if (!word || STOPWORDS.has(word)) continue;
    out.add(word);
    out.add(canonical(word));
  }
  return out;
}

/** Pre-tokenised corpus. Built once; the corpus is static. */
const INDEX: IndexedDoc[] = RAG_DOCUMENTS.map((doc) => {
  const tags = new Set<string>();
  for (const tag of doc.tags) {
    for (const w of normalizeText(tag).split(" ")) {
      tags.add(w);
      tags.add(canonical(w));
    }
  }
  const terms = termsOf(`${doc.title} ${doc.content}`);
  tags.forEach((t) => terms.add(t));
  return { doc, terms, tags };
});

export const CORPUS_SIZE = INDEX.length;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Splits content into sentences and keeps those that mention a matched term. */
export function highlightSentences(content: string, matched: string[], max = 2): string[] {
  const sentences = content.split(/(?<=[.!?])\s+/);
  if (matched.length === 0) return sentences.slice(0, 1);
  const scored = sentences
    .map((s, i) => {
      const words = termsOf(s);
      return { s, i, hits: matched.filter((m) => words.has(m)).length };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i);
  return scored.length ? scored.map((x) => x.s) : sentences.slice(0, 1);
}

/**
 * Deterministic scoring:
 *   keyword  = matched query terms / query terms
 *   tag      = query terms or entities found in tags / min(3, tags)
 *   intent   = 1 if the document lists the detected intent
 *   entity   = query entities the document is about / query entities
 * total = Σ weight × component. Ties break on prior, then id.
 */
export function retrieve(
  nq: NormalizedQuery,
  intent: Intent,
  entities: Entities,
  options: { topK?: number; weights?: RetrievalWeights } = {},
): { candidates: number; top: RetrievedDoc[]; all: RetrievedDoc[] } {
  const weights = options.weights ?? RETRIEVAL_WEIGHTS;
  const topK = options.topK ?? 3;
  const queryTerms = [...new Set(nq.expanded)];
  const entityIds = [...entities.products, ...entities.ingredients];

  const scored: RetrievedDoc[] = INDEX.map(({ doc, terms, tags }) => {
    const matchedTerms = queryTerms.filter((t) => terms.has(t));
    const keyword = queryTerms.length ? matchedTerms.length / queryTerms.length : 0;
    const tagHits = new Set([...queryTerms.filter((t) => tags.has(t)), ...entityIds.filter((e) => tags.has(e))]);
    const tag = Math.min(1, tagHits.size / Math.min(3, Math.max(1, tags.size)));
    const intentScore = doc.intents.includes(intent) ? 1 : 0;
    const entity = entityIds.length ? entityIds.filter((e) => doc.entities.includes(e)).length / entityIds.length : 0;
    const score = round(weights.keyword * keyword + weights.tag * tag + weights.intent * intentScore + weights.entity * entity);
    return {
      doc,
      score,
      breakdown: { keyword: round(keyword), tag: round(tag), intent: intentScore, entity: round(entity) },
      matchedTerms,
      highlights: highlightSentences(doc.content, matchedTerms),
    };
  });

  const all = scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.prior - a.doc.prior || a.doc.id.localeCompare(b.doc.id));
  return { candidates: INDEX.length, top: all.slice(0, topK), all };
}
