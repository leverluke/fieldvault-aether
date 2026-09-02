import type { Reply } from "./types";

const KEY = "aether-llm";

export function llmKey() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setLlmKey(k: string) {
  localStorage.setItem(KEY, k.trim());
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "act",
      description: "Run an Aether command the user would say out loud",
      parameters: {
        type: "object",
        properties: { say: { type: "string" } },
        required: ["say"],
      },
    },
  },
];

export async function tryLlm(q: string, runSay: (s: string) => Promise<Reply>): Promise<Reply | null> {
  const key = llmKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content:
              "You are Aether. Prefer calling act() with a short command Aether already understands: book, call, remind, find, follow, export zip, quiet watch. Do not invent APIs.",
          },
          { role: "user", content: q },
        ],
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
    };
    const msg = data.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0];
    if (call?.function?.name === "act") {
      const args = JSON.parse(call.function.arguments || "{}") as { say?: string };
      if (args.say) return runSay(args.say);
    }
    if (msg?.content) return { text: msg.content, ran: "llm" };
  } catch {
    return null;
  }
  return null;
}
