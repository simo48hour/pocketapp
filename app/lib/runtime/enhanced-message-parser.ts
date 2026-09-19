import { createScopedLogger } from '~/utils/logger';
import { StreamingMessageParser, type StreamingMessageParserOptions } from './message-parser';
import { isShellCommand } from './shell-command-detector';

const logger = createScopedLogger('EnhancedMessageParser');

/**
 * Enhanced message parser that detects code blocks and file patterns
 * even when AI models don't wrap them in proper artifact tags.
 * Fixes issues where code outputs to chat instead of files.
 */
export class EnhancedStreamingMessageParser extends StreamingMessageParser {
  private _processedCodeBlocks = new Map<string, Set<string>>();
  private _artifactCounter = 0;

  constructor(options: StreamingMessageParserOptions = {}) {
    super(options);
  }

  parse(messageId: string, input: string): string {
    // 1. Clean or wrap leaked raw code occurring outside/after </boltArtifact>
    let enhancedInput = this._handleLeakedCodeOutsideArtifact(input);

    // 2. Detect code blocks and wrap them in artifact actions
    enhancedInput = this._detectAndWrapCodeBlocks(messageId, enhancedInput);

    if (enhancedInput !== input) {
      this.reset();
      return super.parse(messageId, enhancedInput);
    }

    return super.parse(messageId, input);
  }

  private _handleLeakedCodeOutsideArtifact(input: string): string {
    const closeArtifactIdx = input.lastIndexOf('</boltArtifact>');
    if (closeArtifactIdx === -1) {
      return input;
    }

    const afterArtifact = input.slice(closeArtifactIdx + '</boltArtifact>'.length);
    const rawCodeMatch = afterArtifact.match(/(?:^|\n)\s*(import\s+[\s\S]*?from\s+['"][^'"]+['"][\s\S]*)/);
    if (!rawCodeMatch) {
      return input;
    }

    const rawCode = rawCodeMatch[1].trim();
    if (!rawCode.includes(';') && !rawCode.includes('export') && !rawCode.includes('function')) {
      return input;
    }

    const isApp = /(?:function|const|export\s+default\s+function)\s+App\b/.test(rawCode);
    const filePath = isApp ? 'src/App.tsx' : this._inferFileNameFromContent(rawCode, 'tsx');

    // If input already defined this file in an action, the raw code after artifact is a duplicate leak: strip it!
    if (input.includes(`filePath="${filePath}"`)) {
      return input.slice(0, closeArtifactIdx + '</boltArtifact>'.length) + afterArtifact.replace(rawCode, '').trimEnd();
    }

    // Otherwise wrap it into an artifact action so it writes to the file instead of leaking into chat
    const artifactId = `leaked-auto-${Date.now()}`;
    const wrapped = `\n<boltArtifact id="${artifactId}" title="${filePath.split('/').pop()}" type="bundled">\n<boltAction type="file" filePath="${filePath}">\n${rawCode}\n</boltAction>\n</boltArtifact>`;
    return input.slice(0, closeArtifactIdx + '</boltArtifact>'.length) + wrapped;
  }

