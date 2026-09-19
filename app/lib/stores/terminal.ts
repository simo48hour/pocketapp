import { stopProcesses } from '~/lib/webcontainer/processes';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }> = [];
  #boltTerminal = newBoltShellProcess();
  #restart: Promise<void> | undefined;
  #attaching = new Map<ITerminal, object>();
  restarting = atom(false);

  restartEnvironment() {
    if (this.#restart) {
      return this.#restart;
    }

    this.restarting.set(true);
    this.#restart = this.#restartEnvironment().finally(() => {
      this.restarting.set(false);
      this.#restart = undefined;
    });

    return this.#restart;
  }

  async #restartEnvironment() {
    const wc = await this.#webcontainer;
    const boltTerminal = this.#boltTerminal.terminal;

    if (!boltTerminal) {
      throw new Error('Open the terminal before restarting the environment');
    }

    const terminals = this.#terminals.map(({ terminal }) => terminal);
    this.#attaching.clear();
    this.#boltTerminal.dispose();
    await stopProcesses();
    this.#terminals = [];

    // Only generated caches are removed; source files and dependencies stay mounted.
    for (const path of ['node_modules/.vite', 'node_modules/.cache', '.vite']) {
      await wc.fs.rm(path, { recursive: true, force: true });
    }
    boltTerminal.reset();
    await this.#boltTerminal.init(wc, boltTerminal);

    for (const terminal of terminals) {
      terminal.reset();
      await this.attachTerminal(terminal);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        unsubscribe = wc.on('server-ready', () => resolve());
        timeout = setTimeout(
          () => reject(new Error('Dev server did not become ready within 30 seconds. Check the terminal.')),
          30000,
        );
        void this.#boltTerminal
          .startCommand('environment-restart', 'npm run dev')
          .then(
            (result) =>
              reject(new Error(`Dev server exited before becoming ready (code ${result?.exitCode ?? 'unknown'})`)),
            reject,
          );
      });
    } finally {
      clearTimeout(timeout);
      unsubscribe?.();
    }
  }

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }
  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }
  async attachBoltTerminal(terminal: ITerminal) {
    try {
      const wc = await this.#webcontainer;
      await this.#boltTerminal.init(wc, terminal);
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn terminal shell\n\n') + error.message);
      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    if (this.#attaching.has(terminal) || this.#terminals.some((entry) => entry.terminal === terminal)) {
      return;
    }

    const attachment = {};
    this.#attaching.set(terminal, attachment);

    try {
      const shellProcess = await newShellProcess(await this.#webcontainer, terminal);

      if (this.#attaching.get(terminal) !== attachment) {
        shellProcess.kill();
        return;
      }

      this.#terminals.push({ terminal, process: shellProcess });
    } catch (error: any) {
      if (this.#attaching.get(terminal) === attachment) {
        terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      }
    } finally {
      if (this.#attaching.get(terminal) === attachment) {
        this.#attaching.delete(terminal);
      }
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }

  async detachTerminal(terminal: ITerminal) {
    this.#attaching.delete(terminal);

    const terminalIndex = this.#terminals.findIndex((t) => t.terminal === terminal);

    if (terminalIndex !== -1) {
      const { process } = this.#terminals[terminalIndex];

      try {
        process.kill();
      } catch (error) {
        console.warn('Failed to kill terminal process:', error);
      }
      this.#terminals.splice(terminalIndex, 1);
    }
  }

  pauseTerminalStreams() {
    this.#boltTerminal.pauseStreams();
  }

  resumeTerminalStreams() {
    this.#boltTerminal.resumeStreams();
  }

  async suspendDevServer() {
    await this.#boltTerminal.suspendDevServer();
  }

  async resumeDevServer(command?: string) {
    return this.#boltTerminal.resumeDevServer(command);
  }

  disposeAll() {
    this.#attaching.clear();
    this.#boltTerminal.dispose();

    for (const { process } of this.#terminals) {
      try {
        process.kill();
      } catch (error) {
        console.warn('Failed to kill terminal process on dispose:', error);
      }
    }

    this.#terminals = [];
  }
}
