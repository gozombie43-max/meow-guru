import { chatCompleteMessages } from '../ai/azureClient.js';
function isPracticeQuestionHeading(line) {
  return /^(?:#{1,6}\s*)?(?:\*\*)?Practice Questions?(?:\*\*)?:?\s*$/i.test(String(line || "").trim());
}

function isMathLikeLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("$$") || trimmed.startsWith("$") || trimmed.startsWith("\\")) return true;
  if (/\\[a-zA-Z]+/.test(trimmed)) return true;
  if (/[=<>]/.test(trimmed)) return true;
  return /^[\d\s()[\]{}.+\-*/^,:]+$/.test(trimmed);
}

function numberPracticeQuestionPrompts(content) {
  const lines = String(content || "").replace(/\r/g, "\n").split("\n");
  const output = [];
  let inPracticeSection = false;
  let inPracticeItem = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isPracticeQuestionHeading(trimmed)) {
      inPracticeSection = true;
      inPracticeItem = false;
      output.push(line);
      continue;
    }

    if (inPracticeSection && /^#{1,6}\s+/.test(trimmed) && !isPracticeQuestionHeading(trimmed)) {
      inPracticeSection = false;
      inPracticeItem = false;
      output.push(line);
      continue;
    }

    if (inPracticeSection && /^(?:\*\*Answer:\*\*|Answer:)/i.test(trimmed)) {
      inPracticeSection = false;
      inPracticeItem = false;
      output.push(line);
      continue;
    }

    if (
      inPracticeSection &&
      trimmed &&
      !/^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed) &&
      !isMathLikeLine(trimmed)
    ) {
      output.push(`- ${trimmed}`);
      inPracticeItem = true;
      continue;
    }

    if (inPracticeSection && inPracticeItem && trimmed && isMathLikeLine(trimmed)) {
      output.push(`  ${trimmed}`);
      continue;
    }

    if (inPracticeSection && inPracticeItem && !trimmed) {
      output.push(line);
      continue;
    }

    if (inPracticeSection && !trimmed) {
      output.push(line);
      continue;
    }

    if (inPracticeSection && trimmed && /^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed)) {
      inPracticeItem = true;
    }

    output.push(line);
  }

  return output.join("\n");
}

export async function tutorChat({ context, message, history = [] }, attachmentContext = { text: '', imageParts: [], source: '' }) {
  const systemPrompt = `You are a friendly, expert SSC exam tutor.
Your answer must be structured, easy to scan, and easy for a student to understand.

Formatting rules:
- Use markdown only.
- Start with a short heading: **Approach**, **Steps**, **Shortcut**, or **Practice Question**.
- For explanations, use numbered steps with one idea per step.
- For separate step paragraphs, use either numbered items like \`1.\`, \`2.\`, \`3.\` or bullet dots like \`•\`.
- For practice questions, list each question as its own numbered item so they are easy to scan.
- Never write multiple practice questions as plain paragraphs under one heading; every new question prompt must start with a number or bullet.
- When showing a sequence of worked steps, keep each line focused on one idea and separate the next step clearly.
- Put formulas/equations on separate lines using markdown math syntax: inline \`$...$\` or block \`$$...$$\`.  - When displaying tabular data, always use markdown table syntax:
    | Header 1 | Header 2 |
    |----------|----------|
    | value    | value    |- Never write LaTeX inside plain square brackets like \`[ \\\\frac{a}{b} ]\`.
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
- If the student attaches an image or PDF, read the attached question/context first and solve what is visible. If anything is unclear, state the assumption briefly.
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
For mensuration, you may also use:
\`\`\`ssc-visual
{"type":"diagram","title":"Frustum","diagram":{"scale":32,"width":320,"height":240,"shapes":[{"type":"frustum","top_radius":3,"bottom_radius":5,"height":7,"slant_height":7,"labels":{"top_radius":"r = 3 cm","bottom_radius":"R = 5 cm","slant_height":"l = 7 cm"}}]}}
\`\`\`
- For diagram JSON, use the existing geometry schema only: triangle, right_triangle, circle, line, angle, axis, rectangle, polygon, sphere, hemisphere, cone, cylinder, frustum, cylinder_with_hemisphere.
- For sphere/hemisphere/cone/cylinder/frustum/cylinder_with_hemisphere, use 2D exam-style 3D notation with visible radius, height, and slant-height labels where useful.
- For "Cylinder with Hemispherical Top", use shape type cylinder_with_hemisphere, for example: {"type":"cylinder_with_hemisphere","radius":3,"height":8,"labels":{"radius":"r = 3 cm","height":"cylinder height = 8 cm"}}
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

  const userText = `Student question:
${String(message || "Please solve the attached question.").trim().slice(0, 4000)}

${attachmentContext.text}

Return a clean markdown response using the formatting rules.
If OCR text and image context disagree, prefer the visible image/PDF page and mention any unclear text briefly.`;

  const finalUserContent = attachmentContext.imageParts.length > 0
    ? [
        { type: "text", text: userText },
        ...attachmentContext.imageParts,
      ]
    : userText;

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
      content: finalUserContent,
    },
  ];

  const textOnlyChatMessages = finalUserContent === userText
    ? chatMessages
    : chatMessages.map((item, index) =>
        index === chatMessages.length - 1 ? { ...item, content: userText } : item
      );

  try {
    let reply;
    try {
      reply = await chatCompleteMessages(chatMessages, "o4-mini");
    } catch (err) {
      if (finalUserContent === userText) throw err;
      reply = await chatCompleteMessages(textOnlyChatMessages, "o4-mini");
    }
    return { success: true, reply: numberPracticeQuestionPrompts(reply) };
  } catch (err) {
    throw err;
  }
}
