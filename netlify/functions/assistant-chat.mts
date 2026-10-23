// Netlify Function: stateless assistant chat backed by OpenRouter.
//
// Served at /api/assistant/chat so the static web export can call it
// same-origin. This replaces the separate Express API on Netlify — no
// extra server or container is needed. Validation, model, and SSE event
// shape intentionally mirror artifacts/api-server/src/routes/assistant.ts.

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL_ID = "nvidia/nemotron-3.5-lightning:free";

function readEnv(name: string): string {
  try {
    const viaNetlify = (globalThis as Record<string, any>)?.Netlify?.env?.get?.(
      name,
    );
    if (typeof viaNetlify === "string" && viaNetlify.length > 0)
      return viaNetlify;
  } catch {
    // Fall through to process.env (local `netlify dev`).
  }
  const fallback =
    typeof process !== "undefined"
      ? (process as unknown as { env: Record<string, string | undefined> })
          .env[name]
      : undefined;
  return (fallback ?? "").trim();
}

function systemInstruction(personality: string, developerMode: boolean) {
  const base =
    "You are a thoughtful personal assistant. Always reply in Bangla (Bengali) language unless the user explicitly requests another language. Be clear, practical, and concise. Never claim to have performed an external action. Ask before risky changes or external actions.";
  const developer =
    "The user may ask for help developing their Personal AI Assistant. Understand the instructions, propose a clear plan, write and organize code when asked, preserve working behavior, explain normal bugs and fixes, and ask approval before risky changes, permissions, authentication, API keys, account connections, data deletion, or external actions. Never change security or access permissions without explicit approval.";
  const custom = personality.trim().slice(0, 1000);
  return [base, developerMode ? developer : "", custom]
    .filter(Boolean)
    .join("\n\n");
}

function extractDeltas(event: string): { texts: string[]; done: boolean } {
  const texts: string[] = [];
  let done = false;
  for (const line of event.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      continue;
    }
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: unknown } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) texts.push(delta);
    } catch {
      // Ignore a malformed event; the stream may still continue.
    }
  }
  return { texts, done };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid assistant message." },
      { status: 400 },
    );
  }

  const { message, personality = "", developerMode = false } = (body ??
    {}) as {
    message?: unknown;
    personality?: unknown;
    developerMode?: unknown;
  };

  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > 4000 ||
    typeof personality !== "string" ||
    typeof developerMode !== "boolean"
  ) {
    return Response.json({ error: "Invalid assistant message." }, { status: 400 });
  }

  const apiKey = readEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return Response.json(
      {
        code: "AI_NOT_CONFIGURED",
        error:
          "Add OPENROUTER_API_KEY to this site's environment variables to connect to OpenRouter.",
      },
      { status: 503 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Personal AI Assistant",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL_ID,
        max_tokens: 8192,
        messages: [
          {
            role: "system",
            content: systemInstruction(personality, developerMode),
          },
          { role: "user", content: message.trim() },
        ],
        stream: true,
      }),
    });
  } catch {
    return Response.json(
      {
        code: "OPENROUTER_REQUEST_FAILED",
        error: "OpenRouter could not complete the reply. Please try again.",
      },
      { status: 502 },
    );
  }

  if (upstream.status === 429) {
    return Response.json(
      {
        code: "OPENROUTER_RATE_LIMIT",
        error:
          "The free-model request limit has been reached. Please try again later.",
      },
      { status: 429 },
    );
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      {
        code: "OPENROUTER_REQUEST_FAILED",
        error: "OpenRouter could not complete the reply. Please try again.",
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let pending = "";
      const send = (payload: string) =>
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          pending = pending.replace(/\r\n/g, "\n");
          let boundary = pending.indexOf("\n\n");
          while (boundary >= 0) {
            const event = pending.slice(0, boundary);
            pending = pending.slice(boundary + 2);
            const { texts, done: streamDone } = extractDeltas(event);
            for (const content of texts)
              send(JSON.stringify({ content }));
            if (streamDone) {
              send("[DONE]");
              controller.close();
              reader.releaseLock();
              return;
            }
            boundary = pending.indexOf("\n\n");
          }
        }
        pending += decoder.decode();
        if (pending.trim()) {
          const { texts } = extractDeltas(pending);
          for (const content of texts) send(JSON.stringify({ content }));
        }
        send("[DONE]");
        controller.close();
      } catch {
        try {
          send(
            JSON.stringify({
              error:
                "OpenRouter could not complete the reply. Please try again.",
            }),
          );
        } catch {
          // Controller already closed; nothing left to send.
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Already released.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
};

export const config = {
  path: "/api/assistant/chat",
  method: "POST",
};
