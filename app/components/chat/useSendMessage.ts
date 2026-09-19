import React from 'react';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import { PROMPT_COOKIE_KEY } from '~/utils/constants';
import { pb } from '~/lib/auth/pocketbase';
import { checkHasConfiguredKeys, isMissingKeyModalOpen, onKeySavedCallback } from '~/lib/stores/modalStore';
import { selectStarterTemplate, getTemplates } from '~/utils/selectStarterTemplate';
import { createMessageParts, filesToAttachments } from './chatHelpers';
import { requestNotificationPermission } from '~/utils/soundAndNotification';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { filesToArtifacts } from '~/utils/fileUtils';
import type { ElementInfo } from '~/components/workbench/Inspector';
import type { ProviderInfo } from '~/types/model';
import { generateId, type Message } from 'ai';
import { trackPromptSubmitted } from '~/utils/plausible';

export interface UseSendMessageProps {
  input: string;
  setInput: (value: string) => void;
  model: string;
  provider: ProviderInfo;
  isLoading: boolean;
  abort: () => void;
  beginGeneration: () => void;
  runAnimation: () => void;
  chatStarted: boolean;
  setFakeLoading: (loading: boolean) => void;
  autoSelectTemplate: boolean;
  selectedElement?: ElementInfo | null;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  imageDataList: string[];
  setImageDataList: (images: string[]) => void;
  setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
  messages: Message[];
  error: Error | undefined;
  append: (message: Message, options?: any) => Promise<string | null | undefined>;
  resetEnhancer: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function useSendMessage(props: UseSendMessageProps) {
  const {
    input,
    setInput,
    model,
    provider,
    isLoading,
    abort,
    beginGeneration,
    runAnimation,
    chatStarted,
    setFakeLoading,
    autoSelectTemplate,
    selectedElement,
    uploadedFiles,
    setUploadedFiles,
    imageDataList,
    setImageDataList,
    setMessages,
    messages,
    error,
    append,
    resetEnhancer,
    textareaRef,
  } = props;

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const messageContent = messageInput || input;

    if (!messageContent?.trim()) {
      return;
    }

    // Prompt user for browser notification permission upon click
    requestNotificationPermission().catch(() => {});

    // BYOK Requirement: Verify user has an API key configured before starting generation
    const hasKey = await checkHasConfiguredKeys();

    if (!hasKey) {
      onKeySavedCallback.set(() => {
        sendMessage(_event, messageContent);
      });
      isMissingKeyModalOpen.set(true);
      return;
    }

    if (isLoading) {
      abort();
      return;
    }

    // Funnel Step 2: Enforce 3 free requests limit for non-pro users
    const { billing, upgradeOpen, refreshBilling } = await import('~/components/billing/Billing');
    let billingState = billing.get();

    if (!billingState && pb.authStore.isValid) {
      await refreshBilling().catch(() => {});
      billingState = billing.get();
    }

    const isPro = true; // Community Edition: Unlimited generations with user's own keys (BYOK)

    // Funnel Step 3: Enforce single-project policy (prevent multiple open projects)
    const { getMultiTabCoordinator } = await import('~/lib/webcontainer/multiTabCoordinator');
    const coordinator = getMultiTabCoordinator();
    const canStart = coordinator.setActiveProject('project_' + Date.now(), messageContent.slice(0, 40));

    if (!canStart) {
      // Blocked because another project tab is active. ActiveProjectLockModal will display.
      return;
    }

    beginGeneration();
    trackPromptSubmitted({
      model,
      provider: provider.name,
      prompt: messageContent,
      isFirstPrompt: !chatStarted,
      userTier: isPro ? 'pro' : 'free',
    });

    let finalMessageContent = messageContent;

    if (selectedElement) {
      const elementInfo = `<div class="__boltSelectedElement__" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
      finalMessageContent = messageContent + elementInfo;
    }

    runAnimation();

    if (!chatStarted) {
      setFakeLoading(true);

      if (autoSelectTemplate) {
        const { template, title } = await selectStarterTemplate({
          message: finalMessageContent,
          model,
          provider,
        });

        if (template !== 'blank') {
          const temResp = await getTemplates(template, title).catch((e) => {
            if (e.message.includes('rate limit')) {
              toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
            } else {
              toast.warning('Failed to import starter template\n Continuing with blank template');
            }
            return null;
          });

          if (temResp) {
            const { assistantMessage, userMessage } = temResp;
            const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

            setMessages([
              {
                id: `1-${new Date().getTime()}`,
                role: 'user',
                content: userMessageText,
                parts: createMessageParts(userMessageText, imageDataList),
              },
              {
                id: `2-${new Date().getTime()}`,
                role: 'assistant',
                content: assistantMessage,
              },
            ]);

            const attachments = uploadedFiles.length > 0 ? await filesToAttachments(uploadedFiles) : undefined;
            const promptWithInstructions = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage ? `${userMessage}\n\n` : ''}${finalMessageContent}`;

            append(
              {
                id: generateId(),
                role: 'user',
                content: promptWithInstructions,
                annotations: ['hidden'],
                parts: createMessageParts(promptWithInstructions, imageDataList),
              },
              {
                headers: {
                  ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
                },
                ...(attachments ? { experimental_attachments: attachments } : {}),
              },
            );

            setInput('');
            Cookies.remove(PROMPT_COOKIE_KEY);
            setUploadedFiles([]);
            setImageDataList([]);
            resetEnhancer();
            textareaRef.current?.blur();
            setFakeLoading(false);
            return;
          }
        }
      }

      const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
      const attachments = uploadedFiles.length > 0 ? await filesToAttachments(uploadedFiles) : undefined;

      append(
        {
          id: generateId(),
          role: 'user',
          content: userMessageText,
          parts: createMessageParts(userMessageText, imageDataList),
        },
        {
          headers: {
            ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
          },
          ...(attachments ? { experimental_attachments: attachments } : {}),
        },
      );

      setFakeLoading(false);
      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);
      setUploadedFiles([]);
      setImageDataList([]);
      resetEnhancer();
      textareaRef.current?.blur();
      return;
    }

    if (error != null) {
      setMessages(messages.slice(0, -1));
    }

    const modifiedFiles = workbenchStore.getModifiedFiles();
    chatStore.setKey('aborted', false);

    const authHeaders = {
      headers: {
        ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
      },
    };

    if (modifiedFiles !== undefined) {
      const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
      const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${finalMessageContent}`;
      const attachmentOptions =
        uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

      append(
        {
          id: generateId(),
          role: 'user',
          content: messageText,
          parts: createMessageParts(messageText, imageDataList),
        },
        { ...authHeaders, ...attachmentOptions },
      );

      workbenchStore.resetAllFileModifications();
    } else {
      const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
      const attachmentOptions =
        uploadedFiles.length > 0 ? { experimental_attachments: await filesToAttachments(uploadedFiles) } : undefined;

      append(
        {
          id: generateId(),
          role: 'user',
          content: messageText,
          parts: createMessageParts(messageText, imageDataList),
        },
        { ...authHeaders, ...attachmentOptions },
      );
    }

    setInput('');
    Cookies.remove(PROMPT_COOKIE_KEY);
    setUploadedFiles([]);
    setImageDataList([]);
    resetEnhancer();
    textareaRef.current?.blur();
  };

  return { sendMessage };
}
