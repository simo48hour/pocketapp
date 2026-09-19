import templates from './bundledTemplates.json';

export const projectDatabaseClient = templates['xKevIsDev/bolt-vite-react-ts-template'].find(
  (file) => file.path === 'src/lib/pocketbase.ts',
)!.content;

/** Upgrade only recognizable platform starters and client setups, preserving custom clients. */
export function repairLegacyPocketBaseClient(filePath: string, content: string): string {
  const isPbFile = /(^|\/)src\/(?:.*\/)?(?:pocketbase|pb)\.[jt]sx?$/.test(filePath);
  const importsPocketBase = /(?:import\s+.*?from\s+['"]pocketbase['"]|require\(['"]pocketbase['"]\))/.test(content);

  if (!isPbFile && !importsPocketBase) {
    return content;
  }

  const legacyStarter =
    content.includes('const STORAGE_PREFIX = "pocketapp_pb_"') &&
    content.includes('const originalSend = pb.send.bind(pb)') &&
    content.includes('function getStorageItems(');

  if (legacyStarter) return projectDatabaseClient;

  if (content.includes('pocketapp-platform-routing')) return patchPreviewDatabaseBaseUrl(content);

  // Generated clients can keep custom SDK settings, but must honor preview routing.
  const hasPbInstance =
    /export\s+(?:const|let|var)\s+pb\b/.test(content) ||
    /export\s+default\s+pb\b/.test(content) ||
    /export\s*\{\s*pb\b/.test(content) ||
    /(?:const|let|var)\s+pb\s*=\s*new\s+PocketBase/.test(content) ||
    /\bpb\s*=\s*new\s+PocketBase/.test(content) ||
    /new\s+PocketBase\s*\(/.test(content);

  if (!hasPbInstance) return content;

  return content + '\n' + previewRouting;
}

/** Ensure the first SDK request is routed correctly; changing baseURL after
 * construction is too late because hooks can fetch immediately on mount. */
function patchPreviewDatabaseBaseUrl(content: string): string {
  if (
    !content.includes('function getBaseUrl') ||
    (content.includes('pocketapp_db') && content.includes('getBaseUrl'))
  ) {
    return content;
  }

  return content.replace(
    /return import\.meta\.env\.VITE_PB_URL \|\| window\.location\.origin/,
    "const params = new URLSearchParams(window.location.search);\n  const projectId = params.get('pocketapp_db');\n  const origin = params.get('pocketapp_origin');\n  if (projectId && origin) return new URL(origin).origin + '/api/project-db/' + encodeURIComponent(projectId) + '/data';\n  return import.meta.env.VITE_PB_URL || window.location.origin",
  );
}

const previewRouting = `
// pocketapp-platform-routing: supplied by the platform, without management credentials.
if (typeof window !== 'undefined') {
  const applyPocketAppRouting = (projectId, origin) => {
    if (!projectId || !origin) return;
    try {
      sessionStorage.setItem('pocketapp_db', projectId);
      sessionStorage.setItem('pocketapp_origin', origin);
    } catch {}
    const targetUrl = new URL(origin).origin + '/api/project-db/' + encodeURIComponent(projectId) + '/data';
    if (typeof pb !== 'undefined' && pb) {
      pb.baseURL = targetUrl;
    }
  };

  try {
    const params = new URLSearchParams(window.location.search);
    const qDb = params.get('pocketapp_db');
    const qOrigin = params.get('pocketapp_origin');
    const projectId = qDb || sessionStorage.getItem('pocketapp_db');
    const origin = qOrigin || sessionStorage.getItem('pocketapp_origin');
    if (projectId && origin) {
      applyPocketAppRouting(projectId, origin);
    }
  } catch {}

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'pocketapp_db_config' && event.data.projectId && event.data.origin) {
      applyPocketAppRouting(event.data.projectId, event.data.origin);
    }
  });
}
`;
