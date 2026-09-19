/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import { saveUserApiKeyToCloud } from '~/lib/stores/authStore';
import { hasConfiguredKeysAtom } from '~/lib/stores/modalStore';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import { ChatAlerts } from './ChatAlerts';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { StickToBottom } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { HomepageHero, HomepageDetails } from './HomepageDetails';
import { ScrollToBottom } from './ScrollToBottom';
import { chatProjectId, projectsAtom, PROJECT_COLORS } from '~/lib/persistence';

import { type BaseChatProps, TEXTAREA_MIN_HEIGHT } from './chat.types';

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolResult = () => {
        throw new Error('addToolResult not implemented');
      },
      onWebSearchResult,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    // Keep the drawer collapsed by default on both homepage and project page.
    // Advanced model and provider controls open when clicked from prompt toolbar.
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const currentProjectId = useStore(chatProjectId);
    const projects = useStore(projectsAtom);
    const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : undefined;

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        fetch('/api/user/keys/status')
          .then((res) => (res.ok ? (res.json() as Promise<{ configured?: Record<string, boolean> }>) : null))
          .then((data) => {
            if (data?.configured) {
              const hasKey = Object.values(data.configured).some(Boolean);
              hasConfiguredKeysAtom.set(hasKey);
            }
          })
          .catch(() => {});

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const isRealKey = Boolean(
        apiKey &&
        apiKey.trim().length > 0 &&
        apiKey !== 'configured' &&
        apiKey !== 'true' &&
        apiKey !== 'false'
      );
      const newApiKeys = { ...apiKeys, [providerName]: isRealKey ? apiKey.trim() : '' };
      setApiKeys(newApiKeys);

      // Save via secure server endpoint with AES-256-GCM encryption and HttpOnly cookie only if it's a real key
      if (isRealKey) {
        saveUserApiKeyToCloud(providerName, apiKey.trim()).catch(() => {});
      }

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div
            className={classNames(
              styles.Chat,
              'flex flex-col flex-grow h-full min-w-0',
              chatStarted && showWorkbench
                ? 'lg:w-[var(--workbench-left)] lg:max-w-[var(--workbench-left)] lg:shrink-0'
                : 'w-full',
            )}
          >
            {!chatStarted && <HomepageHero />}
            <StickToBottom
              className={classNames('pt-6 px-2 relative', chatStarted ? 'sm:px-4' : 'sm:px-6', {
                'h-full flex flex-col modern-scrollbar': chatStarted,
              })}
              resize="smooth"
              initial="smooth"
            >
              <StickToBottom.Content className="flex flex-col gap-4 relative">
                <ClientOnly>
                  {() => {
                    return chatStarted ? (
                      <Messages
                        className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1 min-w-0"
                        messages={messages}
                        isStreaming={isStreaming}
                        append={append}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                        provider={provider}
                        model={model}
                        addToolResult={addToolResult}
                      />
                    ) : null;
                  }}
                </ClientOnly>
                <ScrollToBottom />
              </StickToBottom.Content>
              <div
                className={classNames('my-auto flex flex-col gap-2 w-full mx-auto z-prompt mb-6 min-w-0', {
                  'sticky bottom-2 max-w-chat': chatStarted,
                  'max-w-3xl': !chatStarted,
                })}
              >
                <ChatAlerts
                  deployAlert={deployAlert}
                  clearDeployAlert={clearDeployAlert}
                  supabaseAlert={supabaseAlert}
                  clearSupabaseAlert={clearSupabaseAlert}
                  actionAlert={actionAlert}
                  clearAlert={clearAlert}
                  llmErrorAlert={llmErrorAlert}
                  clearLlmErrorAlert={clearLlmErrorAlert}
                  sendMessage={sendMessage}
                />
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                {currentProject && (
                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-purple-500/10 border border-purple-500/25 rounded-xl text-xs text-purple-700 dark:text-purple-300 w-full animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 truncate">
                      <span className="i-ph:folder-duotone text-purple-600 dark:text-purple-400 text-sm shrink-0" />
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        Project: {currentProject.name}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
                        — Chats created here belong to this project
                      </span>
                    </div>
                    {!chatStarted && (
                      <button
                        type="button"
                        onClick={() => {
                          chatProjectId.set(undefined);
                          window.location.href = '/';
                        }}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors shrink-0 cursor-pointer"
                        title="Exit project mode"
                      >
                        <span>Exit project</span>
                        <span className="i-ph:x text-xs" />
                      </button>
                    )}
                  </div>
                )}
                <ChatBox
                  isModelSettingsCollapsed={isModelSettingsCollapsed}
                  setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                  provider={provider}
                  setProvider={setProvider}
                  providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                  model={model}
                  setModel={setModel}
                  modelList={modelList}
                  apiKeys={apiKeys}
                  isModelLoading={isModelLoading}
                  onApiKeysChange={onApiKeysChange}
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  imageDataList={imageDataList}
                  setImageDataList={setImageDataList}
                  textareaRef={textareaRef}
                  input={input}
                  handleInputChange={handleInputChange}
                  handlePaste={handlePaste}
                  TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                  TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                  isStreaming={isStreaming}
                  handleStop={handleStop}
                  handleSendMessage={handleSendMessage}
                  enhancingPrompt={enhancingPrompt}
                  enhancePrompt={enhancePrompt}
                  isListening={isListening}
                  startListening={startListening}
                  stopListening={stopListening}
                  chatStarted={chatStarted}
                  exportChat={exportChat}
                  qrModalOpen={qrModalOpen}
                  setQrModalOpen={setQrModalOpen}
                  handleFileUpload={handleFileUpload}
                  chatMode={chatMode}
                  setChatMode={setChatMode}
                  designScheme={designScheme}
                  setDesignScheme={setDesignScheme}
                  selectedElement={selectedElement}
                  setSelectedElement={setSelectedElement}
                  onWebSearchResult={onWebSearchResult}
                />
              </div>
            </StickToBottom>
            <div className="flex flex-col justify-center">
              <div className="flex flex-col gap-5">
                {!chatStarted && (
                  <ExamplePrompts
                    onSelectPrompt={(text) => {
                      if (text) {
                        const syntheticEvent = {
                          target: { value: text },
                        } as React.ChangeEvent<HTMLTextAreaElement>;
                        handleInputChange?.(syntheticEvent);
                        if (textareaRef?.current) {
                          textareaRef.current.value = text;
                          textareaRef.current.focus();
                        }
                      }
                    }}
                  />
                )}
              </div>
              {!chatStarted && <HomepageDetails />}
            </div>
          </div>
          <ClientOnly>
            {() => (
              <Workbench chatStarted={chatStarted} isStreaming={isStreaming} setSelectedElement={setSelectedElement} />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);
