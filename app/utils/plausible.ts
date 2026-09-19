import { pb } from '~/lib/auth/pocketbase';

export interface AppStackDetection {
  isFullStack: boolean;
  framework: string;
  backendType: string;
  databaseType: string;
  hasDatabaseSchema: boolean;
  hasAuth: boolean;
  filesCount: number;
}

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

/**
 * Resolves current user tier safely without circular dependencies.
 */
export function getUserTier(): 'pro' | 'free' | 'guest' {
  if (typeof window === 'undefined') return 'guest';
  try {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return 'guest';
    }
    const model = pb.authStore.model as any;
    if (model.subscription_status === 'active') {
      return 'pro';
    }
    return 'free';
  } catch {
    return 'guest';
  }
}

/**
 * Detects whether a project is a Full-Stack Web App and inspects its tech stack.
 */
export function detectAppStack(files: Record<string, any> | undefined | null): AppStackDetection {
  if (!files || typeof files !== 'object') {
    return {
      isFullStack: false,
      framework: 'Unknown',
      backendType: 'None',
      databaseType: 'None',
      hasDatabaseSchema: false,
      hasAuth: false,
      filesCount: 0,
    };
  }

  const paths = Object.keys(files);
  const filesCount = paths.filter((p) => files[p]?.type === 'file').length;

  let hasPbSchema = false;
  let hasPbCode = false;
  let hasSupabase = false;
  let hasServerFiles = false;
  let hasExpressOrHono = false;
  let hasAuth = false;
  let detectedFramework = 'Unknown';

  // Read package.json if available
  let packageJsonStr = '';
  for (const [p, dirent] of Object.entries(files)) {
    if (p.endsWith('package.json') && dirent?.content) {
      packageJsonStr = typeof dirent.content === 'string' ? dirent.content : '';
      break;
    }
  }

  let pkgDependencies: Record<string, string> = {};
  if (packageJsonStr) {
    try {
      const parsed = JSON.parse(packageJsonStr);
      pkgDependencies = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
    } catch {}
  }

  // Check dependencies for frameworks & backend tools
  if (pkgDependencies['next']) detectedFramework = 'Next.js';
  else if (pkgDependencies['@remix-run/react'] || pkgDependencies['remix']) detectedFramework = 'Remix';
  else if (pkgDependencies['astro']) detectedFramework = 'Astro';
  else if (pkgDependencies['vue']) detectedFramework = 'Vue';
  else if (pkgDependencies['svelte']) detectedFramework = 'Svelte';
  else if (pkgDependencies['react']) detectedFramework = 'React';

  if (pkgDependencies['pocketbase']) hasPbCode = true;
  if (pkgDependencies['@supabase/supabase-js']) hasSupabase = true;
  if (pkgDependencies['express'] || pkgDependencies['hono'] || pkgDependencies['fastify']) hasExpressOrHono = true;

  // Scan file paths and file contents
  for (const [filePath, entry] of Object.entries(files)) {
    const cleanPath = filePath.toLowerCase();
    const content = typeof entry?.content === 'string' ? entry.content : '';

    if (cleanPath.endsWith('pb_schema.json') || cleanPath.includes('pb_migrations')) {
      hasPbSchema = true;
      hasPbCode = true;
    }

    if (cleanPath.includes('server/') || cleanPath.includes('api/') || cleanPath.endsWith('server.js') || cleanPath.endsWith('server.ts')) {
      hasServerFiles = true;
    }

    if (!hasPbCode && (content.includes('pocketbase') || content.includes('pb.collection'))) {
      hasPbCode = true;
    }

    if (!hasSupabase && (content.includes('@supabase') || content.includes('createClient('))) {
      hasSupabase = true;
    }

    if (!hasAuth && (content.includes('authStore') || content.includes('login') || content.includes('signUp') || content.includes('users'))) {
      hasAuth = true;
    }

    // Fallback framework detection by file extensions
    if (detectedFramework === 'Unknown') {
      if (cleanPath.endsWith('.vue')) detectedFramework = 'Vue';
      else if (cleanPath.endsWith('.svelte')) detectedFramework = 'Svelte';
      else if (cleanPath.endsWith('.tsx') || cleanPath.endsWith('.jsx')) detectedFramework = 'React';
      else if (cleanPath.endsWith('.html')) detectedFramework = 'Vanilla HTML';
    }
  }

  // Determine backend and database
  let backendType = 'None';
  let databaseType = 'None';

  if (hasPbCode || hasPbSchema) {
    backendType = 'PocketBase';
    databaseType = 'PocketBase (SQLite)';
  } else if (hasSupabase) {
    backendType = 'Supabase';
    databaseType = 'Supabase (PostgreSQL)';
  } else if (hasExpressOrHono || hasServerFiles) {
    backendType = 'Node/Express/Hono';
    databaseType = 'SQLite/Custom';
  }

  const isFullStack = hasPbCode || hasPbSchema || hasSupabase || hasServerFiles || hasExpressOrHono;

  return {
    isFullStack,
    framework: detectedFramework === 'Unknown' ? 'React' : detectedFramework,
    backendType,
    databaseType,
    hasDatabaseSchema: hasPbSchema,
    hasAuth,
    filesCount,
  };
}

