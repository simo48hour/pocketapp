import { describe, expect, it, vi } from 'vitest';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { BoltShell } from './shell';

vi.mock('~/lib/stores/qrCodeStore', () => ({ expoUrlAtom: { set: vi.fn() } }));
vi.mock('~/utils/terminalErrorParser', () => ({ extractErrorFromTerminal: () => ({ hasError: false }) }));

async function fixture() {
  let output!: ReadableStreamDefaultController<string>;
  let exit!: (code: number) => void;
  let running = false;
  const commands: string[] = [];
  const process = {
    output: new ReadableStream<string>({
      start(controller) {
        output = controller;
      },
    }),
    input: new WritableStream<string>({
      write(data) {
        if (data === '\x03') {
          if (running) {
            output.enqueue('\x1b]654;exit=0:130\x07');
          }

          running = false;
          output.enqueue('\x1b]654;prompt\x07');
        } else {
          commands.push(data);
          running = true;
        }
      },
    }),
    exit: new Promise<number>((resolve) => {
      exit = resolve;
    }),
    kill: vi.fn(() => {
      exit(0);
    }),
  } as unknown as WebContainerProcess;
  const spawn = vi.fn(async () => process);
  const container = { spawn } as unknown as WebContainer;
  const terminal = {
    write: vi.fn((_data, callback) => callback?.()),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
  } as unknown as ITerminal;
  const shell = new BoltShell();
  const init = shell.init(container, terminal);
  output.enqueue('\x1b]654;inter');
  output.enqueue('active\x07');
  await init;

  return { shell, output, spawn, container, terminal, commands };
}

describe('Shell lifecycle', () => {
  it('reuses its process and continuously consumes idle output', async () => {
    const f = await fixture();

    try {
      await f.shell.init(f.container, f.terminal);
      expect(f.spawn).toHaveBeenCalledTimes(1);

      for (let i = 0; i < 2000; i++) {
        f.output.enqueue('background output\n');
        await Promise.resolve();
      }
      expect(f.output.desiredSize).toBe(1);
    } finally {
      f.shell.dispose();
    }
  });

  it('deduplicates starts and handles split exit messages with bounded results', async () => {
    const f = await fixture();

    try {
      const first = f.shell.startCommand('one', 'npm run dev');
      expect(f.shell.startCommand('two', 'npm run dev')).toBe(first);
      await vi.waitFor(() => expect(f.commands).toEqual(['npm run dev\n']));
      f.output.enqueue('x'.repeat(100000));
      f.output.enqueue('\x1b]654;ex');
      f.output.enqueue('it=0:7\x07');

      const result = await first;
      expect(result?.exitCode).toBe(7);
      expect(result!.output.length).toBeLessThanOrEqual(32768);
    } finally {
      f.shell.dispose();
    }
  });

  it('rejects a running command when disposed', async () => {
    const f = await fixture();
    const command = f.shell.startCommand('one', 'npm run dev');
    const rejection = expect(command).rejects.toThrow('Environment stopped');
    await vi.waitFor(() => expect(f.commands).toHaveLength(1));
    f.shell.dispose();
    await rejection;
  });
});
