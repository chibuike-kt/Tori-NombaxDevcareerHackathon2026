import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Lightweight regex-based syntax highlighter for docs code blocks.
 * Not a real parser — the docs data model stores plain code/response strings
 * across bash/json/js/php, so hand-tokenizing every example isn't feasible.
 * This gets close enough for the five categories the design calls for.
 */
export const HL = {
  plain: "#B7C4D6",
  keyword: "#C792EA",
  string: "#C3E88D",
  fn: "#82AAFF",
  prop: "#F78C6C",
  comment: "#546E7A",
};

const KEYWORDS = [
  "const", "let", "var", "function", "return", "await", "async", "if", "else",
  "new", "class", "extends", "public", "private", "protected", "static",
  "use", "match", "foreach", "as", "echo", "import", "from", "export",
  "default", "true", "false", "null",
];

function commentPattern(lang?: string): string {
  if (lang === "json") return "(?!)"; // JSON has no comments — never matches
  if (lang === "bash") return "#[^\\n]*";
  return "//[^\\n]*";
}

// bash and json have no object-literal syntax — "unquoted key" and "dot
// property access" heuristics would otherwise misfire on bare URLs like
// curl https://api.tori.ng/v1/plans, coloring "https" and domain segments
// as if they were object properties.
function isPropAware(lang?: string): boolean {
  return lang !== "bash" && lang !== "json";
}

function buildRegex(lang?: string): RegExp {
  const comment = commentPattern(lang);
  const string = `'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|\`(?:[^\`\\\\]|\\\\.)*\``;
  const keyword = `\\b(?:${KEYWORDS.join("|")})\\b`;
  const fn = `[A-Za-z_$][\\w$]*(?=\\()`;

  const parts = [`(?<comment>${comment})`, `(?<string>${string})`, `(?<keyword>${keyword})`, `(?<fn>${fn})`];

  if (isPropAware(lang)) {
    const dotProp = `(?<=\\.)[A-Za-z_$][\\w$]*`;
    // Bare identifier key, e.g. `method:` — quoted keys are matched by the
    // string pattern above instead, same as the landing page's hand-authored
    // code block colors quoted object keys as strings, not properties.
    const unquotedKey = `[A-Za-z_$][\\w$]*(?=\\s*:(?!:))`;
    parts.push(`(?<dotprop>${dotProp})`, `(?<unqkey>${unquotedKey})`);
  }

  return new RegExp(parts.join("|"), "g");
}

/** Tokenizes one line of code into colored spans. `lineKey` must be unique per line. */
export function highlightLine(line: string, lang: string | undefined, lineKey: string): ReactNode {
  const regex = buildRegex(lang);
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;

  for (const match of line.matchAll(regex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      nodes.push(createElement("span", { key: `${lineKey}-p${i++}`, style: { color: HL.plain } }, line.slice(lastIndex, idx)));
    }
    const groups = match.groups ?? {};
    let color = HL.plain;
    if (groups.comment) color = HL.comment;
    else if (groups.unqkey) color = HL.prop;
    else if (groups.string) color = HL.string;
    else if (groups.keyword) color = HL.keyword;
    else if (groups.fn) color = HL.fn;
    else if (groups.dotprop) color = HL.prop;
    nodes.push(createElement("span", { key: `${lineKey}-t${i++}`, style: { color } }, match[0]));
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < line.length) {
    nodes.push(createElement("span", { key: `${lineKey}-p${i++}`, style: { color: HL.plain } }, line.slice(lastIndex)));
  }
  return createElement(Fragment, null, ...nodes);
}
