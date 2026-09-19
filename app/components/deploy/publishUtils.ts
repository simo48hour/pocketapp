/**
 * Utilities for publishing, slug generation, title formatting, and celebratory confetti.
 */

// Generate human-friendly random slugs
export const generateRandomSlug = (): string => {
  const adjectives = ['zen', 'swift', 'hyper', 'pulse', 'spark', 'nova', 'flow', 'apex', 'vivid', 'cosmic'];
  const nouns = ['app', 'stack', 'craft', 'forge', 'nexus', 'pocket', 'hub', 'wave', 'base', 'pilot'];
  const num = Math.floor(10 + Math.random() * 90);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}-${num}`;
};

// Converts a slug like "swift-nexus-42" into "Swift Nexus 42"
export const formatSlugToTitle = (slug?: string): string => {
  if (!slug) return 'PocketApp';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Determines the most appropriate project title
export const resolveProjectTitle = (options: {
  slug?: string;
  description?: string;
  firstArtifactTitle?: string;
}): string => {
  const { slug, description, firstArtifactTitle } = options;

  if (firstArtifactTitle && firstArtifactTitle.trim() && !firstArtifactTitle.toLowerCase().includes('imported-files')) {
    return firstArtifactTitle.trim();
  }

  if (description && description.trim() && !description.toLowerCase().includes('untitled')) {
    return description.trim();
  }

  return formatSlugToTitle(slug);
};

// Replaces generic "Vite + React" title in HTML content with a meaningful project title
export const sanitizeHtmlTitle = (html: string, projectTitle: string): string => {
  if (!html || !projectTitle) return html;

  const genericTitleRegex = /<title>(?:Vite\s*\+\s*React(?:\s*\+\s*TS)?|Vite\s*App)<\/title>/i;
  if (genericTitleRegex.test(html)) {
    return html.replace(genericTitleRegex, `<title>${projectTitle}</title>`);
  }

  if (!html.includes('<title>')) {
    if (html.includes('</head>')) {
      return html.replace('</head>', `  <title>${projectTitle}</title>\n</head>`);
    }
    return `<title>${projectTitle}</title>\n${html}`;
  }

  return html;
};

// Launch celebration confetti
export const triggerConfetti = async (): Promise<void> => {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default || confettiModule;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#a855f7', '#6366f1', '#ec4899', '#3b82f6'],
    });
  } catch (e) {
    console.warn('Confetti unavailable:', e);
  }
};
