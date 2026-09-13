import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import { normalizeTutorMarkdown } from "./utils";

/** Shared readable rendering for tutor answers and question context. */
export default function TutorMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
      components={{
        table: ({ children }) => (
          // A scrollable region must be keyboard focusable to expose wide tables.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className="table-wrapper" role="region" aria-label="Solution table" tabIndex={0}>
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {normalizeTutorMarkdown(content)}
    </ReactMarkdown>
  );
}
