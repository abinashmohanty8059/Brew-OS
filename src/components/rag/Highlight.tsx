import { Fragment } from "react";
import { canonical, normalizeText } from "@/lib/assistant/intent-matcher";

/** Wraps words whose normalized/canonical form is in `terms` with <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const set = new Set(terms);
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        const word = normalizeText(part);
        const hit = word && word.split(" ").some((w) => set.has(w) || set.has(canonical(w)));
        return hit ? (
          <mark key={i} className="rounded-[3px] bg-lime/20 px-0.5 text-ivory">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}
