"use client";

import { SparkleIcon } from "@river-apps/icons";
import { Button, Card } from "@river-apps/ui";
import { ArrowUp, Lock, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { ApiError } from "@/lib/api";
import { askCompanion, devSeed, getCompanion, isDevEnv, runTips, saveGoal, type CompanionMessage, type CompanionState, type GoalProgress } from "@/lib/companion";

const SUGGESTIONS = ["Magkano kinita ko last week?", "Anong oras pinakamaraming kotse?", "Paano ko mapapataas ang average ticket?", "Ilang customers ang hindi na bumalik?"];
const peso = (n: number) => `₱${n.toLocaleString("en-US")}`;

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
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => getCompanion(shopId).then(setState, (e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);
  useEffect(() => {
    // Block body: newer Chrome returns a Promise from scrollIntoView, which React would call as a cleanup.
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state?.messages.length, busy]);

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
      setState((s) => s && { ...s, messages: s.messages.filter((m) => m.id !== "pending") });
      setText(value);
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return error ? <p role="alert" className="mt-4 font-semibold">{error}</p> : <LoadingBlock />;
  const partner = state.tier === "partner";
  const out = partner && state.quota.remaining === 0;

  return (
    <div className="mt-4 flex flex-col gap-3 pb-28 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-5">
      <div className="flex min-w-0 flex-col gap-3">
        {partner ? <QuotaBanner remaining={state.quota.remaining ?? 0} limit={state.quota.limit ?? 10} /> : null}
        {!state.enabled ? <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">AI Companion is coming soon for your shop.</p> : null}
        {state.messages.length === 0 ? (
          <Card padding="none" className="flex flex-col items-center px-5 py-6 text-center">
            <SparkleIcon size={56} />
            <b className="mt-2 text-[16px]">Kumusta! I’m River.</b>
            <p className="mt-1 text-[13.5px] font-medium text-muted">Ask me about your sales, busy hours, services or customers, or anything about running a car wash.</p>
          </Card>
        ) : null}
        <ul className="flex flex-col gap-2.5" aria-live="polite">
          {state.messages.map((m) => <Bubble key={m.id} m={m} />)}
          {busy ? <li className="self-start rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">River is checking your numbers…</li> : null}
        </ul>
        <div ref={endRef} />
        {error ? <p role="alert" className="text-[13px] font-semibold">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" disabled={busy || out} onClick={() => send(s)} className="rounded-pill bg-grey-100 px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50">{s}</button>
          ))}
        </div>
        <form
          className="fixed inset-x-0 bottom-[72px] z-20 mx-auto flex w-full max-w-[402px] gap-2 bg-canvas px-4 py-2 lg:static lg:max-w-none lg:px-0"
          onSubmit={(e) => { e.preventDefault(); send(text); }}
        >
          <label className="sr-only" htmlFor="companion-input">Ask River</label>
          <input
            id="companion-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            disabled={out || !state.enabled}
            placeholder={out ? "Upgrade to keep chatting" : "Ask about your shop…"}
            className="h-12 min-w-0 flex-1 rounded-pill border border-line bg-surface px-4 text-[14.5px] font-medium outline-none focus:border-ink"
          />
          <Button type="submit" aria-label="Send" disabled={busy || out || !text.trim()} className="size-12 flex-none rounded-full p-0"><ArrowUp size={20} /></Button>
        </form>
      </div>
      <aside className="flex flex-col gap-3">
        <Goals shopId={shopId} goals={state.goals} onSaved={(goals) => setState({ ...state, goals })} />
        {isDevEnv() ? <DevTools shopId={shopId} onDone={load} /> : null}
      </aside>
    </div>
  );
}

