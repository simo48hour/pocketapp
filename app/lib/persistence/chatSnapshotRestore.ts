import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer, hydrationPromise } from '~/lib/webcontainer';
import { WORK_DIR } from '~/utils/constants';
import {
  ensureBaseDependencies,
  sanitizeCodeImports,
  sanitizeGeneratedSource,
  sanitizeViteConfig,
} from '~/utils/fileUtils';
import { repairLegacyPocketBaseClient } from '~/utils/projectDatabaseClient';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import type { Message } from 'ai';

let isDevServerStarting = false;

export function extractFilesFromMessages(messages: Message[]): FileMap {
  const files: FileMap = {};
  for (const msg of messages) {
    let contentStr = '';
    if (typeof msg.content === 'string') {
      contentStr = msg.content;
    } else if (Array.isArray((msg as any).content)) {
      contentStr = (msg as any).content.map((p: any) => (p?.type === 'text' ? p.text : '')).join('');
    } else if (Array.isArray((msg as any).parts)) {
      contentStr = (msg as any).parts.map((p: any) => (p?.type === 'text' ? p.text : '')).join('');
    }

    if (contentStr) {
      const actionRegex = /<boltAction\s+[^>]*?filePath="([^"]+)"[^>]*?>([\s\S]*?)<\/boltAction>/g;
      let match;
      while ((match = actionRegex.exec(contentStr)) !== null) {
        const fullTag = match[0];
        if (!fullTag.includes('type="file"')) {
          continue;
        }
        const filePath = match[1].trim();
        const content = match[2];
        const normalizedPath = filePath.startsWith(WORK_DIR) ? filePath : `${WORK_DIR}/${filePath.replace(/^\/+/, '')}`;

        files[normalizedPath] = {
          type: 'file',
          content,
          isBinary: false,
        };
      }
    }
  }
  return files;
}

export async function restoreSnapshotToContainer(snapshot?: Snapshot): Promise<void> {
  const validSnapshot = snapshot || { chatIndex: '', files: {} };

  if (!validSnapshot?.files || Object.keys(validSnapshot.files).length === 0) {
    return;
  }

  // Ensure all file paths are normalized to start with WORK_DIR
  const normalizedFiles: FileMap = {};
  for (const [key, value] of Object.entries(validSnapshot.files)) {
    if (!value) continue;
    const fullPath = key.startsWith(WORK_DIR) ? key : `${WORK_DIR}/${key.replace(/^\/+/, '')}`;
    normalizedFiles[fullPath] = value;
  }
  validSnapshot.files = normalizedFiles;

  // Ensure base dependencies are preserved and modern icon imports remain backwards-compatible
  for (const [key, value] of Object.entries(validSnapshot.files)) {
    if (key.endsWith('package.json') && value?.type === 'file' && typeof value.content === 'string') {
      const updated = ensureBaseDependencies(value.content);
      if (updated !== value.content) {
        validSnapshot.files[key] = {
          ...value,
          content: updated,
        };
      }
    } else if (value?.type === 'file' && typeof value.content === 'string') {
      const sanitized = repairLegacyPocketBaseClient(
        key,
        sanitizeGeneratedSource(key, sanitizeCodeImports(key, sanitizeViteConfig(key, value.content))),
      );
      if (sanitized !== value.content) {
        validSnapshot.files[key] = {
          ...value,
          content: sanitized,
        };
      }
    }
  }

  // 1. Immediately update workbench store and editor documents with ALL latest files
  workbenchStore.files.set(validSnapshot.files);
  workbenchStore.setDocuments(validSnapshot.files);
  workbenchStore.showWorkbench.set(true);

  // Pick primary file (e.g. src/App.tsx) if none selected
  const currentSelected = workbenchStore.selectedFile.get();
  if (!currentSelected || !validSnapshot.files[currentSelected]) {
    const preferredFiles = [
      'src/App.tsx',
      'src/App.jsx',
      'src/main.tsx',
      'src/index.tsx',
      'index.html',
      'package.json',
    ];
    const fileToSelect =
      Object.keys(validSnapshot.files).find((k) => preferredFiles.some((p) => k.endsWith(p))) ||
      Object.keys(validSnapshot.files).find((k) => validSnapshot.files[k]?.type === 'file');

    if (fileToSelect) {
      workbenchStore.setSelectedFile(fileToSelect);
    }
  }

  // 2. Write ALL files to WebContainer filesystem and start dev server asynchronously
  (async () => {
    try {
      const container = await webcontainer;

      const dirs = new Set<string>();
      const files: Array<{ path: string; content: string; isBinary?: boolean }> = [];

      for (const [key, value] of Object.entries(validSnapshot.files)) {
        let filePath = key;
        if (filePath.startsWith(container.workdir)) {
          filePath = filePath.replace(container.workdir, '');
        }
        if (filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }

        if (value?.type === 'folder') {
          dirs.add(filePath);
        } else if (value?.type === 'file') {
          const lastSlash = filePath.lastIndexOf('/');
          if (lastSlash > 0) {
            dirs.add(filePath.substring(0, lastSlash));
          }
          files.push({ path: filePath, content: value.content, isBinary: value.isBinary });
        }
      }

      // Create all directories in parallel
      await Promise.all(
        Array.from(dirs).map((d) => container.fs.mkdir(d, { recursive: true }).catch(() => {})),
      );

      // Write files in parallel batches
      const BATCH_SIZE = 20;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((f) =>
            container.fs
              .writeFile(f.path, f.content, {
                encoding: f.isBinary ? undefined : 'utf8',
              })
              .catch((err) => {
                console.error('Failed to write file during snapshot restore:', f.path, err);
              }),
          ),
        );
      }

      console.log('[Snapshot] All files successfully applied to WebContainer.');

      // 3. Run project dev server cleanly after code is fully applied
      const hasPackageJson = Object.keys(validSnapshot.files).some((f) => f.endsWith('package.json'));
      if (hasPackageJson) {
        if (isDevServerStarting) {
          console.log('[Snapshot] Dev server is already starting or running, skipping duplicate start.');
          return;
        }
        isDevServerStarting = true;

        try {
          const shell = workbenchStore.boltTerminal;
          await Promise.race([
            shell.ready(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Terminal ready timeout')), 10000)),
          ]);

          await Promise.race([
            hydrationPromise,
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]).catch(() => {});

          const previews = workbenchStore.previews.get();
          const isPreviewReady = previews.some((p) => p.ready);

          if (isPreviewReady) {
            console.log('[Snapshot] Dev server preview is already active and ready.');
          } else {
            let hasNodeModules = false;
            try {
              const nodeModulesEntries = await container.fs.readdir('node_modules');
              hasNodeModules = Array.isArray(nodeModulesEntries) && nodeModulesEntries.length > 0;
            } catch {}

            const devCommand = hasNodeModules
              ? 'npm run dev'
              : 'npm install --prefer-offline --no-audit --no-fund && npm run dev';

            console.log(`[Snapshot] Launching dev server with: ${devCommand}`);
            void shell.startCommand('workspace-init', devCommand).catch((termErr) => {
              console.warn('[Snapshot] Dev server command error:', termErr);
            });
          }
        } catch (termErr) {
          console.warn('[Snapshot] Terminal dev server auto-start skipped or timed out:', termErr);
        } finally {
          setTimeout(() => {
            isDevServerStarting = false;
          }, 3000);
        }
      }
    } catch (err) {
      console.warn('[Snapshot] Failed during WebContainer filesystem restoration:', err);
    }
  })();
}
