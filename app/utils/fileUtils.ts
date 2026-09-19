import ignore from 'ignore';
import { cleanEscapedTags, sanitizeJsxCode } from '~/lib/runtime/message-parser-utils';
import { sanitizeJsxEntities } from './jsxSanitizer';

// Common patterns to ignore, similar to .gitignore
export const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
];

export const MAX_FILES = 1000;
export const ig = ignore().add(IGNORE_PATTERNS);

export const generateId = () => Math.random().toString(36).substring(2, 15);

export const isBinaryFile = async (file: File): Promise<boolean> => {
  const chunkSize = 1024;
  const buffer = new Uint8Array(await file.slice(0, chunkSize).arrayBuffer());

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return true;
    }
  }

  return false;
};

export const shouldIncludeFile = (path: string): boolean => {
  return !ig.ignores(path);
};

const readPackageJson = async (files: File[]): Promise<{ scripts?: Record<string, string> } | null> => {
  const packageJsonFile = files.find((f) => f.webkitRelativePath.endsWith('package.json'));

  if (!packageJsonFile) {
    return null;
  }

  try {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(packageJsonFile);
    });

    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading package.json:', error);
    return null;
  }
};

export const detectProjectType = async (
  files: File[],
): Promise<{ type: string; setupCommand: string; followupMessage: string }> => {
  const hasFile = (name: string) => files.some((f) => f.webkitRelativePath.endsWith(name));

  if (hasFile('package.json')) {
    const packageJson = await readPackageJson(files);
    const scripts = packageJson?.scripts || {};

    // Check for preferred commands in priority order
    const preferredCommands = ['dev', 'start', 'preview'];
    const availableCommand = preferredCommands.find((cmd) => scripts[cmd]);

    if (availableCommand) {
      return {
        type: 'Node.js',
        setupCommand: `npm install && npm run ${availableCommand}`,
        followupMessage: `Found "${availableCommand}" script in package.json. Running "npm run ${availableCommand}" after installation.`,
      };
    }

    return {
      type: 'Node.js',
      setupCommand: 'npm install',
      followupMessage:
        'Would you like me to inspect package.json to determine the available scripts for running this project?',
    };
  }

  if (hasFile('index.html')) {
    return {
      type: 'Static',
      setupCommand: 'npx --yes serve',
      followupMessage: '',
    };
  }

  return { type: '', setupCommand: '', followupMessage: '' };
};

export const filesToArtifacts = (files: { [path: string]: { content: string } }, id: string): string => {
  return `
<boltArtifact id="${id}" title="User Updated Files">
${Object.keys(files)
  .map(
    (filePath) => `
<boltAction type="file" filePath="${filePath}">
${files[filePath].content}
</boltAction>
`,
  )
  .join('\n')}
</boltArtifact>
  `;
};

export function ensureBaseDependencies(packageJsonContent: string): string {
  try {
    const pkg = JSON.parse(packageJsonContent);
    pkg.dependencies = pkg.dependencies || {};
    pkg.devDependencies = pkg.devDependencies || {};
    let modified = false;

    const baseDependencies: Record<string, string> = {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      pocketbase: '^0.21.5',
      'lucide-react': '^0.485.0',
      clsx: '^2.1.1',
      'tailwind-merge': '^2.5.4',
    };

    for (const [name, version] of Object.entries(baseDependencies)) {
      if (!pkg.dependencies[name]) {
        pkg.dependencies[name] = version;
        modified = true;
      }
    }

    if (
      !pkg.dependencies['lucide-react'] ||
      pkg.dependencies['lucide-react'].startsWith('^0.3') ||
      pkg.dependencies['lucide-react'].startsWith('0.3')
    ) {
      pkg.dependencies['lucide-react'] = '^0.485.0';
      modified = true;
    }
    if (!pkg.devDependencies.tailwindcss && !pkg.dependencies.tailwindcss) {
      pkg.devDependencies.tailwindcss = '^3.4.1';
      modified = true;
    }
    if (!pkg.devDependencies.postcss && !pkg.dependencies.postcss) {
      pkg.devDependencies.postcss = '^8.4.35';
      modified = true;
    }
    if (!pkg.devDependencies.autoprefixer && !pkg.dependencies.autoprefixer) {
      pkg.devDependencies.autoprefixer = '^10.4.18';
      modified = true;
    }

    return modified ? JSON.stringify(pkg, null, 2) : packageJsonContent;
  } catch {
    return packageJsonContent;
  }
}

/**
 * Ensures code files (TSX, JSX, TS, JS) importing newly-named icons from lucide-react
 * (e.g. CircleHelp, CircleAlert) remain backwards-compatible even if an older cached
 * version of lucide-react is resolved.
 */
