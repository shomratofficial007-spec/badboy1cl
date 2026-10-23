// Netlify Function: voice endpoint placeholder.
//
// The selected OpenRouter free model accepts text input and returns text
// only, so server-side voice transcription/synthesis is unavailable —
// same contract as artifacts/api-server/src/routes/assistant.ts.
// Browser dictation and read-aloud run fully client-side via the Web
// Speech API instead (see artifacts/mobile/lib/assistant/voice.ts).

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  return Response.json(
    {
      code: "MODEL_AUDIO_UNSUPPORTED",
      error:
        "The selected Nemotron free model accepts text input and returns text only. Voice input and spoken responses are unavailable.",
    },
    { status: 501 },
  );
};

export const config = {
  path: "/api/assistant/voice",
  method: "POST",
};
