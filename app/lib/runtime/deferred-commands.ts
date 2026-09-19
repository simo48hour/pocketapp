import type { ActionCallbackData } from './message-parser';

const DEV_COMMAND = /^(?:npm run dev|pnpm (?:run )?dev|yarn (?:run )?dev|npx vite)(?:\s+[^;&|\n]+)?$/;
const INSTALL_COMMAND = /^(?:npm (?:install|i|ci)(?:\s+[^;&|\n]+)?|pnpm install(?:\s+[^;&|\n]+)?|yarn(?: install)?(?:\s+[^;&|\n]+)?)$/;

/** Normalize only known commands; arbitrary shell scripts keep their original semantics. */
export function prepareDeferredCommands(actions: ActionCallbackData[]) {
  const commands: ActionCallbackData[] = [];
  const starts: ActionCallbackData[] = [];

  for (const data of actions) {
    const content = data.action.content.trim();

    if (data.action.type === 'shell' || data.action.type === 'start') {
      const parts = content.split(/\s*&&\s*/);

      if (parts.length === 2 && INSTALL_COMMAND.test(parts[0]) && DEV_COMMAND.test(parts[1])) {
        commands.push({ ...data, actionId: `${data.actionId}:install`, action: { type: 'shell', content: parts[0] } });
        starts.push({ ...data, action: { type: 'start', content: parts[1] } });
        continue;
      }

      if (DEV_COMMAND.test(content) || data.action.type === 'start') {
        starts.push({ ...data, action: { type: 'start', content } });
        continue;
      }
    }

    commands.push(data);
  }

  return [...commands, ...starts];
}

export function reusableCommand(data: ActionCallbackData) {
  return (
    data.action.type === 'start' || (data.action.type === 'shell' && INSTALL_COMMAND.test(data.action.content.trim()))
  );
}
