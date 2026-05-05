// backend/routes/aiRoutes.js
import express from "express";
import { chatComplete, chatJSON } from "../ai/azureClient.js";

const router = express.Router();

// ── 1. Generate Questions ─────────────────────────────
router.post("/generate-questions", async (req, res) => {
  const { topic, difficulty = "medium", count = 5 } = req.body;

  if (!topic) return res.status(400).json({ error: "topic is required" });

  const systemPrompt = `You are an expert SSC CGL and CAT exam question creator.
Always respond with valid JSON only. No markdown, no explanation.`;

  const userPrompt = `Generate ${count} MCQ questions on topic: "${topic}", difficulty: "${difficulty}".
Return a JSON array like this:
[
  {
    "question": "question text here",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": 0,
    "explanation": "why this answer is correct",
    "topic": "${topic}",
    "difficulty": "${difficulty}"
  }
]`;

  try {
    const questions = await chatJSON(userPrompt, "o4-mini", systemPrompt);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. Generate Explanation for a Question ────────────
router.post("/explain", async (req, res) => {
  const { question, correctAnswer, options } = req.body;

  if (!question) return res.status(400).json({ error: "question is required" });

  const userPrompt = `Explain the solution to this SSC/CAT exam question in simple steps.
Question: ${question}
Options: ${options?.join(", ")}
Correct Answer: ${options?.[correctAnswer]}

Give a clear step-by-step explanation. Keep it concise.`;

  try {
    const explanation = await chatComplete(userPrompt, "o4-mini");
    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2b. Tutor chat for submitted quiz questions ───────
router.post("/tutor-chat", async (req, res) => {
  const { context, message } = req.body;

  if (!context) return res.status(400).json({ error: "context is required" });
  if (!message) return res.status(400).json({ error: "message is required" });

  const systemPrompt = `You are a friendly, expert SSC exam tutor.
Your answer must be structured, easy to scan, and easy for a student to understand.

Formatting rules:
- Use markdown only.
- Start with a short heading: **Approach**, **Steps**, **Shortcut**, or **Practice Question**.
- For explanations, use numbered steps with one idea per step.
- Put formulas/equations on separate lines using markdown math syntax: inline \`$...$\` or block \`$$...$$\`.
- Never write LaTeX inside plain square brackets like \`[ \\\\frac{a}{b} ]\`.
- Use a final line starting with **Answer:** for the final answer.
- Use **bold** for key values, formulas, and final result.
- Avoid dense paragraphs and avoid using long dash-separated lines.
- Keep answers under 180 words unless the student asks for more detail.
- Never repeat the full question back unnecessarily.
- If asked for practice, create a similar exam-style MCQ with options and answer.`;

  const userPrompt = `Question context:
${context}

Student question:
${message}

Return a clean markdown response using the formatting rules.`;

  try {
    const reply = await chatComplete(userPrompt, "o4-mini", systemPrompt);
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Tag a Question ─────────────────────────────────
router.post("/tag-question", async (req, res) => {
  const { question } = req.body;

  if (!question) return res.status(400).json({ error: "question is required" });

  const systemPrompt = `You are an expert SSC CGL exam analyst. Return JSON only.`;

  const userPrompt = `Analyze this SSC exam question and return tags.
Question: ${question}
Return JSON:
{
  "subject": "",
  "chapter": "",
  "concept": "",
  "difficulty": "easy|medium|hard",
  "trap_type": "",
  "formula": ""
}`;

  try {
    const tags = await chatJSON(userPrompt, "o4-mini", systemPrompt);
    res.json({ success: true, tags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
