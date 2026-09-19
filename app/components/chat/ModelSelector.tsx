import { useState, useEffect, useMemo } from 'react';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import { useBilling, upgradeOpen } from '~/components/billing/Billing';
import { ProviderDropdown } from './ProviderDropdown';
import { ModelDropdown, isAutoModel } from './ModelDropdown';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  modelLoading,
}: ModelSelectorProps) => {
  const billingState = useBilling();
  const isPro = true; // Community Edition: All models unlocked for BYOK
  const isBillingLoaded = true;

  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const isRecommended = useMemo(() => {
    return !provider || provider.name === 'Recommended';
  }, [provider]);

  // For Free tier users, lock selected model to Auto (Google Gemini Flash Latest) only after billing state has loaded
  useEffect(() => {
    if (isBillingLoaded && !isPro && model && !isAutoModel(model)) {
      setModel?.('~google/gemini-flash-latest');
    }
  }, [isBillingLoaded, isPro, model, setModel]);

  // Sync default provider & model if currently selected is disabled/missing
  useEffect(() => {
    if (providerList.length === 0) {
      return;
    }

    if (provider && !providerList.some((p) => p.name === provider.name)) {
      const recProvider = providerList.find((p) => p.name === 'Recommended');
      const fallbackProvider = recProvider || providerList[0];
      setProvider?.(fallbackProvider);

      const firstModel =
        modelList.find((m) => m.provider === fallbackProvider.name) ||
        fallbackProvider.staticModels?.[0];

      if (firstModel) {
        setModel?.(isBillingLoaded && !isPro ? '~google/gemini-flash-latest' : firstModel.name);
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel, isPro, isBillingLoaded]);

  // If current model does not belong to active provider, switch to first valid model
  useEffect(() => {
    if (!provider || !model || modelList.length === 0) {
      return;
    }

    if (isBillingLoaded && !isPro) {
      if (!isAutoModel(model)) {
        setModel?.('~google/gemini-flash-latest');
      }
      return;
    }

    const currentBelongs =
      modelList.some((m) => m.provider === provider.name && m.name === model) ||
      provider.staticModels?.some((m) => m.name === model) ||
      (provider.name === 'Recommended' &&
        (model.startsWith('~') ||
          model.startsWith('anthropic/') ||
          model.startsWith('google/') ||
          model.startsWith('xiaomi/')));

    if (!currentBelongs) {
      const firstValid =
        modelList.find((m) => {
          if (m.provider !== provider.name) return false;
          if (provider.name === 'OpenRouter') {
            return m.label.includes('in:$') || m.name.toLowerCase().includes('free');
          }
          return true;
        }) || provider.staticModels?.[0];

      if (firstValid && setModel) {
        setModel(firstValid.name);
      }
    }
  }, [provider, model, modelList, setModel, isPro, isBillingLoaded]);

  const switchToRecommended = () => {
    const recProvider = providerList.find((p) => p.name === 'Recommended');
    if (recProvider && setProvider) {
      setProvider(recProvider);
      const defaultRecModel = !isPro
        ? '~google/gemini-flash-latest'
        : recProvider.staticModels?.find((m) => m.name.includes('sonnet-latest'))?.name ||
          recProvider.staticModels?.[0]?.name ||
          '~anthropic/claude-sonnet-latest';
      setModel?.(defaultRecModel);
    }
    setIsProviderDropdownOpen(false);
  };

  const switchToAllProviders = () => {
    const nonRecProvider =
      providerList.find((p) => p.name === 'OpenRouter') ||
      providerList.find((p) => p.name !== 'Recommended') ||
      providerList[0];

    if (nonRecProvider && setProvider) {
      setProvider(nonRecProvider);
      const firstValid =
        modelList.find((m) => m.provider === nonRecProvider.name) ||
        nonRecProvider.staticModels?.[0];
      if (firstValid && setModel) {
        setModel(!isPro ? '~google/gemini-flash-latest' : firstValid.name);
      }
    }
    setIsProviderDropdownOpen(false);
  };

  if (providerList.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center text-sm">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the
          chat.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Mode Selector Tabs & Tier Counter Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex p-0.5 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
          <button
            type="button"
            onClick={switchToRecommended}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer select-none',
              isRecommended
                ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
            )}
          >
            <span className="i-ph:sparkle-fill text-amber-500 text-xs" />
            <span>Recommended</span>
          </button>

          <button
            type="button"
            onClick={switchToAllProviders}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all cursor-pointer select-none',
              !isRecommended
                ? 'bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
            )}
          >
            <span className="i-ph:globe text-xs" />
            <span>All Providers</span>
          </button>
        </div>

        {/* BYOK Status Badge */}
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span>BYOK Active</span>
        </span>
      </div>

      {/* Dropdown Fields Area */}
      {isRecommended ? (
        /* Dedicated Recommended Models Field */
        <div className="flex flex-col gap-1 w-full">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-0.5">
            <span>Recommended Model</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {isPro ? 'All models unlocked' : 'Auto (Powered by Gemini) · Pro for all models'}
            </span>
          </div>
          <ModelDropdown
            model={model}
            setModel={setModel}
            provider={provider}
            modelList={modelList}
            modelLoading={modelLoading}
            isOpen={isModelDropdownOpen}
            onToggle={() => {
              setIsModelDropdownOpen(!isModelDropdownOpen);
              if (!isModelDropdownOpen) {
                setIsProviderDropdownOpen(false);
              }
            }}
            onClose={() => setIsModelDropdownOpen(false)}
          />
        </div>
      ) : (
        /* Full Dual Dropdown Fields: Provider + Model stacked vertically for clean layout */
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-1 w-full">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 px-0.5">Provider</span>
            <ProviderDropdown
              provider={provider}
              setProvider={setProvider}
              providerList={providerList}
              modelList={modelList}
              setModel={setModel}
              isOpen={isProviderDropdownOpen}
              onToggle={() => {
                setIsProviderDropdownOpen(!isProviderDropdownOpen);
                if (!isProviderDropdownOpen) {
                  setIsModelDropdownOpen(false);
                }
              }}
              onClose={() => setIsProviderDropdownOpen(false)}
            />
          </div>

          <div className="flex flex-col gap-1 w-full">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-0.5">
              <span>Model</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {isPro ? 'All models unlocked' : 'Auto (Powered by Gemini) · Pro for all models'}
              </span>
            </div>
            <ModelDropdown
              model={model}
              setModel={setModel}
              provider={provider}
              modelList={modelList}
              modelLoading={modelLoading}
              isOpen={isModelDropdownOpen}
              onToggle={() => {
                setIsModelDropdownOpen(!isModelDropdownOpen);
                if (!isModelDropdownOpen) {
                  setIsProviderDropdownOpen(false);
                }
              }}
              onClose={() => setIsModelDropdownOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
