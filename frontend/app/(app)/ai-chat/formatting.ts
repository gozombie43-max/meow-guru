export type ChatMessage = {
  role: 'bot' | 'user';
  content: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

export const ASSISTANT_CONTEXT = `You are a friendly AI study partner for SSC CGL and CHSL aspirants.
Help with concept clarification, step-by-step solutions, shortcuts, practice questions, and revision notes.
Keep answers extremely concise, structured, and visually organized.
Use bold headings ('### Heading') for distinct sections.
Keep paragraphs under 2 sentences.
For each new step, concept, or distinct idea, ALWAYS use a numbered list ('1., 2., 3.') or bullet points ('- ').
For practice questions, present each question as its own numbered item. Never group multiple practice questions into a single paragraph.
Use markdown for formatting and LaTeX math with $...$ or $$...$$ when needed.
When a chart or geometry diagram would help, add EXACTLY ONE fenced JSON block after the explanation.
CRITICAL RULE: NEVER format your responses as tables. Even if presenting data like synonyms or comparisons, ALWAYS use bulleted or numbered lists instead of tables.

\`\`\`ssc-visual
{"type":"chart","chartType":"bar","title":"Short title","labels":["A","B"],"values":[10,20],"unit":"%"}
\`\`\`
or
\`\`\`ssc-visual
{"type":"diagram","title":"Short title","diagram":{"scale":40,"width":280,"height":220,"shapes":[]}}
\`\`\`
For mensuration diagrams, supported shape types include sphere, hemisphere, cone, cylinder, frustum, and cylinder_with_hemisphere. Use 2D exam-style 3D notation with radius, height, and slant-height labels where useful.
For a cylinder with hemispherical top, use: {"type":"cylinder_with_hemisphere","radius":3,"height":8,"labels":{"radius":"r = 3 cm","height":"cylinder height = 8 cm"}}
Use only these visual types: table, chart, diagram.`;

export function createChatId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getChatTitle(message: string) {
  const cleaned = stripMarkdown(message).replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}...` : cleaned;
}

export function normalizeTutorMarkdown(content: string) {
  const latexCommand =
    /\\(?:frac|dfrac|tfrac|sin|cos|tan|cot|sec|csc|theta|times|div|sqrt|text|Rightarrow|left|right|pi|alpha|beta|gamma|cdot|le|ge|neq|approx|therefore|because|degree|overline|angle|triangle|parallel|perp|infty|sum|prod|log|ln)/;
  const practiceHeadingPattern = /^(?:#{1,6}\s*)?(?:\*\*)?Practice Questions?(?:\*\*)?:?\s*$/i;
  const practicePromptPattern =
    /^(?:solve|find|determine|factorise|factorize|compute|simplify|evaluate|show|prove|add|subtract|calculate|compare|derive)\b/i;

  const cleanLatex = (value: string) =>
    value
      .replace(/\$+\s+\$+/g, ' ')
      .replace(/^\$+|\$+$/g, '')
      .replace(/\$/g, '')
      .replace(/\\operatorname\{([^}]+)\}/g, '\\text{$1}')
      .replace(/\s+/g, ' ')
      .trim();

  const isMathLikeLine = (line: string) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('$$') || trimmed.startsWith('$') || trimmed.startsWith('\\')) return true;
    if (/\\[a-zA-Z]+/.test(trimmed)) return true;
    if (/[=<>]/.test(trimmed)) return true;
    return /^[\d\s()[\]{}.+\-*/^,:]+$/.test(trimmed);
  };

  const isPracticePromptLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (
      /^#{1,6}\s+/.test(trimmed) ||
      /^(\*\*.*\*\*|>|\d+[.)]|\s*[-*+•])\s*/.test(trimmed) ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('$$') ||
      trimmed.startsWith('$') ||
      trimmed.startsWith('\\')
    ) {
      return false;
    }

    return trimmed.endsWith(':') || practicePromptPattern.test(trimmed);
  };

  const normalizeMathLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) return line;
    if (trimmed.startsWith('$$')) return line;
    if (!latexCommand.test(line)) return line;

    const listPrefixMatch = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = listPrefixMatch?.[1] ?? '';
    const body = listPrefixMatch?.[2] ?? line;
    const bodyTrimmed = body.trim();
    const proseProbe = bodyTrimmed
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/[0-9_{}^=+\-*/().,:%\s]/g, '');

    const isRawEquation =
      bodyTrimmed.startsWith('\\') ||
      (/=/.test(bodyTrimmed) && proseProbe.length <= 2);

    if (!isRawEquation) return line;

    const math = cleanLatex(bodyTrimmed);
    return `${prefix}$$${math}$$`;
  };

  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$+\s+\$+/g, ' ')
    .replace(/\$\s*\\displaystyle\s+/g, '$')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$([^$\n]*\\[a-zA-Z][^$\n]*)\$/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(
      /\*\*((?=[^*\n]*\\(?:frac|sin|cos|tan|theta))[^*\n]+)\*\*/g,
      (_, math: string) => `**$${cleanLatex(math)}$**`
    )
    .replace(
      /^\s*\[\s*((?=.*\\[a-zA-Z]+)[^\]\n]+)\s*\]\s*$/gm,
      (_, math: string) => `$$${cleanLatex(math)}$$`
    )
    .split('\n')
    .map(normalizeMathLine)
    .reduce<{ lines: string[]; inPractice: boolean; inPracticeItem: boolean }>(
      (state, line) => {
        const trimmed = line.trim();

        if (practiceHeadingPattern.test(trimmed)) {
          state.inPractice = true;
          state.inPracticeItem = false;
          state.lines.push(line);
          return state;
        }

        if (state.inPractice && /^#{1,6}\s+/.test(trimmed) && !practiceHeadingPattern.test(trimmed)) {
          state.inPractice = false;
          state.inPracticeItem = false;
        }

        if (state.inPractice && /^(\*\*Answer:\*\*|Answer:)/i.test(trimmed)) {
          state.inPractice = false;
          state.inPracticeItem = false;
        }

        if (
          state.inPractice &&
          trimmed &&
          !/^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed) &&
          isPracticePromptLine(line)
        ) {
          state.lines.push(`- ${trimmed}`);
          state.inPracticeItem = true;
          return state;
        }

        if (state.inPractice && state.inPracticeItem && trimmed && isMathLikeLine(trimmed)) {
          state.lines.push(`  ${trimmed}`);
          return state;
        }

        if (state.inPractice && !trimmed) {
          state.lines.push(line);
          return state;
        }

        if (state.inPractice && trimmed && /^(\d+[.)]|\s*[-*+•])\s+/.test(trimmed)) {
          state.inPracticeItem = true;
        }

        state.lines.push(line);
        return state;
      },
      { lines: [], inPractice: false, inPracticeItem: false }
    ).lines.join('\n');
}

function stripMarkdown(value: string) {
  return value
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^#+\s*/g, '')
    .replace(/^>\s*/g, '')
    .replace(/^\s*[-*+]\s+/g, '')
    .trim();
}


export function normalizeSimpleTables(content: string) {
  return content;
}
