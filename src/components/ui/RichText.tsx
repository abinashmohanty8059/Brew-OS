import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Renders **bold** spans. Text only — never HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ivory">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Minimal markdown subset used by assistant templates: paragraphs, "- " lists, "1. " lists, bold. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push(
        <ul key={blocks.length} className="my-1 flex list-disc flex-col gap-0.5 pl-4 marker:text-faint">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      blocks.push(
        <ol key={blocks.length} className="my-1 flex list-decimal flex-col gap-0.5 pl-5 marker:text-faint">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="[&:not(:first-child)]:mt-1">
          {inline(line)}
        </p>,
      );
      i++;
    }
  }
  return <div className={cn("leading-relaxed", className)}>{blocks}</div>;
}
