import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundOutput, createTerminalWriter, MAX_OUTPUT_CHARS } from './terminal-output';
import type { ITerminal } from '~/types/terminal';

afterEach(() => vi.useRealTimers());

describe('bounded terminal output', () => {
  it('bounds both long lines and newline floods', () => {
    expect(boundOutput('x'.repeat(100000)).length).toBe(MAX_OUTPUT_CHARS);
    expect(boundOutput('line\n'.repeat(10000)).split('\n').length).toBe(250);
  });

  it('keeps one write in flight and drops old pending output under load', () => {
    vi.useFakeTimers();

    const write = vi.fn();
    const writer = createTerminalWriter({ write } as unknown as ITerminal);
    writer.write('first');
    vi.advanceTimersByTime(32);

    for (let i = 0; i < 1000; i++) {
      writer.write('x'.repeat(1000));
    }
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(1);
    write.mock.calls[0][1]();
    vi.advanceTimersByTime(32);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0].length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
    writer.dispose();
    write.mock.calls[1][1]();
    vi.runAllTimers();
    expect(write).toHaveBeenCalledTimes(2);
  });
});
