import { describe, expect, it } from 'vitest';
import { prepareDeferredCommands, reusableCommand } from './deferred-commands';
import type { ActionCallbackData } from './message-parser';

const action = (content: string, type: 'shell' | 'start' = 'shell'): ActionCallbackData => ({
  artifactId: 'a',
  messageId: 'm',
  actionId: content,
  action: { type, content },
});

describe('deferred commands', () => {
  it('separates install and dev so a long-running shell cannot block later file writes', () => {
    const result = prepareDeferredCommands([action('npm install && npm run dev'), action('npm run build')]);
    expect(result.map((data) => [data.action.type, data.action.content])).toEqual([
      ['shell', 'npm install'],
      ['shell', 'npm run build'],
      ['start', 'npm run dev'],
    ]);
    expect(result[0].actionId).not.toBe(result[2].actionId);
  });
  it('preserves arbitrary shell scripts and only deduplicates known installs and starts', () => {
    const command = action('cd app && npm install && npm run dev');
    expect(prepareDeferredCommands([command])).toEqual([command]);
    expect(reusableCommand(command)).toBe(false);
    expect(reusableCommand(action('npm install'))).toBe(true);
  });
});
