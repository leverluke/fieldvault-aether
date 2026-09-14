"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AetherMind } from "@/components/site/AetherMind";
import {
  editKnown,
  forgetKnown,
  loadOperator,
  rejectActive,
  runOperator,
  setActiveCard,
  type DraftCard,
  type MemoryEntry,
  type OperatorState,
} from "@/aether/operator";
import { cn } from "@/lib/utils";

const CHIPS = [
  "soccer Mon/Wed/Thu ~5:30",
  "FieldVault demo must work without me narrating",
  "plan dinner after soccer",
  "what should happen next on Craft",
  "attach FieldVault",
  "do it",
  "reject",
];

export function AetherOperator() {
  const [state, setState] = useState<OperatorState>({
    memories: [],
    cards: [],
    projects: [],
    activeCardId: null,
    activeProjectId: null,
  });
  const [input, setInput] = useState("");
  const [log, setLog] = useState<{ who: "you" | "aether"; text: string }[]>([
    {
      who: "aether",
      text: "Personal operator online. Memory stays on this device. I draft; you confirm send/pay/call with order it / do it / call them.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadOperator());
    setReady(true);
  }, []);

  const known = useMemo(
    () => (ready ? state.memories.filter((m) => !m.forgotten).slice(0, 24) : []),
    [state.memories, ready],
  );
  const openLoops = useMemo(
    () =>
      state.memories.filter(
        (m) => !m.forgotten && (m.kind === "open_loop" || m.kind === "lesson"),
      ),
    [state.memories],
  );
  const drafts = useMemo(
    () =>
      state.cards.filter((c) =>
        ["draft", "executing", "needs_connector", "fulfilled", "failed", "rejected"].includes(
          c.status,
        ),
      ),
    [state.cards],
  );
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];

  async function submit(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setLog((l) => [...l, { who: "you", text: q }]);
    try {
      const out = runOperator(q);
      setState(out.state);
      setLog((l) => [...l, { who: "aether", text: out.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Operator hit an error.";
      setLog((l) => [...l, { who: "aether", text: `Could not run that: ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  function refresh(next: OperatorState, reply: string, you?: string) {
    setState(next);
    setLog((l) => [
      ...l,
      ...(you ? [{ who: "you" as const, text: you }] : []),
      { who: "aether", text: reply },
    ]);
  }

  function onConfirm(card: DraftCard, phrase: string) {
    setActiveCard(card.id);
    void submit(phrase);
  }

  function onReject(card: DraftCard) {
    setActiveCard(card.id);
    const out = rejectActive("not this draft");
    refresh(out.state, out.reply, "reject");
  }

  function onForget(m: MemoryEntry) {
    refresh(forgetKnown(m.id), `Forgot: ${m.text}`);
  }

  function onSaveEdit() {
    if (!editId || !editText.trim()) return;
    refresh(editKnown(editId, editText), `Updated memory.`, undefined);
    setEditId(null);
    setEditText("");
  }

  return (
    <div className="border-b border-border bg-bg">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:py-14">
        <header className="lg:col-span-12">
          <p className="text-sm text-muted">Levi’s on-device operator</p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
            Aether
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Talk → memory → plan → skill draft → your confirm → receipt or honest gap. No accounts.
            Food/parts stay draft until you say <span className="text-fg">order it</span> /{" "}
            <span className="text-fg">do it</span> / <span className="text-fg">call them</span>.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <a className="border border-border px-3 py-2 text-fg hover:border-primary" href="/apps/aether/see">
              Eyes
            </a>
            <a className="border border-border px-3 py-2 text-fg hover:border-primary" href="/apps/aether/craft">
              Craft
            </a>
            <a className="border border-border px-3 py-2 text-fg hover:border-primary" href="/apps/fieldvault/play">
              FieldVault play
            </a>
          </div>
        </header>

        <section className="lg:col-span-5 space-y-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <AetherMind />
          </div>

          <Panel title="What I know about you">
            {known.length === 0 ? (
              <p className="text-sm text-muted">Empty. Tell me something true — schedule, preference, project goal.</p>
            ) : (
              <ul className="space-y-3">
                {known.map((m) => (
                  <li key={m.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{m.kind}</p>
                        {editId === m.id ? (
                          <textarea
                            className="mt-1 w-full border border-border bg-surface px-2 py-1 text-sm text-fg"
                            rows={2}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                        ) : (
                          <p className="mt-1 text-sm text-fg">{m.text}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {editId === m.id ? (
                          <button type="button" className="text-xs text-primary" onClick={onSaveEdit}>
                            Save
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-fg"
                            onClick={() => {
                              setEditId(m.id);
                              setEditText(m.text);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => onForget(m)}>
                          Forget
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Open loops / lessons">
            {openLoops.length === 0 ? (
              <p className="text-sm text-muted">Reject a draft to teach a lesson. It survives refresh.</p>
            ) : (
              <ul className="space-y-2">
                {openLoops.map((m) => (
                  <li key={m.id} className="text-sm text-fg">
                    <span className="text-muted">[{m.kind}]</span> {m.text}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Project attach">
            {activeProject ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-fg">{activeProject.label}</p>
                <p className="text-muted">{activeProject.goal}</p>
                <p className="text-[11px] leading-relaxed text-muted">
                  Paths: {activeProject.paths.join(" · ") || "—"}
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-fg">
                  {activeProject.nextMoves.slice(0, 3).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Say “attach Craft” or “what should happen next on FieldVault”. Brain proposes; domain code stays the body.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(["fieldvault", "eyes", "craft"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="border border-border px-2 py-1 text-xs text-fg hover:border-primary"
                  onClick={() => void submit(`attach ${id}`)}
                >
                  Attach {id}
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <section className="lg:col-span-7 space-y-6">
          <Panel title="Talk">
            <div className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {log.slice(-12).map((line, i) => (
                <p key={`${line.who}-${i}`} className={cn(line.who === "you" ? "text-fg" : "text-muted")}>
                  <span className="text-[10px] uppercase tracking-wider text-muted">{line.who}</span>{" "}
                  {line.text}
                </p>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
            >
              <input
                className="min-h-11 flex-1 border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-primary"
                placeholder="Fact, plan, food draft, project brain…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Send
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="border border-border px-2 py-1 text-xs text-muted hover:border-primary hover:text-fg"
                  onClick={() => void submit(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Draft action cards">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted">
                Ask “plan dinner after soccer” or “what should happen next on Craft” — cards land here.
              </p>
            ) : (
              <ul className="space-y-4">
                {drafts.slice(0, 8).map((card) => (
                  <li
                    key={card.id}
                    className={cn(
                      "border border-border p-4",
                      state.activeCardId === card.id && "border-primary",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium text-fg">{card.title}</h3>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        {card.skill} · {card.status}
                      </span>
                    </div>
                    <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-muted">
                      {card.plan.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-fg">
                      {card.draft.who ? <p>Who: {card.draft.who}</p> : null}
                      <p>What: {card.draft.what}</p>
                      {card.draft.when ? <p>When: {card.draft.when}</p> : null}
                      {card.draft.message ? (
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted">
                          {card.draft.message}
                        </pre>
                      ) : null}
                    </div>
                    {card.fulfillment ? (
                      <p className="mt-2 text-xs text-muted">
                        Fulfillment: {card.fulfillment.status}
                        {card.fulfillment.receipt ? ` — ${card.fulfillment.receipt}` : ""}
                        {card.fulfillment.failReason ? ` — ${card.fulfillment.failReason}` : ""}
                      </p>
                    ) : null}
                    {card.status === "draft" || card.status === "needs_connector" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                          onClick={() => onConfirm(card, card.skill === "food" ? "order it" : "do it")}
                        >
                          {card.skill === "food" ? "Order it" : "Do it"}
                        </button>
                        {card.skill === "food" ? (
                          <button
                            type="button"
                            className="border border-border px-3 py-2 text-xs text-fg"
                            onClick={() => onConfirm(card, "call them")}
                          >
                            Call them
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="border border-border px-3 py-2 text-xs text-muted"
                          onClick={() => onReject(card)}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="border border-border px-3 py-2 text-xs text-muted"
                          onClick={() => setState(setActiveCard(card.id))}
                        >
                          Make active
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
      <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
