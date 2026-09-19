/**
 * Sanitizes unescaped comparison operators and symbols inside JSX text nodes.
 *
 * In JSX, '<' introduces a tag or fragment. If an LLM writes text like:
 *   <span className="text-rose-700">En deçà de la moyenne (< 10)</span>
 *   <p>Revue (<= 12) ou élevé (> 16)</p>
 * Babel and esbuild fail with fatal syntax errors: "Unexpected token" / "Expected identifier".
 *
 * This sanitizer tracks JSX nesting (between JSX tags, outside of JavaScript expressions '{...}')
 * while strictly ignoring TypeScript generics (e.g. useState<Todo[]>, Array<string>, Promise<void>)
 * and JavaScript comparisons (e.g. todos.length > 0, score < 10).
 */
export function sanitizeJsxEntities(content: string): string {
  if (typeof content !== 'string' || (!content.includes('<') && !content.includes('>'))) {
    return content;
  }

  let result = '';
  let i = 0;
  const n = content.length;
  let jsxDepth = 0;
  let jsxExprDepth = 0;
  let inJsxTag = false;
  let inSelfClosingTag = false;

  while (i < n) {
    const char = content[i];
    const nextChar = i + 1 < n ? content[i + 1] : '';

    // 1. Line comment
    if (char === '/' && nextChar === '/') {
      const eol = content.indexOf('\n', i);
      const end = eol === -1 ? n : eol;
      result += content.slice(i, end);
      i = end;
      continue;
    }

    // 2. Block comment
    if (char === '/' && nextChar === '*') {
      const end = content.indexOf('*/', i + 2);
      const close = end === -1 ? n : end + 2;
      result += content.slice(i, close);
      i = close;
      continue;
    }

    // 3. String literals
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let j = i + 1;
      let escaped = false;
      while (j < n) {
        if (!escaped && content[j] === quote) {
          j++;
          break;
        }
        escaped = !escaped && content[j] === '\\';
        j++;
      }
      result += content.slice(i, j);
      i = j;
      continue;
    }

    // 4. Expression containers inside JSX: { ... }
    if (jsxDepth > 0) {
      if (char === '{' && !inJsxTag) {
        jsxExprDepth++;
        result += char;
        i++;
        continue;
      }
      if (char === '}' && !inJsxTag && jsxExprDepth > 0) {
        jsxExprDepth--;
        result += char;
        i++;
        continue;
      }
    }

    // 5. Check for '<'
    if (char === '<') {
      const isClosingTag = nextChar === '/';
      const isFragment = nextChar === '>';
      const isIdentifier = /^[a-zA-Z_$]/.test(nextChar);

      if (isClosingTag) {
        inJsxTag = true;
        inSelfClosingTag = false;
        if (jsxDepth > 0) {
          jsxDepth--;
        }
        result += char;
        i++;
        continue;
      }

      if (isFragment) {
        inJsxTag = true;
        inSelfClosingTag = false;
        result += char;
        i++;
        continue;
      }

      if (isIdentifier) {
        // Distinguish JSX opening tags from TypeScript generics & function calls
        const prevChar = i > 0 ? content[i - 1] : '';
        const isPrecededByIdentifier = /[a-zA-Z0-9_$.]/.test(prevChar);

        const closeBracket = content.indexOf('>', i);
        const tagSlice = closeBracket !== -1 ? content.slice(i + 1, closeBracket) : '';

        // A JSX tag often has attributes (=), quotes (", '), or self-closing slash (/>).
        // Or it starts with a known HTML/SVG tag name or PascalCase component.
        const hasJsxAttributes = /[="'/]/.test(tagSlice);
        const isStandardHtmlTag =
          /^(?:div|span|p|button|input|a|h[1-6]|ul|ol|li|form|label|table|tr|td|th|tbody|thead|select|option|textarea|section|article|header|footer|nav|main|aside|svg|path|img)\b/i.test(
            tagSlice.trim(),
          );
        const isPascalCaseComponent = /^[A-Z][a-zA-Z0-9_$.]*(\s|>|\/|$)/.test(tagSlice.trim());

        // In TSX, a JSX opening tag is never preceded directly by an identifier.
        // A TypeScript generic (e.g. `useState<T>`, `Map<K, V>`) is always preceded by an identifier.
        const isTsGeneric = isPrecededByIdentifier && !hasJsxAttributes && !isStandardHtmlTag && !isPascalCaseComponent;

        if (!isTsGeneric) {
          inJsxTag = true;
          inSelfClosingTag = false;
          result += char;
          i++;
          continue;
        }
      }

      // If we are inside JSX text (jsxDepth > 0 && jsxExprDepth === 0 && !inJsxTag)
      if (jsxDepth > 0 && jsxExprDepth === 0 && !inJsxTag) {
        // Ensure this '<' is not a JS comparison expression (which would have an identifier/operand before it)
        const prevText = result.trimEnd();
        const hasLeftOperand = /[a-zA-Z0-9_$.\]\)]$/.test(prevText);

        if (!hasLeftOperand) {
          const remainder = content.slice(i);
          const match = remainder.match(/^<(=?)\s*([0-9]+)/);
          if (match) {
            const isLte = match[1] === '=';
            const num = match[2];
            result += (isLte ? '&le; ' : '&lt; ') + num;
            i += match[0].length;
            continue;
          }
          const matchSymbol = remainder.match(/^<\s+([^a-zA-Z_$<\s{])/);
          if (matchSymbol) {
            result += '&lt; ' + matchSymbol[1];
            i += matchSymbol[0].length;
            continue;
          }
        }
      }

      result += char;
      i++;
      continue;
    }

    // Check if tag is self-closing: "/>"
    if (char === '/' && nextChar === '>' && inJsxTag) {
      inSelfClosingTag = true;
      result += '/>';
      i += 2;
      inJsxTag = false;
      continue;
    }

    // Tag closes with ">"
    if (char === '>') {
      const prevText = result.trimEnd();
      const endsWithOpenTag = /<[a-zA-Z0-9_$.-]+(?:\s+[^>]*)?$/.test(result);
      const endsWithAttribute = /["'=]$/.test(prevText);

      if (inJsxTag || endsWithOpenTag || endsWithAttribute) {
        inJsxTag = false;
        if (!inSelfClosingTag) {
          jsxDepth++;
        }
        inSelfClosingTag = false;
        result += char;
        i++;
        continue;
      }

      if (jsxDepth > 0 && jsxExprDepth === 0) {
        // Only sanitize '>' inside JSX text when NOT preceded by an identifier / expression operand
        // e.g. "élevé (> 16)" is sanitized, but "todos.length > 0" or "count > 5" is NEVER touched
        const hasLeftOperand = /[a-zA-Z0-9_$.\]\)]$/.test(prevText);

        if (!hasLeftOperand) {
          const remainder = content.slice(i);
          const match = remainder.match(/^>(=?)\s*([0-9]+)/);
          if (match) {
            const isGte = match[1] === '=';
            const num = match[2];
            result += (isGte ? '&ge; ' : '&gt; ') + num;
            i += match[0].length;
            continue;
          }
        }
      }

      result += char;
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}
