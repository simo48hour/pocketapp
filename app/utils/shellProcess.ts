import type { WebContainer } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';
import { withResolvers } from './promises';
import { boundOutput, createTerminalWriter } from './terminal-output';
import { spawnTracked } from '~/lib/webcontainer/processes';
import { createTerminalErrorDetector } from './terminalErrorDetector';

export async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
  const args: string[] = [];

  // Spawn a JSH process with fallback dimensions if terminal is not yet attached
  const process = await spawnTracked(webcontainer, '/bin/jsh', ['--osc', ...args], {
    terminal: {
      cols: terminal.cols ?? 80,
      rows: terminal.rows ?? 15,
    },
  });

  const input = process.input.getWriter();
  const output = process.output;

  const jshReady = withResolvers<void>();
  const detectTerminalError = createTerminalErrorDetector();

  let captureLog: typeof import('~/utils/debugLogger').captureTerminalLog | undefined;
  void import('~/utils/debugLogger')
    .then((module) => {
      captureLog = module.captureTerminalLog;
    })
    .catch(() => {
      /* Stream shutdown or optional diagnostics. */
    });

  const writer = createTerminalWriter(terminal);
  let isInteractive = false;
  let startupControl = '';
  const piping = output.pipeTo(
    new WritableStream({
      write(data) {
        if (!isInteractive) {
          startupControl = (startupControl + data).slice(-256);

          const [, osc] = startupControl.match(/\x1b\]654;([^\x07]+)\x07/) || [];

          if (osc === 'interactive') {
            isInteractive = true;
            jshReady.resolve();
          }
        }

        writer.write(data);
        detectTerminalError(data);

        if (captureLog) {
          captureLog(
            boundOutput(data)
              .replace(/\x1b\[[0-9;]*[mG]/g, '')
              .trim(),
            'output',
          );
        }
      },
    }),
  );

  const subscription = terminal.onData((data) => {
    if (isInteractive) {
      void input.write(data).catch(() => {
        /* Stream shutdown or optional diagnostics. */
      });

      if (captureLog) {
        captureLog(data.slice(-4096), 'input');
      }
    }
  });

  void piping
    .catch(() => {
      /* Stream shutdown or optional diagnostics. */
    })
    .finally(() => {
      subscription.dispose();
      writer.dispose();
      detectTerminalError.dispose();
      input.releaseLock();
      jshReady.reject(new Error('Shell exited before becoming ready'));
    });
  await jshReady.promise;

  return process;
}
