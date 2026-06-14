// backend/routes/aiRoutes.js
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { chatComplete, chatCompleteMessages, chatJSON } from "../ai/azureClient.js";

const router = express.Router();

const tutorUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 18 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (allowed) return cb(null, true);
    return cb(new Error("Only image files and PDFs are allowed"));
  },
});

function parseMaybeJSON(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function extractPdfText(file) {
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return String(result.text || "").replace(/\s+\n/g, "\n").trim();
  } finally {
    await parser.destroy();
  }
}

function cleanOcrText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[|]{3,}/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function hasUsefulPdfText(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  const optionLike = /\b(?:A|B|C|D|a|b|c|d)[).]\s*\S/.test(compact);
  const numberRich = (compact.match(/\d/g) || []).length >= 8;
  return compact.length >= 180 || (compact.length >= 80 && (optionLike || numberRich));
}

async function prepareImageForOcr(buffer) {
  return sharp(buffer, { limitInputPixels: false })
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
}

async function prepareImageForVision(buffer) {
  const output = await sharp(buffer, { limitInputPixels: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return {
    type: "image_url",
    image_url: {
      url: `data:image/jpeg;base64,${output.toString("base64")}`,
    },
  };
}

async function recognizeImageText(buffer) {
  let worker;
  try {
    const image = await prepareImageForOcr(buffer);
    worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(image);
    return {
      text: cleanOcrText(result.data?.text),
      confidence: Math.round(Number(result.data?.confidence || 0)),
    };
  } finally {
    if (worker) await worker.terminate();
  }
}

async function renderPdfPagesForOcr(file, firstPages = 4) {
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getScreenshot({
      first: firstPages,
      desiredWidth: 1800,
      imageBuffer: true,
      imageDataUrl: false,
    });

    return result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      buffer: Buffer.from(page.data),
    }));
  } finally {
    await parser.destroy();
  }
}

async function extractAttachmentContext(attachment) {
  const context = {
    text: "",
    imageParts: [],
    source: "",
  };

  if (!attachment) return context;

  if (attachment.mimetype.startsWith("image/")) {
    const [ocr, visionImage] = await Promise.all([
      recognizeImageText(attachment.buffer),
      prepareImageForVision(attachment.buffer),
    ]);

    context.source = "image";
    context.imageParts.push(visionImage);
    context.text = [
      `Attached image: ${attachment.originalname || "question image"}`,
      ocr.text
        ? `OCR text from image (confidence ${ocr.confidence}%):\n${ocr.text}`
        : "OCR could not confidently read text from this image. Use the image itself and ask for clarification if needed.",
    ].join("\n\n");
    return context;
  }

  if (attachment.mimetype === "application/pdf") {
    const directText = await extractPdfText(attachment);
    const lines = [`Attached PDF: ${attachment.originalname || "document.pdf"}`];

    if (hasUsefulPdfText(directText)) {
      lines.push(`Selectable PDF text:\n${directText.slice(0, 12000)}`);
      context.source = "pdf-text";
      context.text = lines.join("\n\n");
      return context;
    }

    const pages = await renderPdfPagesForOcr(attachment);
    const ocrPages = [];

    for (const page of pages) {
      const ocr = await recognizeImageText(page.buffer);
      if (ocr.text) {
        ocrPages.push(`Page ${page.pageNumber} OCR (confidence ${ocr.confidence}%):\n${ocr.text}`);
      }

      if (context.imageParts.length === 0) {
        context.imageParts.push(await prepareImageForVision(page.buffer));
      }
    }

    context.source = "pdf-ocr";
    lines.push(
      directText
        ? `Selectable PDF text was sparse, so OCR was also used.\nSelectable text:\n${directText.slice(0, 3000)}`
        : "No useful selectable PDF text found, so OCR was used on rendered pages."
    );
    lines.push(
      ocrPages.length > 0
        ? `OCR text from PDF pages:\n\n${ocrPages.join("\n\n").slice(0, 12000)}`
        : "OCR could not confidently read this PDF. Ask the student for a clearer screenshot/photo of the page."
    );
    context.text = lines.join("\n\n");
  }

  return context;
}

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
router.post("/tutor-chat", tutorUpload.single("attachment"), async (req, res) => {
  const context = req.body.context;
  const message = req.body.message;
  const history = parseMaybeJSON(req.body.history, []);
  const attachment = req.file;

  if (!context) return res.status(400).json({ error: "context is required" });
  if (!message && !attachment) return res.status(400).json({ error: "message or attachment is required" });

  const systemPrompt = `You are a friendly, expert SSC exam tutor.
Your answer must be structured, easy to scan, and easy for a student to understand.

Formatting rules:
- Use markdown only.
- Start with a short heading: **Approach**, **Steps**, **Shortcut**, or **Practice Question**.
- For explanations, use numbered steps with one idea per step.
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

  let attachmentContext = { text: "", imageParts: [], source: "" };

  if (attachment) {
    try {
      attachmentContext = await extractAttachmentContext(attachment);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `I could not read this attachment. ${err.message || "Try uploading a clearer image or PDF page."}`,
      });
    }
  }

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
