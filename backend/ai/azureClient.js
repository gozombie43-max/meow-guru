// backend/ai/azureClient.js
import OpenAI from "openai";

const apiKey = process.env.AZURE_OPENAI_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.AZURE_OPENAI_BASE_URL || "https://quizguru-ai.openai.azure.com/openai/v1";

if (!apiKey && process.env.NODE_ENV === "production") {
  console.warn("WARNING: AZURE_OPENAI_KEY is not configured in environment variables.");
}

const client = new OpenAI({
  apiKey: apiKey || "dummy-azure-key",
  baseURL,
});

// Default token limits — keep these tight to control cost.
// o4-mini pricing is per output token; high limits = high bills.
const DEFAULT_MAX_TOKENS = 1500;  // enough for most answers/JSON
const TUTOR_MAX_TOKENS   = 2500;  // tutor chat may need longer responses
const JSON_MAX_TOKENS    = 800;   // structured JSON responses are short

export async function chatComplete(userPrompt, model = "o4-mini", systemPrompt = null, maxTokens = DEFAULT_MAX_TOKENS) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  return chatCompleteMessages(messages, model, maxTokens);
}

export async function chatCompleteMessages(messages, model = "o4-mini", maxTokens = TUTOR_MAX_TOKENS) {
  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: maxTokens,
  });

  return response.choices[0].message.content;
}

export async function chatJSON(userPrompt, model = "o4-mini", systemPrompt = null) {
  const sys = (systemPrompt || "") + "\nRespond with valid JSON only. No markdown, no explanation, no code fences.";
  const raw = await chatComplete(userPrompt, model, sys, JSON_MAX_TOKENS);

  // Clean the response
  let clean = raw.replace(/```json|```/g, "").trim();

  // Find the first [ or { and last ] or }
  const start = clean.search(/[\[{]/);
  const end = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));

  if (start === -1 || end === -1) throw new Error("No JSON found in response");

  clean = clean.slice(start, end + 1);
  return JSON.parse(clean);
}
