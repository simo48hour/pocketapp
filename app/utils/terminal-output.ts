import type { ITerminal } from '~/types/terminal';

export const TERMINAL_SCROLLBACK = 250;
export const MAX_OUTPUT_CHARS = 32 * 1024;

export function boundOutput(text: string): string {
  return text.slice(-MAX_OUTPUT_CHARS).split('\n').slice(-TERMINAL_SCROLLBACK).join('\n');
}

/** One bounded pending batch and one xterm write in flight, even in a hidden tab. */
export function createTerminalWriter(terminal: ITerminal) {
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false;
  let disposed = false;
  const flush = () => {
    timer = undefined;

    if (disposed || writing || !pending) {
      return;
    }

    const data = pending;
    pending = '';
    writing = true;
    terminal.write(data, () => {
      writing = false;

      if (pending && !disposed) {
        timer = setTimeout(flush, 32);
      }
    });
  };

  return {
    write(data: string) {
      pending = boundOutput(pending + data);

      if (!disposed && !writing && !timer) {
        timer = setTimeout(flush, 32);
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      pending = '';
    },
  };
}
