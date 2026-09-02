import { createFileRoute } from "@tanstack/react-router";

const g = globalThis as typeof globalThis & {
  __aetherCalls__?: Map<string, { sid: string; token: string; from: string; toUser: string; body: string }>;
};

async function handle({ request }: { request: Request }) {
  const text = await request.text();
  const p = new URLSearchParams(text);
  const status = (p.get("CallStatus") || "").toLowerCase();
  const callSid = p.get("CallSid") || "";
  const rec = g.__aetherCalls__?.get(callSid);
  if (rec && (status === "no-answer" || status === "busy" || status === "failed" || status === "canceled")) {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${rec.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${rec.sid}:${rec.token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: rec.toUser, From: rec.from, Body: rec.body }),
    }).catch(() => undefined);
    g.__aetherCalls__?.delete(callSid);
  }
  return new Response("ok");
}

export const Route = createFileRoute("/api/twilio/status")({
  server: { handlers: { POST: handle } },
});