  private _detectAndWrapCodeBlocks(messageId: string, input: string): string {
    if (!this._processedCodeBlocks.has(messageId)) {
      this._processedCodeBlocks.set(messageId, new Set());
    }

    const processed = this._processedCodeBlocks.get(messageId)!;
    let enhanced = input;

    // Detect shell commands first
    enhanced = this._detectAndWrapShellCommands(messageId, enhanced, processed);

    const patterns = [
      // Pattern 1: File path followed by code block
      {
        regex: /(?:^|\n)([\/\w\-\.]+\.\w+):?\s*\n+```(\w*)\n([\s\S]*?)```/gim,
        type: 'file_path',
      },

      // Pattern 2: Explicit file creation mentions
      {
        regex:
          /(?:create|update|modify|edit|write|add|generate|here'?s?|file:?)\s+(?:a\s+)?(?:new\s+)?(?:file\s+)?(?:called\s+)?[`'"]*([\/\w\-\.]+\.\w+)[`'"]*:?\s*\n+```(\w*)\n([\s\S]*?)```/gi,
        type: 'explicit_create',
      },

      // Pattern 3: Code blocks with filename comments
      {
        regex: /```(\w*)\n(?:\/\/|#|<!--)\s*(?:file:?|filename:?)\s*([\/\w\-\.]+\.\w+).*?\n([\s\S]*?)```/gi,
        type: 'comment_filename',
      },

      // Pattern 4: Code block with "in <filename>" context
      {
        regex: /(?:in|for|update)\s+[`'"]*([\/\w\-\.]+\.\w+)[`'"]*:?\s*\n+```(\w*)\n([\s\S]*?)```/gi,
        type: 'in_filename',
      },

      // Pattern 5: Structured / component files (App, Components, Hooks, package.json)
      {
        regex:
          /```(?:json|jsx?|tsx?|javascript|typescript|html?|vue|svelte|css)\n([\s\S]*?)```/gi,
        type: 'structured_file',
      },
    ];

    for (const pattern of patterns) {
      enhanced = enhanced.replace(pattern.regex, (match, ...args) => {
        const blockHash = this._hashBlock(match);
        if (processed.has(blockHash)) {
          return match;
        }

        let filePath: string;
        let language: string;
        let content: string;

        if (pattern.type === 'comment_filename') {
          [language, filePath, content] = args;
        } else if (pattern.type === 'structured_file') {
          content = args[0];
          const matchIndex = enhanced.indexOf(match);
          const beforeContext = matchIndex !== -1 ? enhanced.substring(Math.max(0, matchIndex - 150), matchIndex) : '';

          if (/example\s+of\s+usage|just\s+an\s+example|usage\s+example/i.test(beforeContext + content.slice(0, 100))) {
            return match;
          }

          const hasImports = /import\s+[\s\S]*?from\s+['"][^'"]+['"]/.test(content);
          const hasExportedComponent = /export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w*|use[A-Z]\w*)/.test(content);
          const isPackageJson = content.includes('"name"') && (content.includes('"dependencies"') || content.includes('"devDependencies"'));

          if (!hasImports && !hasExportedComponent && !isPackageJson) {
            return match;
          }

          language = match.match(/^```(\w*)/)?.[1] || 'tsx';
          filePath = this._inferFileNameFromContent(content, language);
        } else {
          [filePath, language, content] = args;
        }

        if (isShellCommand(content, language)) {
          processed.add(blockHash);
          logger.debug('Auto-wrapped code block as shell command instead of file');
          return this._wrapInShellAction(content, messageId);
        }

        filePath = this._normalizeFilePath(filePath);

        if (!this._isValidFilePath(filePath)) {
          return match;
        }

        if (!this._hasFileContext(enhanced, match)) {
          const isExplicitFilePattern =
            pattern.type === 'explicit_create' ||
            pattern.type === 'comment_filename' ||
            pattern.type === 'file_path' ||
            pattern.type === 'structured_file';

          if (!isExplicitFilePattern) {
            return match;
          }
        }

        processed.add(blockHash);
        const artifactId = `artifact-${messageId}-${this._artifactCounter++}`;
        const wrapped = this._wrapInArtifact(artifactId, filePath, content);
        logger.debug(`Auto-wrapped code block as file: ${filePath}`);

        return wrapped;
      });
    }

    // Detect standalone file operations without code blocks
    const fileOperationPattern =
      /(?:create|write|save|generate)\s+(?:a\s+)?(?:new\s+)?file\s+(?:at\s+)?[`'"]*([\/\w\-\.]+\.\w+)[`'"]*\s+with\s+(?:the\s+)?(?:following\s+)?content:?\s*\n([\s\S]+?)(?=\n\n|\n(?:create|write|save|generate|now|next|then|finally)|$)/gi;

    enhanced = enhanced.replace(fileOperationPattern, (match, filePath, content) => {
      const blockHash = this._hashBlock(match);
      if (processed.has(blockHash)) {
        return match;
      }

      filePath = this._normalizeFilePath(filePath);
      if (!this._isValidFilePath(filePath)) {
        return match;
      }

      processed.add(blockHash);
      const artifactId = `artifact-${messageId}-${this._artifactCounter++}`;
      content = content.trim();

      const wrapped = this._wrapInArtifact(artifactId, filePath, content);
      logger.debug(`Auto-wrapped file operation: ${filePath}`);

      return wrapped;
    });

    return enhanced;
  }

  private _wrapInArtifact(artifactId: string, filePath: string, content: string): string {
    const title = filePath.split('/').pop() || 'File';

    return `<boltArtifact id="${artifactId}" title="${title}" type="bundled">
<boltAction type="file" filePath="${filePath}">
${content}
</boltAction>
</boltArtifact>`;
  }

  private _wrapInShellAction(content: string, messageId: string): string {
    const artifactId = `artifact-${messageId}-${this._artifactCounter++}`;

    return `<boltArtifact id="${artifactId}" title="Shell Command" type="shell">
<boltAction type="shell">
${content.trim()}
</boltAction>
</boltArtifact>`;
  }

  private _normalizeFilePath(filePath: string): string {
    filePath = filePath.replace(/[`'"]/g, '').trim();
    filePath = filePath.replace(/\\/g, '/');

    if (filePath.startsWith('./')) {
      filePath = filePath.substring(2);
    }

    if (!filePath.startsWith('/') && !filePath.startsWith('.')) {
      filePath = '/' + filePath;
    }

    return filePath;
  }

  private _isValidFilePath(filePath: string): boolean {
    const hasExtension = /\.\w+$/.test(filePath);
    if (!hasExtension) {
      return false;
    }

    const isValid = /^[\/\w\-\.]+$/.test(filePath);
    if (!isValid) {
      return false;
    }

    const excludePatterns = [
      /^\/?(tmp|temp|test|example)\//i,
      /\.(tmp|temp|bak|backup|old|orig)$/i,
      /^\/?(output|result|response)\//i,
      /^code_\d+\.(sh|bash|zsh)$/i,
      /^(untitled|new|demo|sample)\d*\./i,
    ];

    for (const pattern of excludePatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    return true;
  }

  private _hasFileContext(input: string, codeBlockMatch: string): boolean {
    const matchIndex = input.indexOf(codeBlockMatch);
    if (matchIndex === -1) {
      return false;
    }

    const beforeContext = input.substring(Math.max(0, matchIndex - 200), matchIndex);
    const afterContext = input.substring(matchIndex + codeBlockMatch.length, matchIndex + codeBlockMatch.length + 100);

    if (/\b(example\s+of\s+usage|just\s+an\s+example|usage\s+example)\b/i.test(beforeContext + codeBlockMatch)) {
      return false;
    }

    const fileContextPatterns = [
      /\b(create|write|save|add|update|modify|edit|generate)\s+(a\s+)?(new\s+)?file/i,
      /\b(file|filename|filepath)\s*[:=]/i,
      /\b(in|to|as)\s+[`'"]?[\w\-\.\/]+\.[a-z]{2,4}[`'"]?/i,
      /\b(component|module|class|function)\s+\w+/i,
    ];

    const contextText = beforeContext + afterContext;
    return fileContextPatterns.some((pattern) => pattern.test(contextText));
  }

  private _inferFileNameFromContent(content: string, language: string): string {
    if (content.includes('"name"') && (content.includes('"dependencies"') || content.includes('"devDependencies"'))) {
      return '/package.json';
    }

    if (/(?:function|const|export\s+default\s+function)\s+App\b/.test(content)) {
      const ext = language.includes('ts') ? 'tsx' : 'jsx';
      return `/src/App.${ext}`;
    }

    const hookMatch = content.match(/(?:function|const|export\s+function)\s+(use[A-Z]\w*)/);
    if (hookMatch) {
      const ext = language.includes('ts') ? 'ts' : 'js';
      return `/src/hooks/${hookMatch[1]}.${ext}`;
    }

    const componentMatch = content.match(
      /(?:function|class|const|export\s+default\s+function|export\s+function)\s+([A-Z]\w*)/,
    );

    if (componentMatch) {
      const name = componentMatch[1];
      const ext = language === 'jsx' ? '.jsx' : language === 'tsx' ? '.tsx' : '.js';
      return `/src/components/${name}${ext}`;
    }

    if (language === 'css' || content.includes('@tailwind')) {
      return '/src/index.css';
    }

    const ext = language === 'jsx' ? '.jsx' : language === 'tsx' ? '.tsx' : '.js';
    return `/src/components/Component-${Date.now()}${ext}`;
  }

  private _hashBlock(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private _detectAndWrapShellCommands(_messageId: string, input: string, processed: Set<string>): string {
    const shellCommandPattern = /```(bash|sh|shell|zsh|fish|powershell|ps1)\n([\s\S]*?)```/gi;

    return input.replace(shellCommandPattern, (match, language, content) => {
      const blockHash = this._hashBlock(match);
      if (processed.has(blockHash)) {
        return match;
      }

      if (isShellCommand(content, language)) {
        processed.add(blockHash);
        logger.debug(`Auto-wrapped shell code block as command: ${language}`);
        return this._wrapInShellAction(content, _messageId);
      }

      return match;
    });
  }

  reset() {
    super.reset();
    this._processedCodeBlocks.clear();
    this._artifactCounter = 0;
  }
}
