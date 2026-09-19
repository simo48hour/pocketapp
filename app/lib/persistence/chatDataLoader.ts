import { generateId, type Message } from 'ai';
import { getMessages, getSnapshot, setMessages, setSnapshot } from './db';
import type { Snapshot } from './types';
import type { ContextAnnotation } from '~/types/context';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';

export async function fetchChatRecordAndSnapshot(
  db: IDBDatabase,
  mixedId: string,
): Promise<{ chatRecord: any; chatSnapshot: Snapshot | undefined }> {
  let [storedMessages, snapshot] = await Promise.all([
    getMessages(db, mixedId),
    getSnapshot(db, mixedId),
  ]);

  let chatRecord = storedMessages;
  let chatSnapshot = snapshot;

  if (!chatSnapshot && chatRecord?.id && chatRecord.id !== mixedId) {
    chatSnapshot = await getSnapshot(db, chatRecord.id).catch(() => undefined);
  }

  // Fallback to PocketBase if user is authenticated and chat is not found locally
  if (!chatRecord) {
    try {
      const { pb } = await import('~/lib/auth/pocketbase');
      const { currentUser } = await import('~/lib/stores/authStore');
      const user = currentUser.get();
      if (user && pb.authStore.isValid) {
        const record = await pb
          .collection('projects')
          .getFirstListItem(`(chat_id = "${mixedId}" || id = "${mixedId}") && user = "${user.id}"`)
          .catch(() => null);

        if (record) {
          chatRecord = {
            id: record.chat_id || record.id,
            urlId: record.chat_id || record.id,
            description: record.title || record.description,
            messages:
              typeof record.prompt_history === 'string'
                ? JSON.parse(record.prompt_history)
                : record.prompt_history || [],
            timestamp: record.updated || record.created,
            projectId: record.project_id || undefined,
          };
          await setMessages(
            db,
            chatRecord.id,
            chatRecord.messages,
            chatRecord.urlId,
            chatRecord.description,
            chatRecord.timestamp,
            undefined,
            chatRecord.projectId,
          ).catch(() => {});
          if (record.file_tree && typeof record.file_tree === 'object') {
            chatSnapshot = {
              chatIndex: chatRecord.messages[chatRecord.messages.length - 1]?.id || '',
              files: record.file_tree,
            };
            await setSnapshot(db, chatRecord.id, chatSnapshot).catch(() => {});
          }
        }
      }
    } catch (cloudErr) {
      console.warn('[Snapshot] Could not fetch project from PocketBase:', cloudErr);
    }
  }

  return { chatRecord, chatSnapshot };
}

export async function buildRestoredSnapshotMessages(
  recordMessages: Message[],
  validSnapshot: Snapshot,
  summary: string | undefined,
  snapshotIndex: number,
): Promise<Message[]> {
  const files = Object.entries(validSnapshot?.files || {})
    .map(([key, value]) => {
      if (value?.type !== 'file') {
        return null;
      }

      return {
        content: value.content,
        path: key,
      };
    })
    .filter((x): x is { content: string; path: string } => !!x);

  const projectCommands = await detectProjectCommands(files);
  const commandActionsString = createCommandActionsString(projectCommands);

  return [
    {
      id: generateId(),
      role: 'user',
      content: `Restore project from snapshot`,
      annotations: ['no-store', 'hidden'],
    },
    {
      id: recordMessages[snapshotIndex].id,
      role: 'assistant',
      content: `PocketApp restored your chat from a snapshot. You can revert this message to load the full chat history.
      <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
      ${Object.entries(validSnapshot?.files || {})
        .map(([key, value]) => {
          if (value?.type === 'file') {
            return `
          <boltAction type="file" filePath="${key}">
${value.content}
          </boltAction>
          `;
          } else {
            return ``;
          }
        })
        .join('\n')}
      ${commandActionsString} 
      </boltArtifact>
      `,
      annotations: [
        'no-store',
        ...(summary
          ? [
              {
                chatId: recordMessages[snapshotIndex].id,
                type: 'chatSummary',
                summary,
              } satisfies ContextAnnotation,
            ]
          : []),
      ],
    },
  ];
}
