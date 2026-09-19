export const COMMAND_PATTERN_MAP = new Map<string, RegExp>([
  ['npm', /^(npm|yarn|pnpm)\s+(install|run|start|build|dev|test|init|create|add|remove)/],
  ['git', /^(git)\s+(add|commit|push|pull|clone|status|checkout|branch|merge|rebase|init|remote|fetch|log)/],
  ['docker', /^(docker|docker-compose)\s+/],
  ['build', /^(make|cmake|gradle|mvn|cargo|go)\s+/],
  ['network', /^(curl|wget|ping|ssh|scp|rsync)\s+/],
  ['webcontainer', /^(cat|chmod|cp|echo|hostname|kill|ln|ls|mkdir|mv|ps|pwd|rm|rmdir|xxd)\s*/],
  ['webcontainer-extended', /^(alias|cd|clear|env|false|getconf|head|sort|tail|touch|true|uptime|which)\s*/],
  ['interpreters', /^(node|python|python3|java|go|rust|ruby|php|perl)\s+/],
  ['text-processing', /^(grep|sed|awk|cut|tr|sort|uniq|wc|diff)\s+/],
  ['archive', /^(tar|zip|unzip|gzip|gunzip)\s+/],
  ['process', /^(ps|top|htop|kill|killall|jobs|nohup)\s*/],
  ['system', /^(df|du|free|uname|whoami|id|groups|date|uptime)\s*/],
]);

export function isShellCommand(content: string, language: string): boolean {
  const shellLanguages = ['bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'ps1'];
  const isShellLang = shellLanguages.includes(language.toLowerCase());

  if (!isShellLang) {
    return false;
  }

  const trimmedContent = content.trim();
  const lines = trimmedContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return false;
  }

  if (looksLikeScriptContent(trimmedContent)) {
    return false;
  }

  if (lines.length === 1) {
    return isSingleLineCommand(lines[0]);
  }

  return isCommandSequence(lines);
}

export function isSingleLineCommand(line: string): boolean {
  const hasChaining = /[;&|]{1,2}/.test(line);

  if (hasChaining) {
    const parts = line.split(/[;&|]{1,2}/).map((p) => p.trim());
    return parts.every((part) => part.length > 0 && !looksLikeScriptContent(part));
  }

  const prefixPatterns = [
    /^sudo\s+/,
    /^time\s+/,
    /^nohup\s+/,
    /^watch\s+/,
    /^env\s+\w+=\w+\s+/,
  ];

  let cleanLine = line;
  for (const prefix of prefixPatterns) {
    cleanLine = cleanLine.replace(prefix, '');
  }

  for (const [, pattern] of COMMAND_PATTERN_MAP) {
    if (pattern.test(cleanLine)) {
      return true;
    }
  }

  return isSimpleCommand(cleanLine);
}

export function isCommandSequence(lines: string[]): boolean {
  const commandLikeLines = lines.filter(
    (line) =>
      line.length > 0 && !line.startsWith('#') && (isSingleLineCommand(line) || isSimpleCommand(line)),
  );

  return commandLikeLines.length / lines.length > 0.7;
}

export function isSimpleCommand(line: string): boolean {
  const words = line.split(/\s+/);
  if (words.length === 0) {
    return false;
  }

  const firstWord = words[0];

  if (line.includes('=') && !line.startsWith('export ') && !line.startsWith('env ') && !firstWord.includes('=')) {
    return false;
  }

  if (line.includes('function ') || line.match(/^\w+\s*\(\s*\)/)) {
    return false;
  }

  if (/^(if|for|while|case|function|until|select)\s/.test(line)) {
    return false;
  }

  if (line.includes('<<') || line.startsWith('EOF') || line.startsWith('END')) {
    return false;
  }

  if (line.includes('"""') || line.includes("'''")) {
    return false;
  }

  const commandLikePatterns = [
    /^[a-z][a-z0-9-_]*$/i,
    /^\.\/[a-z0-9-_./]+$/i,
    /^\/[a-z0-9-_./]+$/i,
    /^[a-z][a-z0-9-_]*\s+-.+/i,
  ];

  return commandLikePatterns.some((pattern) => pattern.test(firstWord));
}

export function looksLikeScriptContent(content: string): boolean {
  const lines = content.trim().split('\n');

  const scriptIndicators = [
    /^#!/,
    /function\s+\w+/,
    /^\w+\s*\(\s*\)\s*\{/,
    /^(if|for|while|case)\s+.*?(then|do|in)/,
    /^\w+=[^=].*$/,
    /^(local|declare|readonly)\s+/,
    /^(source|\.)\s+/,
    /^(exit|return)\s+\d+/,
  ];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue;
    }

    if (scriptIndicators.some((pattern) => pattern.test(trimmedLine))) {
      return true;
    }
  }

  return false;
}
