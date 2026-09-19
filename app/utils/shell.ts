import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';
import { atom } from 'nanostores';
import { boundOutput, createTerminalWriter } from './terminal-output';
import { spawnTracked } from '~/lib/webcontainer/processes';
import {
  clearDevServerRunning,
  isDevServerRunning,
  markDevServerRunning,
  getActiveDevCommand,
  setActiveDevCommand,
} from '~/lib/webcontainer/processes';
import { DEV_SERVER_COMMAND } from '~/lib/runtime/command-optimizer';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
export { newShellProcess } from './shellProcess';
import { createTerminalErrorDetector } from './terminalErrorDetector';

export type ExecutionResult = { output: string; exitCode: number } | undefined;

export class BoltShell {
  #attached = withResolvers<void>();
  #readyPromise: Promise<void> | undefined;
  #terminal: ITerminal | undefined;
  #process: WebContainerProcess | undefined;
  #input: WritableStreamDefaultWriter<string> | undefined;
  #reader: ReadableStreamDefaultReader<string> | undefined;
  #disposeOutput: (() => void) | undefined;
  #inputSubscription: { dispose: () => void } | undefined;
  #waiters = new Set<{
    code: string;
    output: string;
    resolve: (result: { output: string; exitCode: number }) => void;
    reject: (error: Error) => void;
  }>();
  #generation = 0;
  #streamsPaused = false;
  #preparation: Promise<unknown> = Promise.resolve();
  #startCommand: string | undefined;
  #startPromise: Promise<ExecutionResult> | undefined;
  executionState = atom<
    { sessionId: string; active: boolean; executionPrms?: Promise<any>; abort?: () => void } | undefined
  >();
  isReady = atom<boolean>(false);

  async ready() {
    await this.#attached.promise;
    await this.#readyPromise;
  }

  init(webcontainer: WebContainer, terminal: ITerminal) {
    this.#terminal = terminal;

    if (!this.#readyPromise) {
      const generation = this.#generation;
      this.#readyPromise = this.#init(webcontainer).catch((error) => {
        if (generation === this.#generation) {
          this.dispose();
        }

        throw error;
      });
      this.#attached.resolve();
    } else {
      this.#bindInput();
    }

    return this.#readyPromise;
  }

  #bindInput() {
    this.#inputSubscription?.dispose();
    this.#inputSubscription = this.#terminal?.onData((data) => {
      void this.#input?.write(data).catch(() => {
        /* Stream shutdown or optional diagnostics. */
      });
    });
  }

  async #init(webcontainer: WebContainer) {
    const generation = this.#generation;
    const process = await spawnTracked(webcontainer, '/bin/jsh', ['--osc'], {
      terminal: { cols: this.#terminal?.cols ?? 80, rows: this.#terminal?.rows ?? 15 },
    });

    if (generation !== this.#generation) {
      process.kill();
      throw new Error('Environment stopped');
    }

    this.#process = process;
    this.#input = process.input.getWriter();

    const interactive = this.waitTillOscCode('interactive');
    const writer = createTerminalWriter({
      write: (data, callback) => this.#terminal?.write(data, callback),
    } as ITerminal);
    this.#disposeOutput = writer.dispose;

    const detectError = createTerminalErrorDetector();
    const reader = process.output.getReader();
    this.#reader = reader;

    // One reader continuously drains stdout; idle command observers retain nothing.
    void (async () => {
      let control = '';
      let expo = '';

      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          if (!this.#streamsPaused) {
            writer.write(value);
            detectError(value);
          }

          for (const waiter of this.#waiters) {
            waiter.output = boundOutput(waiter.output + value);
          }
          expo = (expo + value).slice(-2048);

          const url = expo.match(/exp:\/\/[^\s\x1b]+/);

          if (url) {
            expoUrlAtom.set(url[0]);
            expo = '';
          }

          control += value;

          const pattern = /\x1b\]654;([^\x07=]+)(?:=(-?\d+):(\d+))?\x07/g;

          for (const match of control.matchAll(pattern)) {
            for (const waiter of this.#waiters) {
              if (waiter.code === match[1]) {
                this.#waiters.delete(waiter);
                waiter.resolve({ output: waiter.output, exitCode: Number(match[3] ?? 0) });
              }
            }
          }

          const lastEscape = control.lastIndexOf('\x1b');
          control =
            lastEscape >= 0 && !control.slice(lastEscape).includes('\x07') ? control.slice(lastEscape).slice(-256) : '';
        }
      } catch (error) {
        console.warn('Shell output ended:', error);
      } finally {
        writer.dispose();
        detectError.dispose();
        reader.releaseLock();

        if (this.#process === process) {
          this.dispose();
        }
      }
    })();
    await interactive;
    this.isReady.set(true);
    this.#bindInput();
  }

  dispose() {
    this.#generation++;
    this.#process?.kill();
    this.#process = undefined;
    void this.#reader?.cancel().catch(() => {
      /* Stream shutdown or optional diagnostics. */
    });
    this.#reader = undefined;
    void this.#input?.abort().catch(() => {
      /* Stream shutdown or optional diagnostics. */
    });
    this.#input = undefined;
    this.#inputSubscription?.dispose();
    this.#disposeOutput?.();

    for (const waiter of this.#waiters) {
      waiter.reject(new Error('Environment stopped'));
    }
    this.#waiters.clear();
    this.#readyPromise = undefined;
    this.#attached = withResolvers<void>();
    this.#startCommand = undefined;
    this.#startPromise = undefined;
    this.isReady.set(false);
    clearDevServerRunning();
    this.executionState.get()?.abort?.();
    this.executionState.set(undefined);
  }

  get terminal() {
    return this.#terminal;
  }
  get process() {
    return this.#process;
  }

  get streamsPaused() {
    return this.#streamsPaused;
  }

  pauseStreams() {
    this.#streamsPaused = true;
  }

  resumeStreams() {
    this.#streamsPaused = false;
  }

  async suspendDevServer(): Promise<void> {
    if (!isDevServerRunning()) {
      return;
    }

    try {
      if (this.#input) {
        // Send SIGINT to the running dev server in the shell
        await this.#input.write('\x03');
      }
    } catch (e) {
      console.warn('[BoltShell] Failed to suspend dev server:', e);
    } finally {
      clearDevServerRunning();
      this.#startCommand = undefined;
      this.#startPromise = undefined;
    }
  }

  async resumeDevServer(command?: string): Promise<ExecutionResult | undefined> {
    if (!this.#process && !this.#readyPromise) {
      return undefined;
    }

    const cmd = command || getActiveDevCommand() || 'npm run dev';
    // Dev servers are long-running daemons that never exit during normal sessions.
    // Trigger startCommand asynchronously so resumption does not hang awaiting command exit.
    void this.startCommand('workspace-resume', cmd).catch((err) => {
      console.warn('[BoltShell] Error starting resumed dev server:', err);
    });

    return { output: 'Dev server restart triggered', exitCode: 0 };
  }

  startCommand(sessionId: string, command: string, abort?: () => void) {
    if (this.#startCommand === command && this.#startPromise) {
      return this.#startPromise;
    }

    if (DEV_SERVER_COMMAND.test(command.trim()) && isDevServerRunning()) {
      return Promise.resolve({ output: 'Dev server already running; skipped duplicate start.', exitCode: 0 });
    }

    this.#startCommand = command;

    if (DEV_SERVER_COMMAND.test(command.trim())) {
      markDevServerRunning();
      setActiveDevCommand(command.trim());
    }

    const promise = this.executeCommand(sessionId, command, abort);
    this.#startPromise = promise;

    const clear = () => {
      if (this.#startPromise === promise) {
        this.#startPromise = undefined;
        this.#startCommand = undefined;
      }
    };
    void promise.then(
      () => {
        if (DEV_SERVER_COMMAND.test(command.trim())) {
          clearDevServerRunning();
        }

        clear();
      },
      () => {
        if (DEV_SERVER_COMMAND.test(command.trim())) {
          clearDevServerRunning();
        }

        clear();
      },
    );

    return promise;
  }

  async executeCommand(sessionId: string, command: string, abort?: () => void): Promise<ExecutionResult> {
    const generation = this.#generation;
    const checkGeneration = () => {
      if (generation !== this.#generation) {
        throw new Error('Environment stopped');
      }
    };
    let execution!: Promise<ExecutionResult>;
    const preparation = this.#preparation.then(async () => {
      checkGeneration();
      await this.ready();
      checkGeneration();

      const state = this.executionState.get();
      state?.abort?.();

      const prompt = this.waitTillOscCode('prompt');
      await this.#input!.write('\x03');
      await prompt;
      await state?.executionPrms;
      checkGeneration();
      execution = this.getCurrentExecutionResult();
      void execution.catch(() => {
        /* Stream shutdown or optional diagnostics. */
      });
      this.executionState.set({ sessionId, active: true, executionPrms: execution, abort });
      await this.#input!.write(command.trim() + '\n');
    });
    this.#preparation = preparation.catch(() => {
      /* Stream shutdown or optional diagnostics. */
    });
    await preparation;

    try {
      const result = await execution;
      return result && { ...result, output: cleanTerminalOutput(result.output) };
    } finally {
      if (this.executionState.get()?.executionPrms === execution) {
        this.executionState.set({ sessionId, active: false });
      }
    }
  }

  getCurrentExecutionResult(): Promise<ExecutionResult> {
    return this.waitTillOscCode('exit');
  }
  onQRCodeDetected?: (qrCode: string) => void;

  waitTillOscCode(code: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      this.#waiters.add({ code, output: '', resolve, reject });
    });
  }
}

