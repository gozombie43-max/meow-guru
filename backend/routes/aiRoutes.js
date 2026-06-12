// backend/routes/aiRoutes.js
import express from "express";
import { chatComplete, chatCompleteMessages, chatJSON } from "../ai/azureClient.js";

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
  const { context, message, history } = req.body;

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
- Never mix multiple math blocks on one line like \`$...$ $...$\`; use one \`$$...$$\` block per equation line.
- Do not put raw LaTeX outside \`$...$\` or \`$$...$$\`.
- For trigonometry, write functions as LaTeX commands: \`\\sin\\theta\`, \`\\cos\\theta\`, \`\\tan^2\\theta\`.
- Put long trigonometry expressions in a single display block, for example \`$$\\frac{1-\\cos^2\\theta}{1-\\sin^2\\theta}=\\tan^2\\theta$$\`.
- For multiple ratios, use separate lines or an aligned block; do not chain more than two ratios in one line.
- Use a final line starting with **Answer:** for the final answer.
- Use **bold** for key values, formulas, and final result.
- Avoid dense paragraphs and avoid using long dash-separated lines.
- Keep answers under 180 words unless the student asks for more detail.
- Use the recent conversation to understand follow-up questions and references like "this", "same", "above", or "explain again".
- Never repeat the full question back unnecessarily.
- If asked for practice, create a similar exam-style MCQ with options and answer.
- If a chart, comparison table, or diagram would make the explanation clearer, add exactly one fenced JSON block after the text using this format:
\`\`\`ssc-visual
{"type":"table","title":"Short title","headers":["Column 1","Column 2"],"rows":[["A","B"],["C","D"]]}
\`\`\`
or
\`\`\`ssc-visual
{"type":"chart","chartType":"bar","title":"Short title","labels":["A","B"],"values":[10,20],"unit":"%"}
\`\`\`
or
\`\`\`ssc-visual
{"type":"diagram","title":"Short title","diagram":{"scale":40,"width":280,"height":220,"shapes":[{"type":"right_triangle","vertices":{"A":{"x":4,"y":3},"B":{"x":0,"y":0},"C":{"x":4,"y":0}},"right_angle_at":"C","labels":{"AB":"5","BC":"4","CA":"3"}}]}}
\`\`\`
- For diagram JSON, use the existing geometry schema only: triangle, right_triangle, circle, line, angle, axis, rectangle, polygon.
- Do not put visual JSON inside ordinary markdown code blocks. Use only \`\`\`ssc-visual fences for visual JSON.
- Never create raw markdown pipe tables like \`| Name | Marks |\`. For any table, always use the \`\`\`ssc-visual table JSON format.`;

  const safeHistory = Array.isArray(history)
    ? history
        .filter((item) => {
          return (
            item &&
            (item.role === "user" || item.role === "bot" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim()
          );
        })
        .slice(-16)
        .map((item) => ({
          role: item.role === "user" ? "user" : "assistant",
          content: item.content.trim().slice(0, 4000),
        }))
    : [];

  const chatMessages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Study context for this chat:
${String(context).slice(0, 4000)}

Use this as background for the conversation. Reply only when the student asks a question.`,
    },
    {
      role: "assistant",
      content: "Understood. I will use this study context and the recent conversation for follow-up questions.",
    },
    ...safeHistory,
    {
      role: "user",
      content: `Student question:
${String(message).trim().slice(0, 4000)}

Return a clean markdown response using the formatting rules.`,
    },
  ];

  try {
    const reply = await chatCompleteMessages(chatMessages, "o4-mini");
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