/**
 * Core event tracking function dispatching to Plausible Analytics.
 */
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === 'undefined') return;

  const cleanProps: Record<string, string | number | boolean> = {};
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') {
        cleanProps[key] = value.slice(0, 300);
      } else {
        cleanProps[key] = value;
      }
    }
  }

  try {
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: cleanProps });
    } else {
      const q = ((window as any).plausible = (window as any).plausible || function () {
        ((window as any).plausible.q = (window as any).plausible.q || []).push(arguments);
      });
      q(eventName, { props: cleanProps });
    }
  } catch (err) {
    console.warn('[Plausible] Failed to send event:', err);
  }

  if (
    process.env.NODE_ENV !== 'production' ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('debug_plausible') === 'true')
  ) {
    console.log(`[Plausible] 📊 ${eventName}`, cleanProps);
  }
}

/**
 * Tracks AI app generation completion and flags Full-Stack apps.
 */
export function trackAppGenerated(params: {
  files: Record<string, any>;
  model: string;
  provider: string;
  userTier?: string;
  isFirstGeneration?: boolean;
}) {
  const tier = params.userTier || getUserTier();
  const stack = detectAppStack(params.files);

  const eventProps = {
    is_fullstack: stack.isFullStack,
    framework: stack.framework,
    backend_type: stack.backendType,
    database_type: stack.databaseType,
    has_database_schema: stack.hasDatabaseSchema,
    has_auth: stack.hasAuth,
    files_count: stack.filesCount,
    model: params.model,
    provider: params.provider,
    user_tier: tier,
    is_first_generation: params.isFirstGeneration ?? false,
  };

  // 1. Always track general app generated event
  trackEvent('App Generated', eventProps);

  // 2. High-priority dedicated event when user created a Full-Stack Web App
  if (stack.isFullStack) {
    trackEvent('Full-Stack App Created', eventProps);
  }
}

/**
 * Tracks prompt submission by users.
 */
export function trackPromptSubmitted(params: {
  model: string;
  provider: string;
  prompt: string;
  chatMode?: string;
  isFirstPrompt: boolean;
  template?: string;
  userTier?: string;
}) {
  const tier = params.userTier || getUserTier();
  const len = params.prompt?.trim().length || 0;
  const lengthBracket = len < 50 ? '<50' : len < 200 ? '50-200' : len < 500 ? '200-500' : '500+';

  trackEvent('Prompt Submitted', {
    model: params.model,
    provider: params.provider,
    chat_mode: params.chatMode || 'build',
    is_first_prompt: params.isFirstPrompt,
    prompt_length: lengthBracket,
    has_template: Boolean(params.template && params.template !== 'blank'),
    template_name: params.template || 'blank',
    user_tier: tier,
  });
}

/**
 * Tracks when an app is published live to *.pocketapp.dev.
 */
export function trackAppPublished(params: {
  subdomain: string;
  url: string;
  files?: Record<string, any>;
  userTier?: string;
}) {
  const tier = params.userTier || getUserTier();
  const stack = detectAppStack(params.files);

  trackEvent('App Published', {
    subdomain: params.subdomain,
    is_fullstack: stack.isFullStack,
    framework: stack.framework,
    backend_type: stack.backendType,
    database_type: stack.databaseType,
    user_tier: tier,
  });
}

/**
 * Tracks app export (full-stack zip, standard zip).
 */
export function trackAppExported(params: {
  exportType: 'fullstack_zip' | 'zip';
  files?: Record<string, any>;
  userTier?: string;
}) {
  const tier = params.userTier || getUserTier();
  const stack = detectAppStack(params.files);

  trackEvent('App Exported', {
    export_type: params.exportType,
    is_fullstack: stack.isFullStack,
    framework: stack.framework,
    backend_type: stack.backendType,
    user_tier: tier,
    files_count: stack.filesCount,
  });
}

/**
 * Tracks paywall modal impressions.
 */
export function trackPaywallViewed(params?: { trigger?: string; userTier?: string }) {
  const tier = params?.userTier || getUserTier();
  trackEvent('Paywall Viewed', {
    trigger: params?.trigger || 'direct',
    user_tier: tier,
  });
}

/**
 * Tracks checkout initiation.
 */
export function trackCheckoutInitiated(params?: { plan?: string; price?: string; userTier?: string }) {
  const tier = params?.userTier || getUserTier();
  trackEvent('Checkout Initiated', {
    plan: params?.plan || 'Community',
    price: params?.price || 'free',
    user_tier: tier,
  });
}

/**
 * Tracks customer portal opened by pro subscribers.
 */
export function trackCustomerPortalOpened(params?: { userTier?: string }) {
  const tier = params?.userTier || getUserTier();
  trackEvent('Customer Portal Opened', {
    user_tier: tier,
  });
}

/**
 * Tracks custom domain connection requests.
 */
export function trackCustomDomainRequested(params: { domain: string; userTier?: string }) {
  const tier = params.userTier || getUserTier();
  trackEvent('Custom Domain Requested', {
    domain: params.domain,
    user_tier: tier,
  });
}

/**
 * Tracks user authentication events (sign-in and sign-up).
 */
export function trackAuthEvent(
  action: 'sign_in' | 'sign_up',
  params: { method: 'password' | 'google' | 'github' | 'google_one_tap' }
) {
  const eventName = action === 'sign_up' ? 'User Signed Up' : 'User Signed In';
  trackEvent(eventName, {
    method: params.method,
  });
}

/**
 * Tracks template selection on homepage.
 */
export function trackTemplateSelected(templateName: string) {
  trackEvent('Template Selected', {
    template_name: templateName,
    user_tier: getUserTier(),
  });
}

/**
 * Tracks terminal error auto-fix requests.
 */
export function trackTerminalErrorAutoFix() {
  trackEvent('Terminal Error Auto-Fix', {
    user_tier: getUserTier(),
  });
}
