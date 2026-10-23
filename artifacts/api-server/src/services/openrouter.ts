export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODEL_ID = "nvidia/nemotron-3.5-lightning:free";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class OpenRouterApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super("OpenRouter request failed.");
    this.name = "OpenRouterApiError";
    this.statusCode = statusCode;
  }
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function streamOpenRouterReply(
  messages: OpenRouterMessage[],
): Promise<AsyncIterable<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new OpenRouterApiError(503);

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Personal AI Assistant",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_ID,
      max_tokens: 8192,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) throw new OpenRouterApiError(response.status);
  if (!response.body) throw new OpenRouterApiError(502);

  return readOpenRouterStream(response.body);
}

async function* readOpenRouterStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  const parseEvent = (event: string) => {
    const content: string[] = [];
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
        if (typeof delta === "string" && delta.length > 0) content.push(delta);
      } catch {
        // Ignore malformed individual events; the stream may still continue.
      }
    }
    return { content, done };
  };

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
        const parsed = parseEvent(event);
        for (const item of parsed.content) yield item;
        if (parsed.done) return;
        boundary = pending.indexOf("\n\n");
      }
    }

    pending += decoder.decode();
    if (pending.trim()) {
      const parsed = parseEvent(pending);
      for (const item of parsed.content) yield item;
    }
  } finally {
    reader.releaseLock();
  }
}
