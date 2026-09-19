import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from './constants';
import bundledTemplates from './bundledTemplates.json';

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced developer who helps people choose the best starter template for their projects.
IMPORTANT: Vite is preferred
IMPORTANT: Only choose shadcn templates if the user explicitly asks for shadcn.
IMPORTANT: For any project that involves a database, data persistence, collections, authentication, user accounts, or full-stack CRUD features, ALWAYS choose "Vite React" because it is the primary template pre-configured with the PocketBase SDK and platform database integration.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project}</title>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>Vite React</templateName>
  <title>Simple React todo application</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>script to generate numbers from 1 to 100</title>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, always recommend the blank template
2. For more complex projects, recommend templates from the provided list
3. Follow the exact XML format
4. Consider both technical requirements and tags
5. If no perfect match exists, recommend the closest option
6. Valid template names: ${templates.map((t) => t.name).join(', ')}, blank

Important: Provide only the selection tags in your response, no additional text.
MOST IMPORTANT: YOU DONT HAVE TIME TO THINK JUST START RESPONDING BASED ON HUNCH 
`;

const templates: Template[] = STARTER_TEMPLATES.filter((t) => !t.name.includes('shadcn'));

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

    if (!templateNameMatch) {
      return null;
    }

    return { template: templateNameMatch[1].trim(), title: titleMatch?.[1].trim() || 'Untitled Project' };
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;
  try {
    const requestBody = {
      message,
      model,
      provider,
      system: starterTemplateSelectionPrompt(templates),
    };
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const respJson: { text: string } = await response.json();
    console.log(respJson);

    const { text } = respJson;
    const selectedTemplate = text ? parseSelectedTemplate(text) : null;

    if (selectedTemplate) {
      return selectedTemplate;
    }
  } catch (err) {
    console.warn('Error during template selection call:', err);
  }

  // Fallback to Vite React default template for web/app requests
  return {
    template: 'Vite React',
    title: 'New Project',
  };
};

const getGitHubRepoContent = async (repoName: string): Promise<{ name: string; path: string; content: string }[]> => {
  // 1. Instant local offline template loading (bypasses GitHub rate limits completely)
  const bundled = (bundledTemplates as Record<string, any[]>)[repoName];
  if (bundled && bundled.length > 0) {
    return normalizePocketBaseTemplate(bundled);
  }

  try {
    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const files = (await response.json()) as any;
    return normalizePocketBaseTemplate(files);
  } catch (error) {
    console.warn('Error fetching release contents, falling back to bundled Vite React template:', error);
    const fallback = (bundledTemplates as Record<string, any[]>)['xKevIsDev/bolt-vite-react-ts-template'];
    if (fallback && fallback.length > 0) {
      return normalizePocketBaseTemplate(fallback);
    }
    throw error;
  }
};

/** Use the live client for bundled and remote templates. */
function normalizePocketBaseTemplate(files: any[]) {
  const client = bundledTemplates['xKevIsDev/bolt-vite-react-ts-template'].find(
    (file) => file.path === 'src/lib/pocketbase.ts',
  )!;
  const hasClient = files.some((file) => file.path === client.path);
  const normalized = files.map((file) => (file.path === client.path ? { ...file, content: client.content } : file));
  if (!hasClient) {
    normalized.push(client);
  }
  return normalized;
}

export async function getTemplates(templateName: string, title?: string) {
  const cleaned = (templateName || '').trim().toLowerCase();

  // Try exact match, label match, or hyphenated match
  let template = STARTER_TEMPLATES.find(
    (t) =>
      t.name.toLowerCase() === cleaned ||
      t.label.toLowerCase() === cleaned ||
      t.name.toLowerCase().replace(/\s+/g, '-') === cleaned,
  );

  // Match common aliases from LLM outputs
  if (!template) {
    if (
      cleaned.includes('react') ||
      cleaned.includes('basic') ||
      cleaned.includes('vite') ||
      cleaned.includes('todo') ||
      cleaned.includes('database') ||
      cleaned.includes('pocketbase') ||
      cleaned.includes('backend') ||
      cleaned.includes('crud') ||
      cleaned.includes('fullstack')
    ) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'Vite React');
    } else if (cleaned.includes('astro')) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'Basic Astro');
    } else if (cleaned.includes('next')) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'NextJS Shadcn');
    } else if (cleaned.includes('remix')) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'Remix Typescript');
    } else if (cleaned.includes('svelte')) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'Sveltekit');
    } else if (cleaned.includes('expo') || cleaned.includes('mobile')) {
      template = STARTER_TEMPLATES.find((t) => t.name === 'Expo App');
    }
  }

  // Default to Vite React if template was not recognized and not explicitly 'blank'
  if (!template && cleaned !== 'blank') {
    template = STARTER_TEMPLATES.find((t) => t.name === 'Vite React');
  }

  if (!template) {
    return null;
  }

  const githubRepo = template.githubRepo;
  const files = await getGitHubRepoContent(githubRepo);

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  // exclude lock files to prevent context bloat
  const commonLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  filteredFiles = filteredFiles.filter((x) => commonLockFiles.includes(x.name) === false);

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  // Set project-specific title in index.html instead of generic "Vite + React"
  if (title) {
    filesToImport.files = filesToImport.files.map((file) => {
      if (file.path === 'index.html' && typeof file.content === 'string') {
        const updated = file.content.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
        return { ...file, content: updated };
      }
      return file;
    });
  }

  const assistantMessage = `
PocketApp is initializing your project with the required files using the ${template.name} template.
<boltArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
<boltAction type="shell">
npm install
</boltAction>
<boltAction type="start">
npm run dev
</boltAction>
</boltArtifact>
`;
  let userMessage = ``;
  const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
  }

  userMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request

IMPORTANT: Finish writing all files first. Only if dependencies changed, emit a separate shell action for \`npm install\`. Put a single start action for \`npm run dev\` last. Never combine install and dev in one shell action.
`;

  return {
    assistantMessage,
    userMessage,
  };
}
