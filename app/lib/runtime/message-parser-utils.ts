export interface ElementFactoryProps {
  messageId: string;
  artifactId?: string;
}

export type ElementFactory = (props: ElementFactoryProps) => string;

/**
 * Cleans out markdown fences, leaked tags, and <source> wrappers from action content.
 */
export function cleanoutMarkdownSyntax(content: string): string {
  const leakedArtifact = content.search(/<\/?bolt(?:Action|Artifact)\b/i);
  if (leakedArtifact >= 0) {
    content = content.slice(0, leakedArtifact).trimEnd();
  }

  const codeBlockRegex = /^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/;
  const match = content.match(codeBlockRegex);

  if (match) {
    return match[1];
  }

  // Models occasionally wrap a complete file in an HTML-like <source> block.
  const sourceWrapper = content.match(/^\s*<source(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/source>\s*$/i);
  if (sourceWrapper) {
    return sourceWrapper[1];
  }

  if (/<\/source\s*>/i.test(content) && !/<(?:audio|video)\b/i.test(content)) {
    content = content.replace(/<\/?source(?:\s[^>]*)?>/gi, '');
  }

  return content.replace(/^\s*```(?:tsx?|jsx?|javascript|typescript)?\s*\n/i, '').replace(/\n\s*```\s*$/i, '');
}

/**
 * Smartly unescapes HTML tags (e.g. &lt;div&gt;) while preserving valid JSX/TSX text entities
 * like &lt; 10, &gt; 5, &le;, &ge; which are mandatory in JSX children to prevent parser crashes.
 */
export function cleanEscapedTags(content: string): string {
  return content
    .replace(/&lt;(\/?[a-zA-Z][a-zA-Z0-9_.:-]*)/g, '<$1')
    .replace(/([a-zA-Z0-9_"'`>/])&gt;/g, '$1>');
}

/**
 * Sanitizes and repairs common LLM JSX/TSX syntax corruptions that cause fatal Vite/Babel errors
 * such as: `Unexpected token, expected "jsxTagEnd"`.
 */
export function sanitizeJsxCode(content: string, filePath: string): string {
  if (!filePath || (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx'))) {
    return content;
  }

  // 1. Convert HTML comments inside JSX/TSX to valid JSX comments: <!-- foo --> -> {/* foo */}
  content = content.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

  // 2. Fix opening tags closed with &gt; instead of >: e.g. <span className="..."&gt; -> <span className="...">
  content = content.replace(/(<[a-zA-Z0-9_$.-]+(?:\s+[^>]*?)?)\s*&gt;/g, '$1>');

  // 3. Fix closing tags with trailing slashes: </div/> or </div /> -> </div>
  content = content.replace(/<\/\s*([a-zA-Z0-9_$.-]+)\s*\/\s*>/g, '</$1>');

  // 4. Fix closing tags with accidentally duplicated attributes/props: </div className="..." key={...}> -> </div>
  content = content.replace(/<\/\s*([a-zA-Z0-9_$.-]+)\s+[^>]*>/g, '</$1>');

  // 5. Fix closing tags with trailing semicolons or commas before >: </div;> or </div,> -> </div>
  content = content.replace(/<\/\s*([a-zA-Z0-9_$.-]+)\s*[;,]+\s*>/g, '</$1>');

  // 6. Fix closing tags missing '>' before next sibling tag: e.g. </p        </div> -> </p>\n</div>
  content = content.replace(/<\/\s*([a-zA-Z0-9_$.-]+)\s+(?=<)/g, '</$1>\n');

  // 7. Fix dangling self-closing slash followed by newline and next opening tag:
  // e.g. <input type="text" /\n  <button> -> <input type="text" />\n  <button>
  content = content.replace(/(\s\/)\s*(\r?\n\s*<)/g, ' />$2');

  // 8. Fix leaked continuation restart headers mid-file or at start:
  // e.g. interface PricingSectionfilePath="src/components/PricingSection.tsx">
  const restartMatch = content.match(
    /(?:^|\n)[^\n]*?(?:<boltAction\s+[^>]*>)?(?:\s*type=["']file["'])?\s*filePath=["'][^"']+["']\s*>\s*(\r?\n\s*(?:import\s|export\s)[\s\S]*)$/,
  );
  if (restartMatch) {
    content = restartMatch[1].trimStart();
  } else {
    content = content.replace(
      /([a-zA-Z0-9_$]+)?\s*(?:<boltAction\s+[^>]*>)?(?:\s*type=["']file["'])?\s*filePath=["'][^"']+["']\s*>/g,
      (_match, prefix) => (prefix ? `${prefix} ` : ''),
    );
  }

  // 9. Fix truncated closing tag at EOF (e.g. response cut off at "</div")
  content = content.replace(/<\/\s*([a-zA-Z0-9_$.-]+)\s*$/, '</$1>');

  // 10. Fix truncated self-closing tag at EOF (e.g. response cut off at "<input ... /")
  content = content.replace(/<\s*([a-zA-Z0-9_$.-]+(?:\s+[^>]*)?)\/\s*$/, '<$1 />');

  return content;
}

export function camelToDashCase(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export const createArtifactElement: ElementFactory = (props) => {
  const elementProps = [
    'class="__boltArtifact__"',
    ...Object.entries(props).map(([key, value]) => {
      return `data-${camelToDashCase(key)}=${JSON.stringify(value)}`;
    }),
  ];

  return `<div ${elementProps.join(' ')}></div>`;
};

export function createQuickActionElement(props: Record<string, string>, label: string): string {
  const elementProps = [
    'class="__boltQuickAction__"',
    'data-bolt-quick-action="true"',
    ...Object.entries(props).map(([key, value]) => `data-${camelToDashCase(key)}=${JSON.stringify(value)}`),
  ];

  return `<button ${elementProps.join(' ')}>${label}</button>`;
}

export function createQuickActionGroup(buttons: string[]): string {
  return `<div class="__boltQuickAction__" data-bolt-quick-action="true">${buttons.join('')}</div>`;
}
