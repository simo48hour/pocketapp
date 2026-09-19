import { atom } from 'nanostores';

/** Shared project identifier with no persistence/workbench imports. */
export const chatId = atom<string | undefined>(undefined);

/** Active project ID for organizing chats within projects. */
export const chatProjectId = atom<string | undefined>(undefined);

/** Helper to identify internal parser artifact IDs (e.g. "2-1788888502499-0", "artifact-...") */
export function isInternalId(id?: string): boolean {
  if (!id) return true;
  return /^\d+-\d+/.test(id) || id.startsWith('artifact-') || id.startsWith('message_');
}
