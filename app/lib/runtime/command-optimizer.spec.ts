import { describe, expect, it } from 'vitest';
import { optimizeShellCommand } from './command-optimizer';

describe('optimizeShellCommand', () => {
  it('skips a bare install when node_modules is ready', () => {
    expect(optimizeShellCommand('npm install', { nodeModulesReady: true, devServerRunning: false })).toEqual({
      kind: 'skip',
    });
  });

  it('adds offline flags without changing package arguments', () => {
    expect(optimizeShellCommand('npm i date-fns', { nodeModulesReady: false, devServerRunning: false })).toEqual({
      kind: 'shell',
      command: 'npm i --prefer-offline --no-audit --no-fund date-fns',
    });
  });

  it('turns an install-and-dev chain into a start when dependencies are ready', () => {
    expect(
      optimizeShellCommand('npm install && npm run dev', { nodeModulesReady: true, devServerRunning: false }),
    ).toEqual({
      kind: 'start',
      command: 'npm run dev',
    });
  });

  it('suppresses duplicate dev starts', () => {
    expect(optimizeShellCommand('npm run dev', { nodeModulesReady: true, devServerRunning: true })).toEqual({
      kind: 'skip',
    });
  });
});