export function sanitizeCodeImports(filePath: string, content: string): string {
  if (typeof content !== 'string') return content;
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    if (content.includes('lucide-react')) {
      return content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g, (_match, imports) => {
        const renames: Record<string, string> = {
          CircleHelp: 'HelpCircle',
          CircleAlert: 'AlertCircle',
          CircleCheck: 'CheckCircle',
          CircleX: 'XCircle',
          CirclePlus: 'PlusCircle',
          CircleMinus: 'MinusCircle',
          CircleInfo: 'InfoCircle',
          CircleDot: 'Dot',
        };
        const parts = imports.split(',').map((part: string) => {
          const trimmed = part.trim();
          if (!trimmed) return part;
          if (/\bas\b/.test(trimmed)) return part;
          for (const [modern, legacy] of Object.entries(renames)) {
            if (trimmed === modern) {
              return part.replace(new RegExp(`\\b${modern}\\b`), `${legacy} as ${modern}`);
            }
          }
          return part;
        });
        return `import {${parts.join(',')}} from 'lucide-react'`;
      });
    }
  }
  return content;
}

/** Remove presentation wrappers and repair JSX syntax corruptions before saving files to disk. */
export function sanitizeGeneratedSource(filePath: string, content: string): string {
  if (!/\.(tsx?|jsx?)$/i.test(filePath) || typeof content !== 'string') {
    return content;
  }

  content = cleanEscapedTags(content);

  const leakedArtifact = content.search(/<\/?bolt(?:Action|Artifact)\b/i);
  if (leakedArtifact >= 0) {
    content = content.slice(0, leakedArtifact).trimEnd();
  }

  const sourceWrapper = content.match(/^\s*<source(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/source>\s*$/i);
  if (sourceWrapper) {
    content = sourceWrapper[1];
  }

  if (/<\/source\s*>/i.test(content) && !/<(?:audio|video)\b/i.test(content)) {
    content = content.replace(/<\/?source(?:\s[^>]*)?>/gi, '');
  }

  content = content.replace(/^\s*```(?:tsx?|jsx?|javascript|typescript)?\s*\n/i, '').replace(/\n\s*```\s*$/i, '');

  if (/\.[jt]sx$/i.test(filePath)) {
    content = sanitizeJsxCode(content, filePath);
    content = sanitizeJsxEntities(content);
    content = sanitizeJsxCode(content, filePath);
  }

  return content;
}

const STRICT_WATCH_BLOCK = `  server: {
    watch: {
      usePolling: false,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**',
        '**/pb_data/**',
      ],
    },
    hmr: {
      overlay: false,
    },
  },`;

function injectServerWatchConfig(content: string): string {
  if (content.includes('pb_data') && content.includes('usePolling')) {
    return content;
  }

  // If there's an existing server block
  if (/server\s*:\s*\{/.test(content)) {
    if (/watch\s*:\s*\{[^}]*\}/s.test(content)) {
      content = content.replace(
        /watch\s*:\s*\{[^}]*\}/s,
        `watch: {
        usePolling: false,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.cache/**',
          '**/pb_data/**',
        ],
      }`,
      );
    } else {
      content = content.replace(
        /(server\s*:\s*\{)/,
        `$1\n    watch: {
      usePolling: false,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**',
        '**/pb_data/**',
      ],
    },
    hmr: { overlay: false },`,
      );
    }
    return content;
  }

  // If no server block exists, inject inside defineConfig({ or export default {
  if (content.includes('defineConfig({')) {
    return content.replace('defineConfig({', `defineConfig({\n${STRICT_WATCH_BLOCK}`);
  }
  if (content.includes('export default {')) {
    return content.replace('export default {', `export default {\n${STRICT_WATCH_BLOCK}`);
  }

  return content;
}

/**
 * Ensures vite.config.ts / js does not exclude lucide-react, and enforces strict
 * file watcher exclusions (node_modules, pb_data, .cache) to protect tab memory.
 */
export function sanitizeViteConfig(filePath: string, content: string): string {
  if (typeof content !== 'string') return content;
  if (/vite\.config\.(ts|js|mjs|cjs)$/i.test(filePath) || (content.includes('defineConfig') && content.includes('optimizeDeps'))) {
    let result = content
      .replace(/exclude:\s*\[['"]lucide-react['"]\]/g, "include: ['lucide-react', 'pocketbase', 'clsx', 'tailwind-merge']")
      .replace(/exclude:\s*\[([^\]]*['"]lucide-react['"][^\]]*)\]/g, (_match, inner) => {
        const cleaned = inner.replace(/['"]lucide-react['"],?\s*/g, '').trim();
        return cleaned ? `exclude: [${cleaned}], include: ['lucide-react', 'pocketbase', 'clsx', 'tailwind-merge']` : `include: ['lucide-react', 'pocketbase', 'clsx', 'tailwind-merge']`;
      });

    return injectServerWatchConfig(result);
  }
  return content;
}

