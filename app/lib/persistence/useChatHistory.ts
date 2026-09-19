import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import type { JSONValue, Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import {
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  setSnapshot,
  getSnapshot,
  getAll,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { WORK_DIR } from '~/utils/constants';
import { syncChatToPocketBase } from './pocketbaseSync';
import { upsertChatInStore } from './chatHistoryStore';
import { chatId, chatProjectId, isInternalId } from './chatId';
import { extractFilesFromMessages, restoreSnapshotToContainer } from './chatSnapshotRestore';
import { duplicateCurrentChat, importChat, exportChat, navigateChat } from './chatExportActions';
import { fetchChatRecordAndSnapshot, buildRestoredSnapshotMessages } from './chatDataLoader';

export { chatId, chatProjectId, isInternalId } from './chatId';
export { extractFilesFromMessages } from './chatSnapshotRestore';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
  projectId?: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

import { db } from './dbInstance';

export { db } from './dbInstance';

export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const lastLoadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentDb = db;
    if (!currentDb) {
      setReady(true);

      if (persistenceEnabled) {
        const error = new Error('Chat persistence is unavailable');
        logStore.logError('Chat persistence initialization failed', error);
        toast.error('Chat persistence is unavailable');
      }

      return;
    }

    if (mixedId) {
      if (lastLoadedIdRef.current === mixedId) {
        return;
      }
      lastLoadedIdRef.current = mixedId;

      fetchChatRecordAndSnapshot(currentDb, mixedId)
        .then(async ({ chatRecord, chatSnapshot }) => {
          if (chatRecord) {
            chatProjectId.set(chatRecord.projectId);
            const recordMessages = chatRecord.messages || [];

            // Immediately mark all historical messages in workbenchStore so they don't re-run actions prematurely
            workbenchStore.setReloadedMessages(recordMessages.map((m: Message) => m.id));

            // Extract authoritative up-to-date files across all messages
            const messageFiles = extractFilesFromMessages(recordMessages);

            // Merge with snapshot (snapshot contains manual user edits or custom files)
            const mergedFiles: FileMap = {
              ...(chatSnapshot?.files || {}),
              ...messageFiles,
            };

            const normalizedFiles: FileMap = {};
            for (const [key, val] of Object.entries(mergedFiles)) {
              if (!val) continue;
              const fullPath = key.startsWith(WORK_DIR) ? key : `${WORK_DIR}/${key.replace(/^\/+/, '')}`;
              normalizedFiles[fullPath] = val;
            }

            const lastMessageId = recordMessages[recordMessages.length - 1]?.id || '';
            const validSnapshot: Snapshot = {
              chatIndex: lastMessageId,
              files: normalizedFiles,
              summary: chatSnapshot?.summary,
            };

            // Update snapshot in db so future reloads are instantaneous
            setSnapshot(currentDb, mixedId, validSnapshot).catch(() => {});
            if (chatRecord.id !== mixedId) {
              setSnapshot(currentDb, chatRecord.id, validSnapshot).catch(() => {});
            }

            const summary = validSnapshot?.summary;
            const rewindId = searchParams.get('rewindTo');
            let startingIdx = -1;
            const endingIdx = rewindId ? recordMessages.findIndex((m: Message) => m.id === rewindId) + 1 : recordMessages.length;
            const snapshotIndex = validSnapshot?.chatIndex
              ? recordMessages.findIndex((m: Message) => m.id === validSnapshot.chatIndex)
              : -1;

            if (rewindId && snapshotIndex >= 0 && snapshotIndex < endingIdx) {
              startingIdx = snapshotIndex;
            }

            if (snapshotIndex > 0 && recordMessages[snapshotIndex]?.id == rewindId) {
              startingIdx = -1;
            }

            let filteredMessages = recordMessages.slice(startingIdx + 1, endingIdx);
            let archivedMsgs: Message[] = [];

            if (startingIdx >= 0) {
              archivedMsgs = recordMessages.slice(0, startingIdx + 1);
            }

            setArchivedMessages(archivedMsgs);

            if (startingIdx > 0 && recordMessages[snapshotIndex]) {
              const restoredMsgs = await buildRestoredSnapshotMessages(
                recordMessages,
                validSnapshot,
                summary,
                snapshotIndex,
              );
              filteredMessages = [...restoredMsgs, ...filteredMessages];
            }

            // Always restore snapshot files into WebContainer and Workbench
            if (validSnapshot?.files && Object.keys(validSnapshot.files).length > 0) {
              await restoreSnapshotToContainer(validSnapshot);
            }

            setInitialMessages(filteredMessages);

            const cleanUrlId = isInternalId(chatRecord.urlId) ? chatRecord.id : (chatRecord.urlId || chatRecord.id);
            setUrlId(cleanUrlId);
            description.set(chatRecord.description);
            chatId.set(chatRecord.id);
            chatMetadata.set(chatRecord.metadata);
          } else {
            console.warn(`[useChatHistory] Chat "${mixedId}" not found in DB or Cloud, navigating home.`);
            navigate('/', { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          console.error(error);
          logStore.logError('Failed to load chat messages or snapshot', error);
          toast.error('Failed to load chat: ' + error.message);
          setReady(true);
        });
    } else {
      lastLoadedIdRef.current = null;
      chatId.set(undefined);
      description.set(undefined);
      chatMetadata.set(undefined);
      setUrlId(undefined);

      const projectFromQuery = searchParams.get('project');
      if (projectFromQuery) {
        chatProjectId.set(projectFromQuery);
        if (currentDb) {
          getAll(currentDb)
            .then(async (allChats) => {
              const projectChats = allChats.filter((c) => c.projectId === projectFromQuery);
              if (projectChats.length > 0) {
                projectChats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const latestChat = projectChats[0];
                const snapshot = await getSnapshot(currentDb, latestChat.id);
                const messageFiles = extractFilesFromMessages(latestChat.messages || []);
                const mergedFiles = { ...(snapshot?.files || {}), ...messageFiles };
                if (Object.keys(mergedFiles).length > 0) {
                  workbenchStore.setDocuments(mergedFiles);
                }
              }
            })
            .catch(() => {});
        }
      } else {
        chatProjectId.set(undefined);
      }
      setReady(true);
    }
  }, [mixedId, db, navigate]);

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = _chatId || chatId.get();

      if (!id || !db) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      try {
        await setSnapshot(db, id, snapshot);
        const currentUrlId = urlId;
        if (currentUrlId && currentUrlId !== id) {
          await setSnapshot(db, currentUrlId, snapshot).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to save snapshot:', error);
      }
    },
    [db, urlId],
  );

  return {
    ready: !mixedId || ready,
    initialMessages,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!db || !id) {
        return;
      }

      try {
        await setMessages(db, id, initialMessages, urlId, description.get(), undefined, metadata, chatProjectId.get());
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !m.annotations?.includes('no-store'));

      // Ensure chatId.get() is initialized for new chats
      let currentChatId = chatId.get();
      if (initialMessages.length === 0 && !currentChatId) {
        currentChatId = await getNextId(db);
        chatId.set(currentChatId);
      }

      let _urlId = urlId;

      // Never use internal parser IDs as URL slugs
      if (!isInternalId(firstArtifact?.id) && !_urlId) {
        const generatedUrlId = await getUrlId(db, firstArtifact!.id);
        _urlId = generatedUrlId;
        navigateChat(generatedUrlId);
        setUrlId(generatedUrlId);
      } else if (!_urlId && currentChatId) {
        _urlId = currentChatId;
        navigateChat(currentChatId);
        setUrlId(currentChatId);
      }

      let chatSummary: string | undefined = undefined;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      let currentDescription = description.get() || firstArtifact?.title;
      if (!currentDescription) {
        const firstUserMsg = messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          const rawText = typeof firstUserMsg.content === 'string' ? firstUserMsg.content : '';
          const cleanedText = rawText
            .replace(/\[Model:[\s\S]*?\]/g, '')
            .replace(/\[Provider:[\s\S]*?\]/g, '')
            .trim();
          if (cleanedText) {
            currentDescription = cleanedText.split('\n')[0].slice(0, 50).trim();
          }
        }
      }

      if (currentDescription && !description.get()) {
        description.set(currentDescription);
      }

      const finalChatId = chatId.get() || currentChatId;

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');
        return;
      }

      const currentFiles = workbenchStore.files.get();
      const messageFiles = extractFilesFromMessages(messages);
      const rawSnapshotFiles: FileMap = {
        ...messageFiles,
        ...currentFiles,
      };

      const normalizedSnapshotFiles: FileMap = {};
      for (const [key, val] of Object.entries(rawSnapshotFiles)) {
        if (!val) continue;
        const fullPath = key.startsWith(WORK_DIR) ? key : `${WORK_DIR}/${key.replace(/^\/+/, '')}`;
        normalizedSnapshotFiles[fullPath] = val;
      }

      await takeSnapshot(messages[messages.length - 1].id, normalizedSnapshotFiles, finalChatId, chatSummary);

      const rawUrlId = _urlId || urlId || finalChatId;
      const effectiveUrlId = isInternalId(rawUrlId) ? finalChatId : rawUrlId;
      const currentProjId = chatProjectId.get();

      await setMessages(
        db,
        finalChatId,
        [...archivedMessages, ...messages],
        effectiveUrlId,
        description.get(),
        undefined,
        chatMetadata.get(),
        currentProjId,
      );

      syncChatToPocketBase(
        finalChatId,
        [...archivedMessages, ...messages],
        description.get(),
        {
          chatIndex: messages[messages.length - 1].id,
          files: normalizedSnapshotFiles,
          summary: chatSummary,
        },
        currentProjId,
      ).catch(() => {});

      upsertChatInStore({
        id: finalChatId,
        urlId: effectiveUrlId,
        description: description.get() || 'Untitled Chat',
        timestamp: new Date().toISOString(),
        projectId: currentProjId,
      });
    },
    duplicateCurrentChat: async (listItemId?: string) => {
      await duplicateCurrentChat(listItemId || mixedId, navigate);
    },
    importChat: async (chatDesc: string, messages: Message[], metadata?: IChatMetadata): Promise<void> => {
      await importChat(chatDesc, messages, metadata);
    },
    exportChat: async (id = urlId) => {
      await exportChat(id || mixedId);
    },
  };
}

export { duplicateCurrentChat, importChat, exportChat };
