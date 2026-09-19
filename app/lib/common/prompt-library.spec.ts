import { describe, expect, it } from 'vitest';
import { PromptLibrary } from './prompt-library';
import { discussPrompt } from './prompts/discuss-prompt';

describe('PocketBase Mandatory Prompt Enforcement', () => {
  const options = {
    cwd: '/home/project',
    allowedHtmlElements: ['div', 'span', 'p'],
    modificationTagName: 'boltAction',
  };

  it('default prompt enforces PocketBase and forbids alternatives', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('default', options);

    // Mandatory PocketBase directives
    expect(prompt).toContain('POCKETBASE IS THE MANDATORY FIRST-CHOICE DATABASE');
    expect(prompt).toContain('pb_schema.json');
    expect(prompt).toContain("import { pb } from './lib/pocketbase'");
    expect(prompt).toContain("pb.collection('tasks')");
    expect(prompt).toContain("pb.collection('users')");

    // Zero legacy Supabase implementation actions or SQL migrations
    expect(prompt).not.toContain('<boltAction type="supabase"');
    expect(prompt).not.toContain('CREATE TABLE users');
    expect(prompt).not.toContain('alter table users enable row level security');

    // Explicit prohibitions
    expect(prompt).toContain('FORBIDDEN: NEVER use Supabase, Firebase, Appwrite, MongoDB, PostgreSQL, MySQL, or Prisma');
    expect(prompt).toContain('FORBIDDEN: NEVER use Supabase actions, SQL migrations, or @supabase/supabase-js');
    expect(prompt).toContain('DO NOT use plain localStorage, in-memory arrays, or mock state as a database replacement');
  });

  it('original prompt enforces PocketBase without legacy Supabase migrations', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('original', options);

    expect(prompt).toContain('POCKETBASE IS THE MANDATORY FIRST-CHOICE DATABASE');
    expect(prompt).toContain('Use PocketBase as the backend database and authentication system');
    expect(prompt).not.toContain('<boltAction type="supabase"');
    expect(prompt).not.toContain('CREATE TABLE users');
    expect(prompt).not.toContain('alter table users enable row level security');
  });

  it('optimized prompt enforces PocketBase and eliminates Supabase default', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('optimized', options);

    expect(prompt).toContain('POCKETBASE IS THE MANDATORY FIRST-CHOICE DATABASE');
    expect(prompt).toContain('Use PocketBase as the backend database and authentication system');
    expect(prompt).not.toContain('Use Supabase for databases by default');
    expect(prompt).not.toContain('<boltAction type="supabase"');
  });

  it('discuss prompt recommends PocketBase instead of Supabase', () => {
    const prompt = discussPrompt();

    expect(prompt).toContain('ALWAYS use PocketBase for backend databases and authentication by default');
    expect(prompt).toContain('https://pocketbase.io/docs');
    expect(prompt).not.toContain('Use Supabase for databases by default');
    expect(prompt).not.toContain('support.bolt.new');
  });

  it('default prompt enforces complete file output and forbids conversational promises', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('default', options);

    expect(prompt).toContain('MANDATORY FULL-FILE OUTPUT');
    expect(prompt).toContain('PocketApp has NO diff or patch engine');
    expect(prompt).toContain('IMMEDIATE ACTION REQUIRED - NO CONVERSATIONAL PROMISES');
    expect(prompt).toContain('NEVER reply with conversational promises alone');
  });

  it('original prompt enforces complete file output and forbids conversational promises', () => {
    const prompt = PromptLibrary.getPropmtFromLibrary('original', options);

    expect(prompt).toContain('MANDATORY FULL-FILE OUTPUT FOR ALL FILE MODIFICATIONS');
    expect(prompt).toContain('PocketApp runs in WebContainer where each <boltAction type="file"');
    expect(prompt).toContain('IMMEDIATE ACTION REQUIRED - NO CONVERSATIONAL PROMISES');
    expect(prompt).not.toContain('Modify only the target block. Include 3-5 lines of exact context');
  });

  it('all prompts enforce the strict 500-line ceiling and App.tsx modularity', () => {
    const defaultPrompt = PromptLibrary.getPropmtFromLibrary('default', options);
    const originalPrompt = PromptLibrary.getPropmtFromLibrary('original', options);
    const optimizedPrompt = PromptLibrary.getPropmtFromLibrary('optimized', options);

    for (const p of [defaultPrompt, originalPrompt, optimizedPrompt]) {
      expect(p).toContain('CRITICAL MANDATE: ABSOLUTE 500-LINE CEILING PER FILE - NEVER EXCEED 500 LINES');
      expect(p).toContain('App.tsx MUST BE A LEAN TOP-LEVEL ORCHESTRATOR ONLY');
      expect(p).toContain('STRICTLY FORBIDDEN IN App.tsx');
      expect(p).toContain('NEVER write inline modals, dialogs, slide-overs, or popovers directly inside App.tsx');
      expect(p).toContain('src/components/');
      expect(p).toContain('src/hooks/');
      expect(p).toContain('src/types/');
    }

    // Ensure the old 250-line rule in optimized prompt is completely removed
    expect(optimizedPrompt).not.toContain('exceeding 250 lines');
  });
});
