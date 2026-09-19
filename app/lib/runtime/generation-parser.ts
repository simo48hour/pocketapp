import type { Message } from 'ai';
import type { WorkbenchStore } from '~/lib/stores/workbench';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';
import type { ActionCallbackData } from './message-parser';

type Workbench = Pick<
  WorkbenchStore,
  | 'showWorkbench'
  | 'addArtifact'
  | 'updateArtifact'
  | 'addAction'
  | 'runAction'
  | 'runDeferredActions'
  | 'abortAllActions'
>;

/** A response, not an artifact, is the boundary for running generated commands. */
export class GenerationParser {
  #pending = new Map<string, ActionCallbackData>();
  #generation = 0;
  #affectedMessages = new Set<string>();
  #cancelled = false;
  #successfulMessage: string | undefined;
  #inputs = new Map<string, string>();
  #rendered = new Map<string, string>();
  #parser: EnhancedStreamingMessageParser;

  constructor(private _workbench: Workbench) {
    const workbench = this._workbench;
    this.#parser = new EnhancedStreamingMessageParser({
      callbacks: {
        onArtifactOpen: (data) => {
          if (this.#cancelled) {
            return;
          }

          workbench.showWorkbench.set(true);
          workbench.addArtifact(data);
        },
        onArtifactClose: (data) => {
          if (!this.#cancelled) {
            workbench.updateArtifact(data, { closed: true });
          }
        },
        onActionOpen: (data) => {
          if (!this.#cancelled && data.action.type === 'file') {
            workbench.addAction(data);
          }
        },
        onActionClose: (data) => {
          if (this.#cancelled) {
            return;
          }

          this.#affectedMessages.add(data.messageId);
          workbench.addAction(data);

          if (data.action.type === 'file') {
            workbench.runAction(data);
          } else {
            this.#pending.set(JSON.stringify([data.messageId, data.artifactId, data.actionId]), data);
          }
        },

        // Partial files stay in the parser until their closing tag arrives.
      },
    });
  }

  begin() {
    this.#generation++;
    this.#cancelled = false;
    this.#successfulMessage = undefined;
    this.#pending.clear();
    this.#affectedMessages.clear();
  }

  finish(messageId: string, success: boolean) {
    if (!success) {
      this.cancel();
      return;
    }

    if (!this.#cancelled) {
      this.#successfulMessage = messageId;
    }
  }

  cancel() {
    this.#cancelled = true;
    this.#generation++;
    this.#successfulMessage = undefined;
    this.#pending.clear();
    this._workbench.abortAllActions();
  }

  parse(messages: Message[], isLoading: boolean) {
    const rendered: Record<number, string> = {};

    for (const [index, message] of messages.entries()) {
      if (message.role !== 'assistant' && message.role !== 'user') {
        continue;
      }

      const content = Array.isArray(message.content)
        ? (message.content.find((part) => part.type === 'text')?.text ?? '')
        : message.content;

      if (this.#inputs.get(message.id) !== content) {
        const delta = this.#parser.parse(message.id, content);
        this.#inputs.set(message.id, content);
        this.#rendered.set(message.id, (this.#rendered.get(message.id) ?? '') + delta);
      }

      if (!isLoading && message.id === this.#successfulMessage) {
        this.#parser.finalize(message.id, content);
      }

      rendered[index] = this.#rendered.get(message.id) ?? '';
    }

    if (!isLoading && this.#successfulMessage && messages.some((message) => message.id === this.#successfulMessage)) {
      const generation = this.#generation;
      const actions = [...this.#pending.values()];
      this.#pending.clear();
      this.#successfulMessage = undefined;
      this._workbench.runDeferredActions(actions, () => !this.#cancelled && this.#generation === generation, [
        ...this.#affectedMessages,
      ]);
    }

    return rendered;
  }
}
