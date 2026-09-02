import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function xml(s: string) {
  return s.replace(/[<>&'"]/g, " ");
}

const g = globalThis as typeof globalThis & {
  __aetherCalls__?: Map<string, { sid: string; token: string; from: string; toUser: string; body: string }>;
};

export const bridgeCall = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sid: z.string().min(8).max(80),
      token: z.string().min(8).max(80),
      from: z.string().min(8).max(20),
      toUser: z.string().min(8).max(20),
      toPlace: z.string().min(8).max(20),
      placeName: z.string().min(1).max(80),
      whisper: z.string().max(240).optional(),
      base: z.string().url().optional(),
      missSms: z.string().max(240).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const line =
      data.whisper ||
      `Connecting you to ${xml(data.placeName)}. Press 1 to put me through.`;
    const gather = data.base
      ? `<Gather numDigits="1" action="${xml(data.base)}/api/twilio/gather?to=${encodeURIComponent(data.toPlace)}" method="POST"><Say voice="Polly.Brian">${xml(line)}</Say></Gather><Say voice="Polly.Brian">No digit. Goodbye.</Say>`
      : `<Say voice="Polly.Brian">${xml(line)}</Say><Pause length="1"/><Dial>${xml(data.toPlace)}</Dial>`;
    const twiml = `<Response>${gather}</Response>`;
    const body = new URLSearchParams({
      To: data.toUser,
      From: data.from,
      Twiml: twiml,
    });
    if (data.base) body.set("StatusCallback", `${data.base}/api/twilio/status`);
    const auth = btoa(`${data.sid}:${data.token}`);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${data.sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(err.slice(0, 180) || `Twilio ${res.status}`);
    }
    const json = (await res.json()) as { sid?: string };
    if (json.sid && data.missSms) {
      g.__aetherCalls__ ??= new Map();
      g.__aetherCalls__.set(json.sid, {
        sid: data.sid,
        token: data.token,
        from: data.from,
        toUser: data.toUser,
        body: data.missSms,
      });
    }
    return { ok: true as const, callSid: json.sid };
  });
