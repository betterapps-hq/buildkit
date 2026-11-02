const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "const",
  "let",
  "await",
  "async",
  "if",
  "return",
  "function",
  "type",
  "new",
  "true",
  "false",
  "null"
])

type TokenKind = "kw" | "str" | "fn" | "type" | "id" | "com" | "punc"
type Token = { text: string; kind: TokenKind }

/** Splits one line of TypeScript into colored runs, matching the design's syntax palette. */
export function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  const pattern = /(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g
  let pending = ""
  for (const match of line.matchAll(pattern)) {
    const [text, comment, string, word, space] = match
    if (space) {
      pending += space
      continue
    }
    let kind: TokenKind
    if (comment) {
      kind = "com"
    } else if (string) {
      kind = "str"
    } else if (word) {
      const next = line[(match.index ?? 0) + text.length]
      if (KEYWORDS.has(word)) {
        kind = "kw"
      } else if (next === "(" || (next === "<" && /^[a-z]/.test(word))) {
        kind = "fn"
      } else {
        kind = /^[A-Z]/.test(word) ? "type" : "id"
      }
    } else {
      kind = "punc"
    }
    const previous = tokens.at(-1)
    if (previous?.kind === kind) {
      previous.text += pending + text
    } else {
      tokens.push({ text: pending + text, kind })
    }
    pending = ""
  }
  if (pending) {
    tokens.push({ text: pending, kind: "punc" })
  }
  return tokens
}

type CodeProps = {
  lines: readonly string[]
  numbered?: boolean
  highlight?: number
  className?: string
  label?: string
}

/** Renders static source as tokenized lines. `highlight` is the one-based line to tint. */
export function Code({ lines, numbered = false, highlight, className, label }: CodeProps) {
  return (
    <pre className={className ? `code ${className}` : "code"} aria-label={label}>
      <code>
        {lines.map((line, index) => (
          <span
            key={index}
            className={index + 1 === highlight ? "code-line is-highlighted" : "code-line"}
            data-line={index + 1}
          >
            {numbered && <span className="code-no">{index + 1}</span>}
            <span className="code-text">
              {tokenize(line).map((token, tokenIndex) => (
                <span key={tokenIndex} className={`tok-${token.kind}`}>
                  {token.text}
                </span>
              ))}
              {line === "" && " "}
            </span>
          </span>
        ))}
      </code>
    </pre>
  )
}
