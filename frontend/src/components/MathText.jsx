// src/components/MathText.jsx
//
// Renders text that may contain LaTeX math expressions.
// Handles three patterns:
//   $$...$$  → block/display math
//   $...$    → inline math
//   \(...\)  → inline math (alternate)
//   \[...\]  → block math (alternate)
//   Plain text with no delimiters → rendered as-is
//
// Install dependency: npm install katex
// (react-katex is not needed — we use katex directly for full control)
//
// IMPORTANT: import 'katex/dist/katex.min.css' once in your App.jsx or index.css

import React, { useMemo } from "react";

// Lazy-load katex to avoid SSR issues
let katex = null;
async function loadKatex() {
  if (!katex) {
    katex = (await import("katex")).default;
  }
  return katex;
}

// Synchronous render — katex itself is sync once loaded
function renderLatex(latex, displayMode = false) {
  try {
    if (!katex) return null; // will re-render once loaded
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,       // render best-effort even on bad LaTeX
      errorColor: "#f87171",     // red-400 for bad expressions
      trust: false,
      strict: "ignore",
    });
  } catch {
    return null;
  }
}

// Split text into segments: {type: "text"|"inline"|"block", content: string}
function parseSegments(text) {
  const segments = [];
  // Order matters: check $$ before $
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^)]+?\\\))/g;
  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) });
    }
    const raw = match[0];
    const isBlock = raw.startsWith("$$") || raw.startsWith("\\[");
    const inner = raw
      .replace(/^\$\$|\$\$$/g, "")
      .replace(/^\\\[|\\\]$/g, "")
      .replace(/^\$|\$$/g, "")
      .replace(/^\\\(|\\\)$/g, "")
      .trim();
    segments.push({ type: isBlock ? "block" : "inline", content: inner });
    last = match.index + raw.length;
  }

  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) });
  }

  return segments.length ? segments : [{ type: "text", content: text }];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MathText({ text, className = "", hasMath = false }) {
  // If no math flag and no LaTeX delimiters detected, skip parsing entirely
  const hasDelimiters = /\$|\\\(|\\\[/.test(text);

  const segments = useMemo(() => {
    if (!hasMath && !hasDelimiters) return null;
    return parseSegments(text);
  }, [text, hasMath, hasDelimiters]);

  // Plain text fast path
  if (!segments) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.content}</span>;
        }

        const html = renderLatex(seg.content, seg.type === "block");

        if (!html) {
          // KaTeX not yet loaded or parse error — show raw LaTeX in code style
          return (
            <code key={i} className="text-amber-400 bg-slate-800 px-1 rounded text-sm font-mono">
              {seg.content}
            </code>
          );
        }

        if (seg.type === "block") {
          return (
            <span
              key={i}
              className="block my-3 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={i}
            className="inline-block align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

// ─── KaTeX Preloader ──────────────────────────────────────────────────────────
// Call once at app root. Forces katex to load before first math question renders.
export async function preloadKatex() {
  await loadKatex();
}