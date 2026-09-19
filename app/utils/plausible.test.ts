// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectAppStack,
  trackEvent,
  trackAppGenerated,
  trackPromptSubmitted,
  trackAppPublished,
  trackAppExported,
  getUserTier,
} from './plausible';

describe('Plausible Analytics & Stack Detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).plausible;
  });

  describe('detectAppStack', () => {
    it('detects a Full-Stack PocketBase project with pb_schema.json', () => {
      const files = {
        '/package.json': {
          type: 'file',
          content: JSON.stringify({
            dependencies: { react: '^18.2.0', pocketbase: '^0.21.0' },
          }),
        },
        '/pb_schema.json': {
          type: 'file',
          content: '[{"name":"posts","type":"base"}]',
        },
        '/src/App.tsx': {
          type: 'file',
          content: "import PocketBase from 'pocketbase';",
        },
      };

      const stack = detectAppStack(files);
      expect(stack.isFullStack).toBe(true);
      expect(stack.framework).toBe('React');
      expect(stack.backendType).toBe('PocketBase');
      expect(stack.databaseType).toBe('PocketBase (SQLite)');
      expect(stack.hasDatabaseSchema).toBe(true);
      expect(stack.filesCount).toBe(3);
    });

    it('detects a Full-Stack Supabase project', () => {
      const files = {
        '/package.json': {
          type: 'file',
          content: JSON.stringify({
            dependencies: { vue: '^3.0.0', '@supabase/supabase-js': '^2.0.0' },
          }),
        },
        '/src/supabase.ts': {
          type: 'file',
          content: "import { createClient } from '@supabase/supabase-js';",
        },
      };

      const stack = detectAppStack(files);
      expect(stack.isFullStack).toBe(true);
      expect(stack.framework).toBe('Vue');
      expect(stack.backendType).toBe('Supabase');
      expect(stack.databaseType).toBe('Supabase (PostgreSQL)');
    });

    it('detects a static frontend without backend', () => {
      const files = {
        '/index.html': {
          type: 'file',
          content: '<h1>Hello World</h1>',
        },
        '/style.css': {
          type: 'file',
          content: 'body { color: red; }',
        },
      };

      const stack = detectAppStack(files);
      expect(stack.isFullStack).toBe(false);
      expect(stack.framework).toBe('Vanilla HTML');
      expect(stack.backendType).toBe('None');
      expect(stack.databaseType).toBe('None');
      expect(stack.filesCount).toBe(2);
    });
  });

  describe('trackEvent', () => {
    it('pushes event to window.plausible queue if function is not yet loaded', () => {
      trackEvent('Test Event', { foo: 'bar', num: 42, flag: true });

      expect(typeof (window as any).plausible).toBe('function');
      const queue = (window as any).plausible.q;
      expect(Array.isArray(queue)).toBe(true);
      expect(queue.length).toBe(1);
      expect(queue[0][0]).toBe('Test Event');
      expect(queue[0][1]).toEqual({
        props: { foo: 'bar', num: 42, flag: true },
      });
    });

    it('calls existing window.plausible function directly', () => {
      const mockPlausible = vi.fn();
      (window as any).plausible = mockPlausible;

      trackEvent('Custom Goal', { status: 'success' });

      expect(mockPlausible).toHaveBeenCalledWith('Custom Goal', {
        props: { status: 'success' },
      });
    });

    it('truncates long string props to 300 characters', () => {
      const mockPlausible = vi.fn();
      (window as any).plausible = mockPlausible;

      const longString = 'a'.repeat(500);
      trackEvent('Long Prop Event', { prompt: longString });

      expect(mockPlausible).toHaveBeenCalled();
      const calledProps = mockPlausible.mock.calls[0][1].props;
      expect(calledProps.prompt.length).toBe(300);
    });
  });

  describe('event helpers', () => {
    it('fires Full-Stack App Created when app stack contains backend', () => {
      const mockPlausible = vi.fn();
      (window as any).plausible = mockPlausible;

      const files = {
        '/pb_schema.json': { type: 'file', content: '[]' },
        '/src/App.tsx': { type: 'file', content: 'export default () => <div>App</div>' },
      };

      trackAppGenerated({
        files,
        model: 'anthropic/claude-3.7-sonnet',
        provider: 'OpenRouter',
        userTier: 'pro',
      });

      expect(mockPlausible).toHaveBeenCalledTimes(2);
      expect(mockPlausible).toHaveBeenNthCalledWith(
        1,
        'App Generated',
        expect.objectContaining({
          props: expect.objectContaining({
            is_fullstack: true,
            backend_type: 'PocketBase',
            user_tier: 'pro',
          }),
        })
      );
      expect(mockPlausible).toHaveBeenNthCalledWith(
        2,
        'Full-Stack App Created',
        expect.objectContaining({
          props: expect.objectContaining({
            is_fullstack: true,
            backend_type: 'PocketBase',
            database_type: 'PocketBase (SQLite)',
          }),
        })
      );
    });

    it('tracks Prompt Submitted with prompt length bucket', () => {
      const mockPlausible = vi.fn();
      (window as any).plausible = mockPlausible;

      trackPromptSubmitted({
        model: 'openai/gpt-4o',
        provider: 'OpenRouter',
        prompt: 'Build a full stack crm with customer authentication and database',
        isFirstPrompt: true,
        userTier: 'free',
      });

      expect(mockPlausible).toHaveBeenCalledWith(
        'Prompt Submitted',
        expect.objectContaining({
          props: expect.objectContaining({
            model: 'openai/gpt-4o',
            prompt_length: '50-200',
            is_first_prompt: true,
            user_tier: 'free',
          }),
        })
      );
    });

    it('tracks App Published with subdomain and stack', () => {
      const mockPlausible = vi.fn();
      (window as any).plausible = mockPlausible;

      const files = {
        '/pb_schema.json': { type: 'file', content: '[]' },
      };

      trackAppPublished({
        subdomain: 'my-saas',
        url: 'https://my-saas.pocketapp.dev',
        files,
        userTier: 'pro',
      });

      expect(mockPlausible).toHaveBeenCalledWith(
        'App Published',
        expect.objectContaining({
          props: expect.objectContaining({
            subdomain: 'my-saas',
            is_fullstack: true,
            backend_type: 'PocketBase',
            user_tier: 'pro',
          }),
        })
      );
    });
  });
});
