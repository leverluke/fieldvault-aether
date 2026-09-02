"use client";

import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAlwaysListen, isMuted, loadCallSettings, loadContacts, loadLastPlace, loadReservations, loadProfile, restoreTimers, saveCallSettings, saveProfile, setAlwaysListen, setMuted as persistMuted } from "./memory";
import { run } from "./run";
import type { Action } from "./types";
import { hasWake, makeRecognizer, speak, stopSpeaking, stripWake } from "./speech";
import { hullCopy } from "@/vision/hull";
import { getQuiet, setQuiet, takePending, undoLast, undoStack } from "./log";
import { llmKey, setLlmKey } from "./llm";
import { bootBrain, brainNote } from "./brain";
import { skipPlan } from "./plan";
import { hushAgent, isHushed } from "./hush";
import type { AgentId } from "./brain/bank";
import { watchFences } from "./geo";

type Line = { who: "you" | "aether"; text: string; ran?: string; why?: string; actions?: Action[] };

export function Aether() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const play = pathname.endsWith("/play") || pathname.endsWith("/see") || pathname.endsWith("/craft");
  const copy = hullCopy();
  const lastPlace = loadLastPlace();
  const lastBook = loadReservations()[0];
  const people = loadContacts().filter((c) => c.phone).slice(0, 3);
  const chips = play && pathname.endsWith("/craft")
    ? [`${copy.go}, follow #1, hold`, "Hold 3 m", "Where is the chair?", copy.stop]
    : play
      ? ["What have you seen?", "Find pump 4", "Tell me when you see a person", "Lost ids"]
      : [
          "Book Saturday 7 Italian",
          ...people.map((c) => `Call ${c.name}`),
          lastPlace?.phone ? `Call ${lastPlace.name}` : "",
          lastBook?.script ? `Call ${lastBook.place}` : "",
          lastPlace?.phone ? `Text ${lastPlace.name}` : "",
          "What's next?",
        ].filter(Boolean);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [always, setAlways] = useState(false);
  const [muted, setMuted] = useState(false);
  const [callingOpen, setCallingOpen] = useState(false);
  const [llm, setLlm] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [fromNum, setFromNum] = useState("");
  const [autoDial, setAutoDial] = useState(true);
  const [quiet, setQuietRange] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      who: "aether",
      text: play
        ? "Cortex on. Eyes, craft, or life — same voice. Target an ID, then follow it. I do not fly a real hull from here."
        : "Cortex on. Book a table, I'll draft it. You tap Call. Status includes what the eyes last saw.",
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const recRef = useRef<ReturnType<typeof makeRecognizer>>(null);
  const greeted = useRef(false);
  const alwaysRef = useRef(false);
  const pendingWake = useRef(false);
  const handleRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    setMuted(isMuted());
    setAlways(isAlwaysListen());
    alwaysRef.current = isAlwaysListen();
    const cs = loadCallSettings();
    setAutoDial(cs.autoDial !== false);
    setSid(cs.twilioSid || "");
    setToken(cs.twilioToken || "");
    setFromNum(cs.twilioFrom || "");
    setMyPhone(loadProfile().phone || "");
    setLlm(llmKey());
    setQuietRange(getQuiet());
    void bootBrain();
    restoreTimers((label) => {
      const msg = `That's time. ${label}.`;
      setLines((l) => [...l, { who: "aether", text: msg, ran: "timer" }]);
      speak(msg, isMuted());
      setOpen(true);
    });
    const stopFence = watchFences((f) => {
      const msg = f.routine ? `You're at ${f.name}. Running ${f.routine}.` : `You're at ${f.name}.`;
      setLines((l) => [...l, { who: "aether", text: msg, ran: "fence" }]);
      speak(msg, isMuted());
      setOpen(true);
      if (f.routine) void handleRef.current(`run ${f.routine}`);
      else void navigate({ href: "/apps/aether/see" });
    });
    const loadVoices = () => window.speechSynthesis?.getVoices();
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      stopFence();
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, open]);

  useEffect(() => {
    if (open && !greeted.current && !isMuted()) {
      greeted.current = true;
      speak("Online. At your service.", false);
    }
  }, [open]);

  async function handle(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setLines((l) => [...l, { who: "you", text: q }]);
    stopSpeaking();
    skipPlan("interrupt");
    setBusy(true);
    try {
      const reply = await run(q, {
        navigate: (to) => {
          void navigate({ href: to });
        },
        pathname,
        onTimer: (label) => {
          const msg = `That's time. ${label}.`;
          setLines((l) => [...l, { who: "aether", text: msg, ran: "timer" }]);
          speak(msg, isMuted());
          setOpen(true);
        },
      });
      if (reply.ran === "mute") {
        persistMuted(true);
        setMuted(true);
        stopSpeaking();
      }
      if (reply.ran === "unmute") {
        persistMuted(false);
        setMuted(false);
      }
      setLines((l) => [
        ...l,
        { who: "aether", text: reply.text, ran: reply.ran, why: reply.why, actions: reply.actions },
      ]);
      const nowMuted = reply.ran === "mute" || (muted && reply.ran !== "unmute");
      if (reply.ran !== "mute") speak(reply.speak ?? reply.text, nowMuted);
      if (reply.dial) {
        window.setTimeout(() => {
          window.location.href = reply.dial!;
        }, 1100);
      }
    } catch {
      setLines((l) => [
        ...l,
        { who: "aether", text: "That one didn't go through. I'm still here." },
      ]);
    } finally {
      setBusy(false);
    }
  }
  handleRef.current = handle;

  useEffect(() => {
    function onUtter(e: Event) {
      const t = (e as CustomEvent<string>).detail;
      if (t) {
        setOpen(true);
        void handleRef.current(t);
      }
    }
    window.addEventListener("aether:utterance", onUtter);
    function onWatch(e: Event) {
      const t = (e as CustomEvent<string>).detail;
      if (t) {
        setOpen(true);
        setLines((l) => [...l, { who: "aether", text: t, ran: "watch" }]);
      }
    }
    window.addEventListener("aether:watch", onWatch);
    return () => {
      window.removeEventListener("aether:utterance", onUtter);
      window.removeEventListener("aether:watch", onWatch);
    };
  }, []);

  async function onAction(a: Action) {
    if (a.kind === "confirm") {
      const p = takePending();
      if (p) {
        const reply = await p.run();
        setLines((l) => [...l, { who: "aether", text: reply.text, ran: reply.ran, actions: reply.actions }]);
        speak(reply.speak ?? reply.text, isMuted());
        if (reply.dial) window.setTimeout(() => {
          window.location.href = reply.dial!;
        }, 400);
      }
      return;
    }
    if (a.kind === "cancel") {
      takePending();
      setLines((l) => [...l, { who: "aether", text: "Cancelled." }]);
      return;
    }
    if (a.copy) {
      try {
        await navigator.clipboard.writeText(a.copy);
        setLines((l) => [...l, { who: "aether", text: "Copied." }]);
      } catch {
        setLines((l) => [...l, { who: "aether", text: "Clipboard is blocked." }]);
      }
      return;
    }
    if (a.href) window.location.href = a.href;
  }

  function armRec(continuous: boolean) {
    recRef.current?.abort();
    const rec = makeRecognizer({ continuous });
    recRef.current = rec;
    if (!rec) return null;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const t = last[0].transcript;
      stopSpeaking();
      setInput(t);
      if (!last.isFinal) return;
      if (alwaysRef.current) {
        if (hasWake(t) || pendingWake.current) {
          const cmd = stripWake(t);
          pendingWake.current = !cmd;
          if (cmd) void handleRef.current(cmd);
        }
        return;
      }
      setListening(false);
      void handleRef.current(t);
    };
    rec.onend = () => {
      if (alwaysRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
        return;
      }
      setListening(false);
    };
    rec.onerror = () => {
      if (!alwaysRef.current) setListening(false);
    };
    return rec;
  }

  function toggleAlways(next = !alwaysRef.current) {
    alwaysRef.current = next;
    setAlways(next);
    setAlwaysListen(next);
    if (!next) {
      recRef.current?.abort();
      setListening(false);
      return;
    }
    setOpen(true);
    const rec = armRec(true);
    if (!rec) {
      setLines((l) => [...l, { who: "aether", text: "This browser has no speech recognition." }]);
      alwaysRef.current = false;
      setAlways(false);
      return;
    }
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    setListening(true);
    setLines((l) => [
      ...l,
      { who: "aether", text: "Always on. Say Aether, then the plan. Hold to talk is cleaner." },
    ]);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    persistMuted(next);
    if (next) stopSpeaking();
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex flex-col items-end gap-3",
        play ? "right-3 bottom-28 sm:bottom-8" : "right-3 bottom-20 sm:bottom-6 sm:right-5",
      )}
    >
      {open ? (
        <div className="pointer-events-auto flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                {brainNote()}
              </p>
              <p className="font-display text-xl text-fg">Aether</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  "h-9 rounded-md border px-2 text-[11px]",
                  always ? "border-primary text-primary" : "border-border text-muted",
                )}
                onClick={() => toggleAlways()}
              >
                {always ? "Always on" : "Always off"}
              </button>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={toggleMute}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
                aria-label="Close Aether"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div ref={scroller} className="max-h-[min(52dvh,24rem)] space-y-3 overflow-y-auto px-4 py-3">
            {lines.map((ln, i) => (
              <div key={i} className={cn("text-sm leading-relaxed", ln.who === "you" ? "text-muted" : "text-fg")}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {ln.who === "you" ? "You" : ln.ran ? `Aether · ${ln.ran}` : "Aether"}
                </p>
                {ln.why ? <p className="text-[10px] text-muted">{ln.why}</p> : null}
                <p className="mt-1 whitespace-pre-wrap">{ln.text}</p>
                {ln.actions?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ln.actions.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                        onClick={() => void onAction(a)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <p className="text-xs text-muted">On it…</p> : null}
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-fg"
                onClick={() => void handle(c)}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-fg"
              onClick={() => {
                setLines((l) => [...l, { who: "aether", text: undoLast() }]);
              }}
            >
              Undo
            </button>
          </div>
          <div className="border-t border-border px-4 py-2">
            <button
              type="button"
              className="text-[11px] uppercase tracking-wider text-muted"
              onClick={() => setCallingOpen((v) => !v)}
            >
              Calling {callingOpen ? "▴" : "▾"}
            </button>
            {callingOpen ? (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-[11px] leading-relaxed text-muted">
                  {sid && myPhone
                    ? "Mode: Twilio — rings you, whispers the table, then connects the place."
                    : "Mode: phone dialer (tel:). You talk. Add Twilio to ring you first."}
                </p>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={autoDial}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setAutoDial(on);
                      saveCallSettings({ autoDial: on });
                    }}
                  />
                  Auto-open the dialer
                </label>
                <input
                  value={quiet}
                  onChange={(e) => setQuietRange(e.target.value)}
                  placeholder="Quiet hours 22-7"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <p className="text-[11px] text-muted">Mute agents</p>
                <div className="flex flex-wrap gap-2">
                  {(["eyes", "craft", "life", "watch"] as AgentId[]).map((id) => (
                    <label key={id} className="flex items-center gap-1 text-[11px] text-muted">
                      <input
                        type="checkbox"
                        defaultChecked={isHushed(id)}
                        onChange={(e) => hushAgent(id, e.target.checked)}
                      />
                      hush {id}
                    </label>
                  ))}
                </div>
                <input
                  value={myPhone}
                  onChange={(e) => setMyPhone(e.target.value)}
                  placeholder="Your cell +1…"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <input
                  value={fromNum}
                  onChange={(e) => setFromNum(e.target.value)}
                  placeholder="Twilio from +1…"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <input
                  value={sid}
                  onChange={(e) => setSid(e.target.value)}
                  placeholder="Twilio SID"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Twilio token"
                  type="password"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <input
                  value={llm}
                  onChange={(e) => setLlm(e.target.value)}
                  placeholder="xAI / Grok API key (optional tool-calling)"
                  type="password"
                  className="h-9 rounded-md border border-border bg-elevated px-2 text-xs"
                />
                <button
                  type="button"
                  className="h-9 rounded-md border border-border text-xs"
                  onClick={() => {
                    setLlmKey(llm);
                    setLines((l) => [...l, { who: "aether", text: llm ? "Tool-calling on. I'll route fuzzy asks through Grok, then act." : "Tool-calling off." }]);
                  }}
                >
                  Save model key
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md border border-border text-xs"
                  onClick={() => {
                    saveProfile({ phone: myPhone || undefined });
                    saveCallSettings({
                      autoDial,
                      twilioSid: sid || undefined,
                      twilioToken: token || undefined,
                      twilioFrom: fromNum || undefined,
                    });
                    if (quiet.trim()) setQuiet(quiet.trim());
                    setLines((l) => [
                      ...l,
                      {
                        who: "aether",
                        text: sid
                          ? "Calling account saved. “Call them” will ring your cell, then the place."
                          : "Saved. “Call them” will open the phone dialer.",
                      },
                    ]);
                  }}
                >
                  Save calling
                </button>
                {undoStack().length ? (
                  <p className="text-[11px] text-muted">Undo: {undoStack().slice(-3).map((u) => u.label).join(" · ")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handle(input);
            }}
            onPaste={(e) => {
              const f = e.clipboardData?.files?.[0] || e.clipboardData?.items?.[0]?.getAsFile();
              if (!f || !f.type.startsWith("image/")) return;
              e.preventDefault();
              const url = URL.createObjectURL(f);
              const img = new Image();
              img.onload = () => {
                void (async () => {
                  const { loadModel, detect, embedCrop } = await import("@/vision/detector");
                  await loadModel();
                  const frame = await detect(img, { minScore: 0.28, filter: "all" });
                  const { publishFrame, describeFrame } = await import("./bus");
                  publishFrame(frame);
                  const big = [...frame.objects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
                  if (big) {
                    const vec = await embedCrop(img, big);
                    if (vec) {
                      const { setPendingTeach } = await import("@/vision/teach");
                      setPendingTeach(vec, big.class);
                    }
                  }
                  const text = big
                    ? `${describeFrame(frame)}\nSay “this is pump 4” to keep that still.`
                    : describeFrame(frame);
                  setLines((l) => [
                    ...l,
                    { who: "you", text: "Dropped a still." },
                    { who: "aether", text, ran: "eyes" },
                  ]);
                  speak(text, isMuted());
                })();
              };
              img.src = url;
            }}
          >
            <label className="sr-only" htmlFor="aether-input">
              Ask Aether
            </label>
            <input
              id="aether-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={play ? "What’s that? Run inspect. Tell me when you see a dog." : "Run morning. Remember the gate code is 4455."}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary"
              autoComplete="off"
            />
            <button
              type="button"
              className={cn(
                "inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-xs",
                listening ? "bg-primary text-primary-foreground" : "text-fg hover:bg-elevated",
              )}
              aria-label="Hold to talk"
              onPointerDown={(e) => {
                e.preventDefault();
                if (always) return;
                const rec = armRec(false);
                if (!rec) return;
                try {
                  rec.start();
                  setListening(true);
                } catch {
                  /* ignore */
                }
              }}
              onPointerUp={() => {
                if (always) return;
                recRef.current?.stop();
                setListening(false);
              }}
              onPointerCancel={() => {
                recRef.current?.stop();
                setListening(false);
              }}
            >
              {listening ? "Listening…" : "Hold"}
            </button>
            <Button type="submit" size="sm" className="h-11" disabled={busy}>
              Do it
            </Button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          "pointer-events-auto inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-fg",
          listening && "ring-2 ring-primary",
        )}
        aria-label={open ? "Aether is open" : "Open Aether"}
        onClick={() => setOpen((v) => !v)}
      >
        Ae
      </button>
    </div>
  );
}
