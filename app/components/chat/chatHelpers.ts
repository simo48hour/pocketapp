import type { Attachment, FileUIPart, TextUIPart } from '@ai-sdk/ui-utils';
import type { LlmErrorAlertType } from '~/types/actions';
import type { Message } from 'ai';
import { createSampler } from '~/utils/sampler';
import { toast } from 'react-toastify';

export const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    isLoading: boolean;
    parseMessages: (messages: Message[], isLoading: boolean) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (!isLoading && messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  150,
);

export function getDefaultModelForProvider(providerName?: string): string {
  switch (providerName) {
    case 'Recommended':
      return '~google/gemini-flash-latest';
    case 'Anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'OpenAI':
      return 'gpt-4o';
    case 'DeepSeek':
    case 'Deepseek':
      return 'deepseek-chat';
    case 'Google':
      return 'gemini-1.5-flash-latest';
    case 'Groq':
      return 'llama-3.3-70b-versatile';
    case 'HuggingFace':
      return 'Qwen/Qwen2.5-Coder-32B-Instruct';
    case 'Mistral':
      return 'codestral-latest';
    case 'Ollama':
      return 'qwen2.5-coder:7b';
    case 'OpenRouter':
      return 'google/gemini-flash-1.5';
    case 'Together':
      return 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    case 'xAI':
      return 'grok-beta';
    case 'Perplexity':
      return 'sonar-pro';
    case 'Cohere':
      return 'command-r-plus';
    default:
      return '~google/gemini-flash-latest';
  }
}

export function createMessageParts(text: string, images: string[]): (TextUIPart | FileUIPart)[] {
  const parts: (TextUIPart | FileUIPart)[] = [
    {
      type: 'text',
      text,
    },
  ];

  images.forEach((imageData) => {
    const mimeType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';
    parts.push({
      type: 'file',
      mimeType,
      data: imageData.replace(/^data:image\/[^;]+;base64,/, ''),
    });
  });

  return parts;
}

export async function filesToAttachments(files: File[]): Promise<Attachment[] | undefined> {
  if (files.length === 0) {
    return undefined;
  }

  return Promise.all(
    files.map(
      (file) =>
        new Promise<Attachment>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              name: file.name,
              contentType: file.type,
              url: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function categorizeLlmError(errorInfo: { statusCode?: number; message?: string }): {
  errorType: LlmErrorAlertType['errorType'];
  title: string;
} {
  const msg = (errorInfo.message || '').toLowerCase();
  if (errorInfo.statusCode === 401 || msg.includes('api key')) {
    return { errorType: 'authentication', title: 'Authentication Error' };
  } else if (errorInfo.statusCode === 429 || msg.includes('rate limit')) {
    return { errorType: 'rate_limit', title: 'Rate Limit Exceeded' };
  } else if (msg.includes('quota')) {
    return { errorType: 'quota', title: 'Quota Exceeded' };
  } else if (errorInfo.statusCode === 404 || msg.includes('not found') || msg.includes('model')) {
    return { errorType: 'network', title: 'Model Not Available' };
  } else if ((errorInfo.statusCode || 0) >= 500) {
    return { errorType: 'network', title: 'Server Error' };
  }
  return { errorType: 'unknown', title: 'Request Failed' };
}

export function buildLlmErrorInfo(
  error: any,
  providerName: string,
): {
  errorInfo: { message: string; isRetryable: boolean; statusCode: number; provider: string; type: string; retryDelay: number };
  errorType: LlmErrorAlertType['errorType'];
  title: string;
} {
  let errorInfo = {
    message: 'An unexpected error occurred',
    isRetryable: true,
    statusCode: 500,
    provider: providerName,
    type: 'unknown' as const,
    retryDelay: 0,
  };

  if (error?.message) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error || parsed.message) {
        errorInfo = { ...errorInfo, ...parsed };
      } else {
        errorInfo.message = error.message;
      }
    } catch {
      errorInfo.message = error.message;
    }
  }

  const { errorType, title } = categorizeLlmError(errorInfo);
  return { errorInfo, errorType, title };
}
