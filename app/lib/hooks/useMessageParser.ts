import type { Message } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { GenerationParser } from '~/lib/runtime/generation-parser';
import { workbenchStore } from '~/lib/stores/workbench';

export function useMessageParser() {
  const controller = useRef<GenerationParser>();
  controller.current ??= new GenerationParser(workbenchStore);

  const [parsedMessages, setParsedMessages] = useState<Record<number, string>>({});
  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    setParsedMessages(controller.current!.parse(messages, isLoading));
  }, []);
  const beginGeneration = useCallback(() => controller.current!.begin(), []);
  const finishGeneration = useCallback(
    (messageId: string, success: boolean) => controller.current!.finish(messageId, success),
    [],
  );
  const cancelGeneration = useCallback(() => controller.current!.cancel(), []);

  return { parsedMessages, parseMessages, beginGeneration, finishGeneration, cancelGeneration };
}