/**
 * Cleans and formats terminal output while preserving structure and paths
 * Handles ANSI, OSC, and various terminal control sequences
 */
export function cleanTerminalOutput(input: string): string {
  // Step 1: Remove OSC sequences (including those with parameters)
  const removeOsc = input
    .replace(/\x1b\](\d+;[^\x07\x1b]*|\d+[^\x07\x1b]*)\x07/g, '')
    .replace(/\](\d+;[^\n]*|\d+[^\n]*)/g, '');

  // Step 2: Remove ANSI escape sequences and color codes more thoroughly
  const removeAnsi = removeOsc
    // Remove all escape sequences with parameters
    .replace(/\u001b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    // Remove color codes
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Clean up any remaining escape characters
    .replace(/\u001b/g, '')
    .replace(/\x1b/g, '');

  // Step 3: Clean up carriage returns and newlines
  const cleanNewlines = removeAnsi
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Step 4: Add newlines at key breakpoints while preserving paths
  const formatOutput = cleanNewlines
    // Preserve prompt line
    .replace(/^([~\/][^\n❯]+)❯/m, '$1\n❯')
    // Add newline before command output indicators
    .replace(/(?<!^|\n)>/g, '\n>')
    // Add newline before error keywords without breaking paths
    .replace(/(?<!^|\n|\w)(error|failed|warning|Error|Failed|Warning):/g, '\n$1:')
    // Add newline before 'at' in stack traces without breaking paths
    .replace(/(?<!^|\n|\/)(at\s+(?!async|sync))/g, '\nat ')
    // Ensure 'at async' stays on same line
    .replace(/\bat\s+async/g, 'at async')
    // Add newline before npm error indicators
    .replace(/(?<!^|\n)(npm ERR!)/g, '\n$1');

  // Step 5: Clean up whitespace while preserving intentional spacing
  const cleanSpaces = formatOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  // Step 6: Final cleanup
  return cleanSpaces
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/:\s+/g, ': ') // Normalize spacing after colons
    .replace(/\s{2,}/g, ' ') // Remove multiple spaces
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\u0000/g, ''); // Remove null characters
}

export function newBoltShellProcess() {
  return new BoltShell();
}
