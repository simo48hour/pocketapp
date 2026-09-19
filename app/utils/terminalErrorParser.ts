/**
 * Utilities for cleaning ANSI escape codes and detecting build/runtime errors in terminal output.
 */

export function cleanAnsi(text: string): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    .replace(/\r/g, '');
}

const ERROR_PATTERNS = [
  /\[vite\] Internal server error:/i,
  /Internal server error:/i,
  /\[postcss\]/i,
  /SyntaxError:/i,
  /ReferenceError:/i,
  /TypeError:/i,
  /Failed to compile/i,
  /ERROR in /i,
  /Cannot find module/i,
  /Failed to load PostCSS config/i,
  /Loading PostCSS Plugin failed/i,
  /Unexpected token/i,
  /npm ERR!/i,
  /Uncaught [A-Za-z]+Error:/i,
  /error while updating dependencies/i,
  /\[plugin:vite:[a-z-]+\]/i,
  /Failed to resolve import/i,
  /Could not resolve/i,
  /Unterminated string/i,
  /Parse error/i,
];

export interface ParsedTerminalError {
  hasError: boolean;
  summary: string;
  snippet: string;
}

export function extractErrorFromTerminal(text: string): ParsedTerminalError {
  const clean = cleanAnsi(text);
  const lines = clean.split('\n');

  let errorLineIndex = -1;
  let summary = '';

  // Scan backwards from the end of the buffer to find the most recent error
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(line)) {
        errorLineIndex = i;
        summary = line.trim();
        break;
      }
    }

    if (errorLineIndex !== -1) {
      break;
    }
  }

  if (errorLineIndex === -1) {
    return { hasError: false, summary: '', snippet: '' };
  }

  // Capture context: up to 3 lines before the error and up to 35 lines after (for file & stack trace)
  const startIdx = Math.max(0, errorLineIndex - 3);
  const endIdx = Math.min(lines.length, errorLineIndex + 35);
  const snippet = lines.slice(startIdx, endIdx).join('\n').trim();

  return {
    hasError: true,
    summary,
    snippet,
  };
}

export function extractTerminalBuffer(terminal: any, maxLines = 80): string {
  try {
    const buffer = terminal?.buffer?.active;

    if (!buffer) {
      return '';
    }

    const lines: string[] = [];
    const totalLines = buffer.length;
    const start = Math.max(0, totalLines - maxLines);

    for (let i = start; i < totalLines; i++) {
      const line = buffer.getLine(i);

      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines.join('\n').trim();
  } catch (err) {
    console.warn('Failed to extract terminal buffer:', err);
    return '';
  }
}
