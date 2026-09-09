import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';
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
  return sharp(buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
}

async function prepareImageForVision(buffer) {
  const output = await sharp(buffer, { limitInputPixels: 40000000 })
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
    worker = await createWorker("eng", 1, { langPath: fileURLToPath(new URL("../", import.meta.url)), gzip: false, cachePath: tmpdir() });
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

export async function extractAttachmentContext(attachment) {
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
