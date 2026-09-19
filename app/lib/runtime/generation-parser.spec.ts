import { describe, expect, it, vi } from 'vitest';
import type { Message } from 'ai';
import { GenerationParser } from './generation-parser';

function fixture() {
  const workbench = {
    showWorkbench: { set: vi.fn() },
    addArtifact: vi.fn(),
    updateArtifact: vi.fn(),
    addAction: vi.fn(),
    runAction: vi.fn(),
    runDeferredActions: vi.fn(),
    abortAllActions: vi.fn(),
  };
  const parser = new GenerationParser(workbench as unknown as ConstructorParameters<typeof GenerationParser>[0]);
  parser.begin();

  return { parser, workbench };
}

const message = (content: string, id = 'reply'): Message => ({ id, role: 'assistant', content });
const artifact = (id: string, content: string) => `<boltArtifact id="${id}" title="test">${content}</boltArtifact>`;
const file = (path: string, content: string) => `<boltAction type="file" filePath="${path}">${content}</boltAction>`;
const start = '<boltAction type="start">npm install && npm run dev</boltAction>';

describe('generation scheduling', () => {
  it('waits for successful response completion across multiple closed artifacts', () => {
    const { parser, workbench } = fixture();
    const first = artifact('one', file('one.ts', 'one') + start);
    parser.parse([message(first)], true);
    expect(workbench.runAction).toHaveBeenCalledTimes(1);
    expect(workbench.runDeferredActions).not.toHaveBeenCalled();

    const complete = first + artifact('two', file('two.ts', 'two'));
    parser.parse([message(complete)], true);
    expect(workbench.runAction).toHaveBeenCalledTimes(2);
    parser.finish('reply', true);
    parser.parse([message(complete)], false);
    expect(workbench.runDeferredActions).toHaveBeenCalledTimes(1);
    parser.parse([message(complete)], false);
    expect(workbench.runDeferredActions).toHaveBeenCalledTimes(1);
    expect(workbench.runAction).toHaveBeenCalledTimes(2);
  });

  it('applies each file once, only after its closing tag', () => {
    const { parser, workbench } = fixture();
    const partial = '<boltArtifact id="one" title="test"><boltAction type="file" filePath="one.ts">';

    for (let i = 1; i <= 100; i++) {
      parser.parse([message(partial + 'x'.repeat(i))], true);
    }
    expect(workbench.runAction).not.toHaveBeenCalled();
    parser.parse([message(partial + 'x'.repeat(100) + '</boltAction></boltArtifact>')], true);
    expect(workbench.runAction).toHaveBeenCalledTimes(1);
  });

  it('does not treat idle, cancelled, or failed streams as successful', () => {
    for (const outcome of ['idle', 'cancel', 'failure']) {
      const { parser, workbench } = fixture();
      const response = message(artifact('one', start));
      parser.parse([response], true);

      if (outcome === 'cancel') {
        parser.cancel();
      }

      if (outcome === 'failure') {
        parser.finish('reply', false);
      }

      parser.parse([response], false);
      expect(workbench.runDeferredActions).not.toHaveBeenCalled();
    }
  });

  it('invalidates released commands if cancelled or a new generation begins before execution', () => {
    for (const next of ['cancel', 'begin'] as const) {
      const { parser, workbench } = fixture();
      const response = message(artifact('one', start));
      parser.parse([response], true);
      parser.finish('reply', true);
      parser.parse([response], false);

      const isCurrent = workbench.runDeferredActions.mock.calls[0][1];
      expect(isCurrent()).toBe(true);
      parser[next]();
      expect(isCurrent()).toBe(false);
    }
  });
});
