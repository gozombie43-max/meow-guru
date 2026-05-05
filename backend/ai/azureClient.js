// backend/ai/azureClient.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: "https://quizguru-ai.openai.azure.com/openai/v1",
});

export async function chatComplete(userPrompt, model = "o4-mini", systemPrompt = null) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 8000,
  });

  return response.choices[0].message.content;
}

export async function chatJSON(userPrompt, model = "o4-mini", systemPrompt = null) {
  const sys = (systemPrompt || "") + "\nRespond with valid JSON only. No markdown, no explanation, no code fences.";
  const raw = await chatComplete(userPrompt, model, sys);

  // Clean the response
  let clean = raw.replace(/```json|```/g, "").trim();

  // Find the first [ or { and last ] or }
  const start = clean.search(/[\[{]/);
  const end = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));

  if (start === -1 || end === -1) throw new Error("No JSON found in response");

  clean = clean.slice(start, end + 1);
  return JSON.parse(clean);
}