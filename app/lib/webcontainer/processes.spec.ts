import { describe, expect, it, vi } from 'vitest';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { spawnTracked, stopProcesses } from './processes';

function processStub() {
  let finish!: (code: number) => void;
  const exit = new Promise<number>((resolve) => {
    finish = resolve;
  });

  return { exit, kill: vi.fn(() => finish(0)) } as unknown as WebContainerProcess;
}

describe('environment processes', () => {
  it('stops registered processes', async () => {
    const process = processStub();
    const container = { spawn: vi.fn(async () => process) } as unknown as WebContainer;
    await spawnTracked(container, 'npm', ['run', 'dev']);
    await stopProcesses();
    expect(process.kill).toHaveBeenCalledTimes(1);
  });

  it('kills a spawn that resolves after a restart', async () => {
    const process = processStub();
    let finishSpawn!: (process: WebContainerProcess) => void;
    const container = {
      spawn: () =>
        new Promise((resolve) => {
          finishSpawn = resolve;
        }),
    } as unknown as WebContainer;
    const pending = spawnTracked(container, 'npm', ['run', 'dev']);
    const rejected = expect(pending).rejects.toThrow('Environment is restarting');
    await stopProcesses();
    finishSpawn(process);
    await rejected;
    expect(process.kill).toHaveBeenCalledTimes(1);
  });
});
