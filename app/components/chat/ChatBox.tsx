import React, { useMemo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { toast } from 'react-toastify';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import type { ProviderInfo } from '~/types/model';
import { ColorSchemeDialog } from '~/components/ui/ColorSchemeDialog';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { McpTools } from './MCPTools';
import { WebSearch } from './WebSearch.client';
import { PromptInput, type Attachment } from '~/components/ui/ai-chat-input';
import { useBilling, upgradeOpen } from '~/components/billing/Billing';

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  onWebSearchResult?: (result: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

const CURATED_MODELS = [
  'Auto',
  'Anthropic Claude Sonnet Latest',
  'OpenAI GPT Latest',
  'Google Gemini Pro Latest',
  'OpenAI GPT Mini Latest',
  'Claude Opus 5',
  'Google: Gemini 2.5 Flash',
  'Xiaomi: MiMo-V2.5',
];

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const billingState = useBilling();
  const isPro = billingState?.status === 'active';

  // Sync attachments with uploadedFiles & imageDataList
  const attachments: Attachment[] = useMemo(() => {
    return props.uploadedFiles.map((file, idx) => ({
      id: `${file.name}-${file.lastModified}-${idx}`,
      file,
      url: props.imageDataList[idx] || (typeof window !== 'undefined' ? URL.createObjectURL(file) : ''),
      name: file.name,
    }));
  }, [props.uploadedFiles, props.imageDataList]);

  const handleAttachmentsChange = (newAtts: Attachment[]) => {
    props.setUploadedFiles?.(newAtts.map((a) => a.file));
    props.setImageDataList?.(newAtts.map((a) => a.url));
  };

  // Compute selected model display name
  const currentModelFriendly = useMemo(() => {
    if (
      !props.model ||
      props.model === 'Auto' ||
      props.model === 'auto' ||
      props.model.includes('gemini-flash-latest') ||
      props.model.includes('gemini-flash-1.5')
    ) {
      return 'Auto';
    }
    const lower = props.model.toLowerCase();
    if (lower.includes('claude-sonnet') || lower.includes('sonnet-latest')) {
      return 'Anthropic Claude Sonnet Latest';
    }
    if (lower.includes('gpt-mini')) {
      return 'OpenAI GPT Mini Latest';
    }
    if (lower.includes('gpt-latest') || (lower.includes('openai/gpt') && !lower.includes('mini'))) {
      return 'OpenAI GPT Latest';
    }
    if (lower.includes('gemini-pro')) {
      return 'Google Gemini Pro Latest';
    }
    if (lower.includes('gemini-2.5-flash')) {
      return 'Google: Gemini 2.5 Flash';
    }
    if (lower.includes('claude-opus') || lower.includes('opus-5')) {
      return 'Claude Opus 5';
    }
    if (lower.includes('xiaomi') || lower.includes('mimo')) {
      return 'Xiaomi: MiMo-V2.5';
    }
    return props.model;
  }, [props.model]);

  const handleModelSelect = (selected: string) => {
    if (selected === 'Auto') {
      if (props.provider?.name !== 'Recommended') {
        const recProvider = props.providerList?.find((p) => p.name === 'Recommended');
        if (recProvider && props.setProvider) {
          props.setProvider(recProvider);
        }
      }
      props.setModel?.('~google/gemini-flash-latest');
      return;
    }

    // Gate Pro models behind paywall for non-Pro users
    if (!isPro) {
      upgradeOpen.set(true);
      toast.info('Upgrade to PocketApp Pro to unlock this model.');
      return;
    }

    const modelMapping: Record<string, string> = {
      'Anthropic Claude Sonnet Latest': '~anthropic/claude-sonnet-latest',
      'OpenAI GPT Latest': '~openai/gpt-latest',
      'Google Gemini Pro Latest': '~google/gemini-pro-latest',
      'OpenAI GPT Mini Latest': '~openai/gpt-mini-latest',
      'Claude Opus 5': 'anthropic/claude-opus-5',
      'Google: Gemini 2.5 Flash': 'google/gemini-2.5-flash',
      'Xiaomi: MiMo-V2.5': 'xiaomi/mimo-v2.5',
    };

    const targetModel =
      modelMapping[selected] ||
      props.modelList?.find(
        (m) =>
          m.name?.toLowerCase().includes(selected.toLowerCase()) ||
          m.label?.toLowerCase().includes(selected.toLowerCase()),
      )?.name ||
      selected;

    if (targetModel && props.setModel) {
      if (props.provider?.name !== 'Recommended') {
        const recProvider = props.providerList?.find((p) => p.name === 'Recommended');
        if (recProvider && props.setProvider) {
          props.setProvider(recProvider);
        }
      }
      props.setModel(targetModel);
    }
  };

  const handleSubmitPrompt = (text: string, meta: { model: string; effort: string; attachments: File[] }) => {
    if (meta.attachments.length > 0 && props.setUploadedFiles) {
      props.setUploadedFiles(meta.attachments);
    }
    const syntheticEvent = new Event('submit') as unknown as React.UIEvent;
    props.handleSendMessage(syntheticEvent, text);
  };

  const extraActions = (
    <div className="flex items-center gap-1">
      {/* Build / Discuss mode pill */}
      <button
        type="button"
        title="Toggle Build / Discuss mode"
        onClick={() => {
          props.setChatMode?.(props.chatMode === 'discuss' ? 'build' : 'discuss');
        }}
        className={classNames(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer',
          props.chatMode === 'discuss'
            ? 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-600 dark:text-violet-300'
            : 'bg-transparent text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
        )}
      >
        {props.chatMode === 'discuss' ? (
          <>
            <div className="i-ph:chats text-sm text-violet-500 dark:text-violet-400" />
            <span className="hidden sm:inline">Discuss</span>
          </>
        ) : (
          <>
            <div className="i-ph:hammer text-sm text-zinc-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">Build</span>
          </>
        )}
      </button>

      {/* In active chat session: tools for inspection, color scheme & MCP */}
      {props.chatStarted && (
        <div className="flex items-center gap-1 ml-0.5 pl-1 border-l border-zinc-200/60 dark:border-zinc-800/60">
          <ColorSchemeDialog designScheme={props.designScheme} setDesignScheme={props.setDesignScheme} />
          <McpTools />
          <WebSearch
            onSearchResult={(result) => props.onWebSearchResult?.(result)}
            disabled={props.isStreaming}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      className={classNames(
        'relative w-full mx-auto z-prompt transition-all min-w-0',
        props.chatStarted ? 'max-w-chat' : 'max-w-3xl',
      )}
    >
      {/* Model & BYOK Keys Drawer */}
      <ClientOnly>
        {() => (
          <div
            className={
              props.isModelSettingsCollapsed
                ? 'hidden'
                : 'relative z-40 mb-3.5 p-3.5 rounded-2xl bg-zinc-50/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800 shadow-xl backdrop-blur-md'
            }
          >
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                AI Models & BYOK Keys
              </span>
              <div className="flex items-center gap-2">
                {props.input.trim().length > 0 && props.enhancePrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      props.enhancePrompt?.();
                      toast.success('Prompt enhanced!');
                    }}
                    disabled={props.enhancingPrompt}
                    className="flex items-center gap-1 text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium px-2 py-0.5 rounded hover:bg-violet-500/10 transition-colors cursor-pointer"
                  >
                    {props.enhancingPrompt ? (
                      <div className="i-svg-spinners:90-ring-with-bg text-xs animate-spin" />
                    ) : (
                      <div className="i-bolt:stars text-xs" />
                    )}
                    <span>Enhance prompt</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => props.setIsModelSettingsCollapsed(true)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded transition-colors cursor-pointer"
                  title="Close"
                >
                  <div className="i-ph:x text-xs" />
                </button>
              </div>
            </div>
            <ModelSelector
              key={props.provider?.name + ':' + props.modelList.length}
              model={props.model}
              setModel={props.setModel}
              modelList={props.modelList}
              provider={props.provider}
              setProvider={props.setProvider}
              providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
              apiKeys={props.apiKeys}
              modelLoading={props.isModelLoading}
            />
            {(props.providerList || []).length > 0 &&
              props.provider &&
              !LOCAL_PROVIDERS.includes(props.provider.name) && (
                <APIKeyManager
                  provider={props.provider}
                  apiKey={
                    props.provider.name === 'Recommended'
                      ? props.apiKeys['OpenRouter'] || props.apiKeys['Recommended'] || ''
                      : props.apiKeys[props.provider.name] || ''
                  }
                  setApiKey={(key) => {
                    if (props.provider?.name === 'Recommended') {
                      props.onApiKeysChange('OpenRouter', key);
                      props.onApiKeysChange('Recommended', key);
                    } else {
                      props.onApiKeysChange(props.provider.name, key);
                    }
                  }}
                />
              )}
          </div>
        )}
      </ClientOnly>

      {/* Selected Element inspection indicator */}
      {props.selectedElement && (
        <div className="flex mx-1.5 mb-1.5 gap-2 items-center justify-between rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary py-1 px-2.5 font-medium text-xs bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex gap-2 items-center lowercase">
            <code className="bg-accent-500 rounded-4px px-1.5 py-0.5 text-white">
              {props.selectedElement.tagName}
            </code>
            selected for inspection
          </div>
          <button
            className="bg-transparent text-accent-500 cursor-pointer hover:underline"
            onClick={() => props.setSelectedElement?.(null)}
          >
            Clear
          </button>
        </div>
      )}

      {/* Screenshot Manager */}
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={props.setUploadedFiles}
            setImageDataList={props.setImageDataList}
            uploadedFiles={props.uploadedFiles}
            imageDataList={props.imageDataList}
          />
        )}
      </ClientOnly>

      {/* Animated Spring-Physics Chatbot Input */}
      <PromptInput
        value={props.input}
        onChange={(val) => {
          if (props.handleInputChange) {
            props.handleInputChange({ target: { value: val } } as React.ChangeEvent<HTMLTextAreaElement>);
          }
        }}
        onSubmit={handleSubmitPrompt}
        placeholder={
          props.chatMode === 'build'
            ? 'Describe what you want to build with PocketBase...'
            : 'What would you like to discuss?'
        }
        models={CURATED_MODELS}
        selectedModel={currentModelFriendly}
        onModelChange={handleModelSelect}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
        isStreaming={props.isStreaming}
        onStop={props.handleStop}
        fullWidth={true}
        initialExpanded={props.chatStarted}
        extraActions={extraActions}
        isPro={isPro}
        onModelSelectToggle={(isOpen) => {
          if (isOpen && !props.isModelSettingsCollapsed) {
            props.setIsModelSettingsCollapsed(true);
          }
        }}
        onOpenSettings={() => props.setIsModelSettingsCollapsed(false)}
      />

      <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
    </div>
  );
};
