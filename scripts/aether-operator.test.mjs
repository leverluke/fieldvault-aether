import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyState,
  fulfillCard,
  isConfirmPhrase,
  liveMemories,
  loadState,
  operatorTurn,
  parseMemoryStatement,
  pickSkill,
  rejectCard,
  saveState,
  STORAGE_KEY,
} from "../src/aether/operator/core.js";

function memKv() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => {
      m.set(k, v);
    },
    remove: (k) => {
      m.delete(k);
    },
    raw: m,
  };
}

test("parseMemoryStatement keeps schedule facts", () => {
  const hit = parseMemoryStatement("soccer Mon/Wed/Thu ~5:30");
  assert.ok(hit);
  assert.equal(hit.kind, "fact");
  assert.match(hit.text, /soccer/i);
});

test("pickSkill routes plan / food / project", () => {
  assert.equal(pickSkill("plan dinner after soccer"), "plan");
  assert.equal(pickSkill("order lunch near me"), "food");
  assert.equal(pickSkill("what should happen next on Craft"), "project");
});

test("confirm phrases match Levi vocabulary", () => {
  assert.equal(isConfirmPhrase("order it"), true);
  assert.equal(isConfirmPhrase("do it"), true);
  assert.equal(isConfirmPhrase("call them"), true);
  assert.equal(isConfirmPhrase("buy this please"), true);
  assert.equal(isConfirmPhrase("what should happen next"), false);
});

test("slice1 loop: remember, draft two cards, confirm one, reject one, persist", () => {
  const kv = memKv();
  let state = emptyState();

  let out = operatorTurn(state, "soccer Mon/Wed/Thu ~5:30");
  state = out.state;
  assert.equal(out.kind, "remember");
  assert.equal(liveMemories(state).length, 1);

  out = operatorTurn(state, "FieldVault demo must work without me narrating");
  state = out.state;
  assert.equal(liveMemories(state).length, 2);

  out = operatorTurn(state, "plan dinner after soccer");
  state = out.state;
  assert.equal(out.kind, "draft");
  assert.equal(out.card?.skill, "plan");
  const planId = out.card.id;

  out = operatorTurn(state, "what should happen next on Craft");
  state = out.state;
  assert.equal(out.kind, "draft");
  assert.equal(out.card?.skill, "project");
  assert.equal(out.card?.projectId, "craft");
  const craftId = out.card.id;

  assert.equal(state.cards.filter((c) => c.status === "draft").length, 2);

  // Ambiguous confirm when two drafts and no active — set active to plan first
  state = { ...state, activeCardId: planId };
  out = operatorTurn(state, "do it", {
    copyText: () => true,
    openUrl: () => true,
  });
  state = out.state;
  assert.equal(out.kind, "fulfill");
  const planCard = state.cards.find((c) => c.id === planId);
  assert.ok(planCard);
  assert.ok(["fulfilled", "needs_connector"].includes(planCard.status));
  assert.ok(planCard.fulfillment);
  assert.notEqual(planCard.fulfillment.status, "draft");
  // Never invent confirmation numbers
  assert.ok(!/confirmation\s*#?\s*\d{4,}/i.test(out.reply));

  const rejected = rejectCard(state, craftId, "not ready for craft next move");
  state = rejected.state;
  assert.equal(state.cards.find((c) => c.id === craftId)?.status, "rejected");
  assert.ok(liveMemories(state).some((m) => m.kind === "lesson"));

  saveState(kv, state);
  const reloaded = loadState(kv);
  assert.equal(liveMemories(reloaded).length >= 3, true);
  assert.ok(reloaded.cards.some((c) => c.id === planId));
  assert.ok(reloaded.cards.some((c) => c.id === craftId && c.status === "rejected"));
  assert.ok(kv.raw.has(STORAGE_KEY));
});

test("fulfill food never claims a completed DoorDash order", () => {
  const card = {
    id: "c1",
    skill: "food",
    title: "Food draft",
    plan: ["draft"],
    draft: {
      who: "pizza nearby",
      what: "Order food",
      message: "Hi, pizza please",
      copy: "Hi, pizza please",
      maps: "https://www.google.com/maps/search/?api=1&query=pizza",
      url: "https://www.google.com/maps/search/?api=1&query=pizza",
    },
    status: "draft",
    source: "order lunch",
    at: Date.now(),
  };
  const result = fulfillCard(card, "order it", {
    copyText: () => true,
    openUrl: () => true,
  });
  assert.equal(result.fulfillment.status, "needs_connector");
  assert.match(result.reply, /DoorDash|vendor|handoff/i);
  assert.ok(!/i ordered it/i.test(result.reply));
  assert.ok(result.fulfillment.receipt);
});

test("two open cards without active asks which one", () => {
  let state = emptyState();
  let out = operatorTurn(state, "plan dinner after soccer");
  state = out.state;
  out = operatorTurn(state, "order lunch");
  state = out.state;
  state = { ...state, activeCardId: null };
  out = operatorTurn(state, "order it");
  assert.equal(out.kind, "ambiguous");
  assert.match(out.reply, /which one/i);
});
