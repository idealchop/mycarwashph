import { Fragment, type ReactNode } from "react";

/**
 * Safe, tiny Markdown for AI replies: **bold**, *italic* or _italic_, `code`, "# " headings,
 * "- " / "* " / "1. " lists and paragraphs. Builds React elements only (no HTML injection).
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**") || t.startsWith("__")) out.push(<b key={k}>{t.slice(2, -2)}</b>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-grey-200/70 px-1 font-mono text-[0.92em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{para.map((l, i) => <Fragment key={i}>{i ? <br /> : null}{inline(l, `p${blocks.length}-${i}`)}</Fragment>)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={k} className="list-decimal pl-5">{items}</ol> : <ul key={k} className="list-disc pl-5">{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((bullet ?? num)![1]!);
    } else if (head) {
      flushPara(); flushList();
      blocks.push(<p key={`h${blocks.length}`} className="font-bold">{inline(head[1]!, `h${blocks.length}`)}</p>);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>{blocks}</div>;
}

/** Plain text for places that cannot hold blocks (e.g. one-line previews). */
export const stripMarkdown = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2").replace(/^\s*#{1,6}\s+/gm, "");