function QuotaBanner({ remaining, limit }: { remaining: number; limit: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card bg-ink px-4 py-3 text-on-ink">
      <span className="min-w-0">
        <b className="block text-[14px]">{remaining} of {limit} free questions left</b>
        <small className="text-[12px] font-semibold text-on-ink-muted">Partner: {limit} questions a month + 1 weekly tip. Pro: unlimited, all tips, alerts and goals.</small>
      </span>
      <Button href="/settings/billing" variant="white" size="sm" className="flex-none">Upgrade</Button>
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
        {m.text ? <p className="mt-1 text-[13px] font-medium text-muted">{m.text}</p> : null}
        <ol className="mt-2.5 flex flex-col gap-2">
          {(m.tips ?? []).map((t, i) => (
            <li key={i} className="rounded-tile bg-grey-100 px-3 py-2.5"><b className="block text-[13.5px]">{t.title}</b><span className="text-[13px] font-medium text-muted">{t.body}</span></li>
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
        <p className="mt-0.5 whitespace-pre-wrap text-[14px] font-medium">{m.locked ? "Pro shops get alerts when sales or the queue change sharply." : m.text}</p>
      </li>
    );
  }
  return <li className="max-w-[90%] self-start whitespace-pre-wrap rounded-card bg-grey-100 px-4 py-2.5 text-[14px] font-medium">{m.text}</li>;
}

function Goals({ shopId, goals, onSaved }: { shopId: string; goals: GoalProgress[] | null; onSaved: (g: GoalProgress[]) => void }) {
  const [target, setTarget] = useState("");
  const [err, setErr] = useState("");
  if (goals === null) {
    return (
      <Card padding="none" className="px-4 py-3.5">
        <b className="flex items-center gap-2 text-[14.5px]"><Target size={16} /> Goals</b>
        <p className="mt-1 text-[13px] font-medium text-muted">Set a monthly target like ₱50,000 and River tracks your pace. Included with Pro and Lifetime.</p>
        <Button href="/settings/billing" size="sm" variant="secondary" className="mt-3">See plans</Button>
      </Card>
    );
  }
  return (
    <Card padding="none" className="px-4 py-3.5">
      <b className="flex items-center gap-2 text-[14.5px]"><Target size={16} /> Goals</b>
      {goals.length === 0 ? <p className="mt-1 text-[13px] font-medium text-muted">No goal yet. Try “Goal ko ₱50k this month”.</p> : null}
      {goals.map((g) => (
        <div key={g.goal} className="mt-2.5">
          <div className="flex justify-between text-[13px] font-bold"><span>{g.goal}</span><span>{g.percent}%</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-pill bg-grey-100"><div className="h-full rounded-pill bg-ink" style={{ width: `${Math.min(100, g.percent)}%` }} /></div>
          <p className="mt-1 text-[12px] font-semibold text-muted">
            {g.metric === "revenue" ? peso(g.actual) : `${g.actual} cars`} so far · {g.onTrack ? "on track" : `need ${g.metric === "revenue" ? peso(g.neededPerDay) : g.neededPerDay}/day`} · {g.daysLeft} days left
          </p>
        </div>
      ))}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(target.replace(/[^\d]/g, ""));
          if (!n) return;
          saveGoal(shopId, { metric: "revenue", period: "month", target: n }).then((g) => { onSaved(g); setTarget(""); setErr(""); }, (e2: Error) => setErr(e2.message));
        }}
      >
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" placeholder="Monthly sales goal, ₱" aria-label="Monthly sales goal in pesos" className="h-10 min-w-0 flex-1 rounded-pill border border-line px-3 text-[13.5px]" />
        <Button type="submit" size="sm">Save</Button>
      </form>
      {err ? <p className="mt-1 text-[12px] font-semibold">{err}</p> : null}
    </Card>
  );
}

/** Dev environment only: seed demo data and trigger the Monday job for this shop. */
function DevTools({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const act = (label: string, fn: () => Promise<unknown>) => {
    setMsg(`${label}…`);
    fn().then(() => { setMsg(`${label}: done`); onDone(); }, (e: Error) => setMsg(`${label}: ${e.message}`));
  };
  return (
    <Card padding="none" className="border border-dashed border-line px-4 py-3.5">
      <b className="text-[13px]">Dev tools (dev database only)</b>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="xs" variant="secondary" onClick={() => act("Seed as Pro", () => devSeed(shopId, "paid"))}>Seed demo · Pro</Button>
        <Button size="xs" variant="secondary" onClick={() => act("Seed as Partner", () => devSeed(shopId, "partner"))}>Seed demo · Partner</Button>
        <Button size="xs" variant="secondary" onClick={() => act("Run Monday tips", () => runTips(shopId))}>Run Monday tips</Button>
      </div>
      {msg ? <p className="mt-2 text-[12px] font-semibold text-muted">{msg}</p> : null}
    </Card>
  );
}
