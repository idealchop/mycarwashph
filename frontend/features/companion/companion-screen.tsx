"use client";

import { MarkdownLite, stripMarkdown } from "@/components/markdown-lite";
import { SparkleIcon } from "@river-apps/icons";
import { Button, Card } from "@river-apps/ui";
import { ArrowUp, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { ApiError } from "@/lib/api";
import { askCompanion, getCompanion, type CompanionMessage, type CompanionState } from "@/lib/companion";

const SUGGESTIONS = ["Magkano kinita ko last week?", "Anong oras pinakamaraming kotse?", "Paano ko mapapataas ang average ticket?", "Ilang customers ang hindi na bumalik?"];

export function CompanionScreen() {
  return (
    <ShopPage
      title="AI Companion"
      subtitle="Your carwash kasama, from your own numbers"
      back="/home"
      icon="sparkle"
      empty={{ title: "Sign in to chat with River", description: "Ask about your sales, queue and customers, and get weekly tips for your shop." }}
    >
      {(shop) => (shop.role === "owner" ? <Chat shopId={shop.id} /> : <p className="mt-6 font-semibold">The AI Companion is for shop owners.</p>)}
    </ShopPage>
  );
}

function Chat({ shopId }: { shopId: string }) {
  const [state, setState] = useState<CompanionState | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  /** Server-side limit message (Partner quota), shown inline as River's reply. */
  const [limitNote, setLimitNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => getCompanion(shopId).then(setState, (e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);
  useEffect(() => {
    // Block body: newer Chrome returns a Promise from scrollIntoView, which React would call as a cleanup.
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state?.messages.length, busy, limitNote]);

  const send = async (q: string) => {
    const value = q.trim();
    if (!value || busy || !state) return;
    setBusy(true);
    setError("");
    setText("");
    const pending: CompanionMessage = { id: "pending", role: "owner", kind: "chat", text: value, createdAt: new Date().toISOString() };
    setState({ ...state, messages: [...state.messages, pending] });
    try {
      const out = await askCompanion(shopId, value);
      setState((s) => s && {
        ...s,
        messages: [...s.messages.filter((m) => m.id !== "pending"), out.question, out.answer],
        quota: { ...s.quota, remaining: out.remaining, used: s.quota.limit !== null && out.remaining !== null ? s.quota.limit - out.remaining : s.quota.used },
      });
      if (/goal/i.test(value)) load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "companion_quota") {
        // Keep the question on screen and answer with the server's message, inline.
        setState((s) => s && { ...s, messages: s.messages.map((m) => (m.id === "pending" ? { ...m, id: `q-${Date.now()}` } : m)) });
        setLimitNote(e.message);
      } else {
        setState((s) => s && { ...s, messages: s.messages.filter((m) => m.id !== "pending") });
        setText(value);
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!state) return error ? <p role="alert" className="mt-4 font-semibold">{error}</p> : <LoadingBlock />;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[760px] flex-col gap-3 pb-36 lg:pb-8">
      {!state.enabled ? <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">AI Companion is coming soon for your shop.</p> : null}
      {state.messages.length === 0 && !limitNote ? (
        <Card padding="none" className="flex flex-col items-center px-5 py-7 text-center">
          <SparkleIcon size={56} />
          <b className="mt-2 text-[16px]">Kumusta! I’m River.</b>
          <p className="mt-1 max-w-[420px] text-[13.5px] font-medium text-muted">Ask me about your sales, busy hours, services or customers, or anything about running a car wash. You can set a goal too: “Goal ko ₱50k this month”.</p>
        </Card>
      ) : null}
      <ul className="flex flex-col gap-2.5" aria-live="polite">
        {state.messages.map((m) => <Bubble key={m.id} m={m} />)}
        {busy ? <li className="self-start rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">River is checking your numbers…</li> : null}
        {limitNote && !busy ? (
          <li className="max-w-[90%] self-start rounded-card bg-grey-100 px-4 py-2.5 text-[14px] font-medium">
            <MarkdownLite text={limitNote} />
            <Link href="/settings/billing" className="mt-1.5 inline-block text-[13px] font-bold underline underline-offset-2">Upgrade</Link>
          </li>
        ) : null}
      </ul>
      <div ref={endRef} />
      {error ? <p role="alert" className="text-[13px] font-semibold">{error}</p> : null}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {SUGGESTIONS.map((q) => (
          <button key={q} type="button" disabled={busy || !state.enabled} onClick={() => send(q)} className="flex-none rounded-pill bg-surface px-3.5 py-2 text-[12.5px] font-semibold shadow-card disabled:opacity-50">{q}</button>
        ))}
      </div>
      <form
        className="fixed inset-x-0 bottom-[72px] z-20 mx-auto flex w-full max-w-[402px] gap-2 bg-canvas px-4 py-2 lg:sticky lg:bottom-4 lg:max-w-none lg:rounded-pill lg:px-0 lg:py-0"
        onSubmit={(e) => { e.preventDefault(); send(text); }}
      >
        <label className="sr-only" htmlFor="companion-input">Ask River</label>
        <input
          id="companion-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          disabled={!state.enabled}
          placeholder="Ask about your shop…"
          className="h-12 min-w-0 flex-1 rounded-pill border border-line bg-surface px-4 text-[14.5px] font-medium shadow-card outline-none focus:border-ink"
        />
        <Button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="size-12 flex-none rounded-full p-0"><ArrowUp size={20} /></Button>
      </form>
    </div>
  );
}

function Bubble({ m }: { m: CompanionMessage }) {
  if (m.role === "owner") {
    return <li className="max-w-[85%] self-end whitespace-pre-wrap rounded-card bg-ink px-4 py-2.5 text-[14px] font-medium text-on-ink">{m.text}</li>;
  }
  if (m.kind === "tip") {
    return (
      <li className="self-stretch rounded-card bg-surface px-4 py-3.5 shadow-card">
        <div className="flex items-center gap-2"><SparkleIcon size={24} /><b className="text-[14px]">Weekly tips · {m.weekId}</b></div>
        {m.text ? <MarkdownLite className="mt-1 text-[13px] font-medium text-muted" text={m.text} /> : null}
        <ol className="mt-2.5 flex flex-col gap-2">
          {(m.tips ?? []).map((t, i) => (
            <li key={i} className="rounded-tile bg-grey-100 px-3 py-2.5"><b className="block text-[13.5px]">{stripMarkdown(t.title)}</b><MarkdownLite className="text-[13px] font-medium text-muted" text={t.body} /></li>
          ))}
          {Array.from({ length: m.lockedCount ?? 0 }, (_, i) => (
            <li key={`l${i}`} aria-hidden className="select-none rounded-tile bg-grey-100 px-3 py-2.5 blur-[5px]"><b className="block text-[13.5px]">Upgrade to see this tip</b><span className="text-[13px] font-medium text-muted">Pro shops get every weekly tip grounded in their numbers.</span></li>
          ))}
        </ol>
        {m.lockedCount ? <Button href="/settings/billing" size="sm" className="mt-3" leadingIcon={<Lock size={14} />}>Unlock {m.lockedCount} more tips with Pro</Button> : null}
      </li>
    );
  }
  if (m.kind === "alert") {
    return (
      <li className="self-stretch rounded-card border-2 border-ink bg-surface px-4 py-3">
        <b className="block text-[12.5px] uppercase tracking-wide">Alert</b>
        <MarkdownLite className="mt-0.5 text-[14px] font-medium" text={m.locked ? "Pro shops get alerts when sales or the queue change sharply." : m.text} />
      </li>
    );
  }
  return <li className="max-w-[90%] self-start rounded-card bg-grey-100 px-4 py-2.5 text-[14px] font-medium"><MarkdownLite text={m.text} /></li>;
}
