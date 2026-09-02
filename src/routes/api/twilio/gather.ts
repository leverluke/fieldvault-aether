import { createFileRoute } from "@tanstack/react-router";

function xml(s: string) {
  return s.replace(/[<>&'"]/g, " ");
}

async function handle({ request }: { request: Request }) {
  const url = new URL(request.url);
  const toPlace = url.searchParams.get("to") || "";
  const body = await request.text();
  const digits = new URLSearchParams(body).get("Digits") || url.searchParams.get("Digits") || "";
  const twiml =
    digits === "1" && toPlace
      ? `<Response><Say voice="Polly.Brian">Connecting now.</Say><Dial>${xml(toPlace)}</Dial></Response>`
      : `<Response><Say voice="Polly.Brian">Cancelled.</Say><Hangup/></Response>`;
  return new Response(twiml, { headers: { "content-type": "text/xml" } });
}

export const Route = createFileRoute("/api/twilio/gather")({
  server: { handlers: { POST: handle, GET: handle } },
});
