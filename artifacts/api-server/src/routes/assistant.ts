import { Router, type IRouter, type Response } from "express";
import {
  isOpenRouterConfigured,
  OpenRouterApiError,
  streamOpenRouterReply,
} from "../services/openrouter";

const router: IRouter = Router();

function systemInstruction(personality: string, developerMode: boolean) {
  const base =
    "You are a thoughtful personal assistant. Always reply in Bangla (Bengali) language unless the user explicitly requests another language. Be clear, practical, and concise. Never claim to have performed an external action. Ask before risky changes or external actions.";
  const developer =
    "The user may ask for help developing their Personal AI Assistant. Understand the instructions, propose a clear plan, write and organize code when asked, preserve working behavior, explain normal bugs and fixes, and ask approval before risky changes, permissions, authentication, API keys, account connections, data deletion, or external actions. Never change security or access permissions without explicit approval.";
  const custom = personality.trim().slice(0, 1000);
  return [base, developerMode ? developer : "", custom].filter(Boolean).join("\n\n");
}

function missingKeyResponse(res: Response) {
  res.status(503).json({
    code: "AI_NOT_CONFIGURED",
    error: "Add OPENROUTER_API_KEY to Replit Secrets to connect to OpenRouter.",
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown assistant error";
}

router.post("/assistant/chat", async (req, res) => {
  const { message, personality = "", developerMode = false } = req.body ?? {};
  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > 4000 ||
    typeof personality !== "string" ||
    typeof developerMode !== "boolean"
  ) {
    res.status(400).json({ error: "Invalid assistant message." });
    return;
  }

  if (!isOpenRouterConfigured()) {
    missingKeyResponse(res);
    return;
  }

  try {
    const stream = await streamOpenRouterReply([
        {
          role: "system",
          content: systemInstruction(personality, developerMode),
        },
        { role: "user", content: message.trim() },
      ]);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    for await (const content of stream)
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    req.log.error({ error: errorMessage(error) }, "Assistant chat request failed");
    const rateLimited =
      error instanceof OpenRouterApiError && error.statusCode === 429;
    const errorText = rateLimited
      ? "The free-model request limit has been reached. Please try again later."
      : "OpenRouter could not complete the reply. Please try again.";
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
      res.end();
    } else {
      res
        .status(rateLimited ? 429 : 502)
        .json({
          code: rateLimited ? "OPENROUTER_RATE_LIMIT" : "OPENROUTER_REQUEST_FAILED",
          error: errorText,
        });
    }
  }
});

router.post("/assistant/voice", (_req, res) => {
  res.status(501).json({
    code: "MODEL_AUDIO_UNSUPPORTED",
    error:
      "The selected Nemotron free model accepts text input and returns text only. Voice input and spoken responses are unavailable.",
  });
});

export default router;
