import OpenAI from "openai";

const directApiKey = process.env.OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const integrationApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (
  !directApiKey &&
  !(integrationBaseUrl && integrationApiKey)
) {
  throw new Error(
    "Set OPENAI_API_KEY in Replit Secrets to use OpenAI directly, or configure the Replit OpenAI integration.",
  );
}

export const openai = new OpenAI({
  apiKey: directApiKey ?? integrationApiKey!,
  ...(directApiKey
    ? process.env.OPENAI_API_BASE_URL
      ? { baseURL: process.env.OPENAI_API_BASE_URL }
      : {}
    : { baseURL: integrationBaseUrl }),
});
