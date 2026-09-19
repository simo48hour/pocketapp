import type { SpawnOptions, WebContainer, WebContainerProcess } from '@webcontainer/api';

const state: {
  processes: Set<WebContainerProcess>;
  stopping: boolean;
  generation: number;
  devServerRunning: boolean;
  activeDevCommand: string;
} = import.meta.hot?.data.processState ?? {
  processes: new Set<WebContainerProcess>(),
  stopping: false,
  generation: 0,
  devServerRunning: false,
  activeDevCommand: 'npm run dev',
};

if (import.meta.hot) {
  import.meta.hot.data.processState = state;
}

export async function spawnTracked(container: WebContainer, command: string, args: string[], options?: SpawnOptions) {
  if (state.stopping) {
    throw new Error('Environment is restarting');
  }

  const startedGeneration = state.generation;
  const process = await container.spawn(command, args, options);

  if (state.stopping || startedGeneration !== state.generation) {
    process.kill();
    throw new Error('Environment is restarting');
  }

  state.processes.add(process);
  void process.exit.then(
    () => state.processes.delete(process),
    () => state.processes.delete(process),
  );

  return process;
}

export async function stopProcesses() {
  state.stopping = true;
  state.generation++;

  try {
    const active = [...state.processes];
    active.forEach((process) => process.kill());

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        Promise.all(active.map((process) => process.exit)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Processes did not stop; retry restart')), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  } finally {
    state.stopping = false;
    state.devServerRunning = false;
  }
}

export function isDevServerRunning() {
  return state.devServerRunning;
}

export function markDevServerRunning() {
  state.devServerRunning = true;
}

export function clearDevServerRunning() {
  state.devServerRunning = false;
}

export function getActiveDevCommand() {
  return state.activeDevCommand || 'npm run dev';
}

export function setActiveDevCommand(command: string) {
  if (command && command.trim()) {
    state.activeDevCommand = command.trim();
  }
}

export function getTrackedProcessesCount() {
  return state.processes.size;
}
