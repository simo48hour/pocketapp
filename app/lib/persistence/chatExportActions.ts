import { toast } from 'react-toastify';
import type { Message } from 'ai';
import {
  duplicateChat,
  createChatFromMessages,
  getMessages,
  type IChatMetadata,
} from './db';
import { chatId } from './chatId';
import { db } from './dbInstance';

export async function duplicateCurrentChat(
  mixedIdOrListItemId?: string,
  navigate?: (path: string) => void,
) {
  const targetId = mixedIdOrListItemId || chatId.get();
  if (!db || !targetId) {
    return;
  }

  try {
    const newId = await duplicateChat(db, targetId);
    if (navigate) {
      navigate(`/chat/${newId}`);
    } else {
      window.location.href = `/chat/${newId}`;
    }
    toast.success('Chat duplicated successfully');
    return newId;
  } catch (error) {
    toast.error('Failed to duplicate chat');
    console.error(error);
  }
}

export async function importChat(
  chatDescription: string,
  messages: Message[],
  metadata?: IChatMetadata,
) {
  if (!db) {
    return;
  }

  try {
    const newId = await createChatFromMessages(db, chatDescription, messages, metadata);
    window.location.href = `/chat/${newId}`;
    toast.success('Chat imported successfully');
    return newId;
  } catch (error) {
    if (error instanceof Error) {
      toast.error('Failed to import chat: ' + error.message);
    } else {
      toast.error('Failed to import chat');
    }
  }
}

export async function exportChat(id?: string) {
  const targetId = id || chatId.get();
  if (!db || !targetId) {
    return;
  }

  const chat = await getMessages(db, targetId);
  if (!chat) {
    return;
  }

  const chatData = {
    messages: chat.messages,
    description: chat.description,
    exportDate: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
