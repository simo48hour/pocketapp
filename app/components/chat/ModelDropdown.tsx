import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import { useBilling, upgradeOpen } from '~/components/billing/Billing';
import { trackPaywallViewed, trackEvent } from '~/utils/plausible';
import { ModelDropdownItem, type ModelOptionItem } from './ModelDropdownItem';
import {
  parseModelLabel,
  formatContextSize,
  fuzzyMatch,
  highlightText,
  isModelLikelyFree,
} from './modelSelectorUtils';

export const isAutoModel = (modelName?: string) =>
  !modelName ||
  modelName === 'auto' ||
  modelName === '~google/gemini-flash-latest' ||
  modelName === 'google/gemini-flash-1.5';

interface ModelDropdownProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  modelList: ModelInfo[];
  modelLoading?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const ModelDropdown = ({
  model,
  setModel,
  provider,
  modelList,
  modelLoading,
  isOpen,
  onToggle,
  onClose,
}: ModelDropdownProps) => {
  const billingState = useBilling();
  const isPro = true; // Community Edition: All models unlocked for BYOK

  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [debouncedModelSearchQuery, setDebouncedModelSearchQuery] = useState('');
  const [focusedModelIndex, setFocusedModelIndex] = useState(-1);
  const [showFreeModelsOnly, setShowFreeModelsOnly] = useState(false);

  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const modelOptionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowFreeModelsOnly(false);
  }, [provider?.name]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedModelSearchQuery(modelSearchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [modelSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        onClose();
        setModelSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    setFocusedModelIndex(-1);
  }, [debouncedModelSearchQuery, isOpen, showFreeModelsOnly]);

  useEffect(() => {
    if (isOpen && modelSearchInputRef.current) {
      modelSearchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (focusedModelIndex >= 0 && modelOptionsRef.current[focusedModelIndex]) {
      modelOptionsRef.current[focusedModelIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedModelIndex]);

  const clearModelSearch = useCallback(() => {
    setModelSearchQuery('');
    setDebouncedModelSearchQuery('');
    modelSearchInputRef.current?.focus();
  }, []);

  const filteredModels = useMemo((): ModelOptionItem[] => {
    let providerModels = modelList.filter((m) => {
      if (!m.name) return false;
      if (provider?.name && m.provider !== provider.name) {
        return false;
      }
      return true;
    });

    if (providerModels.length === 0 && provider?.staticModels && provider.staticModels.length > 0) {
      providerModels = provider.staticModels;
    }

    const isRecommended = !provider || provider.name === 'Recommended';

    const processed = providerModels
      .filter((m) => {
        // Exclude the raw gemini-flash model from regular list if we're on recommended, since Auto represents it
        if (isRecommended && (m.name === '~google/gemini-flash-latest' || m.name === 'google/gemini-flash-1.5')) {
          return false;
        }

        const parsed = parseModelLabel(m.label);
        const isFree = isModelLikelyFree(m, provider?.name);

        if (provider?.name === 'OpenRouter' && !parsed.pricing && !isFree) {
          return false;
        }

        if (showFreeModelsOnly && !isFree) {
          return false;
        }

        return true;
      })
      .map((m): ModelOptionItem => {
        const parsed = parseModelLabel(m.label);
        const targetText = `${parsed.cleanName} ${m.name}`;
        const searchResult = fuzzyMatch(debouncedModelSearchQuery, targetText);
        const contextMatch = fuzzyMatch(debouncedModelSearchQuery, formatContextSize(m.maxTokenAllowed));

        const matches =
          !debouncedModelSearchQuery ||
          searchResult.matches ||
          (contextMatch.matches && contextMatch.score >= 90);
        const bestScore = Math.max(searchResult.score, contextMatch.score);

        return {
          ...m,
          parsed,
          searchScore: bestScore,
          searchMatches: matches,
          highlightedName: highlightText(parsed.cleanName, debouncedModelSearchQuery),
        };
      })
      .filter((m) => m.searchMatches)
      .sort((a, b) => {
        if (debouncedModelSearchQuery) {
          return (b.searchScore || 0) - (a.searchScore || 0);
        }
        if (provider?.name === 'Recommended') {
          return 0;
        }
        return a.parsed.cleanName.localeCompare(b.parsed.cleanName);
      });

    // Auto option for Recommended / top of list
    const autoMatches =
      !debouncedModelSearchQuery ||
      fuzzyMatch(debouncedModelSearchQuery, 'Auto Fast Efficient Gemini Flash').matches;

    if (isRecommended && autoMatches) {
      const autoOption: ModelOptionItem = {
        name: '~google/gemini-flash-latest',
        label: 'Auto - Powered by Gemini - context 1000k',
        provider: 'Recommended',
        maxTokenAllowed: 1000000,
        parsed: {
          cleanName: 'Auto',
          pricing: { prompt: '0', completion: '0', isFree: true },
        },
        isAutoOption: true,
        searchMatches: true,
        searchScore: 100,
      };

      return [autoOption, ...processed];
    }

    return processed;
  }, [modelList, provider?.name, showFreeModelsOnly, debouncedModelSearchQuery]);

  const selectModel = (modelName: string) => {
    trackEvent('Model Selected', {
      model: modelName,
      provider: provider?.name || 'Recommended',
      user_tier: isPro ? 'pro' : 'free',
    });
    setModel?.(modelName);
    onClose();
    setModelSearchQuery('');
    setDebouncedModelSearchQuery('');
  };

  const handleLockedClick = () => {
    trackPaywallViewed({ trigger: 'locked_model' });
    upgradeOpen.set(true);
    onClose();
  };

  const handleModelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedModelIndex((prev) => (prev + 1 >= filteredModels.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedModelIndex((prev) => (prev - 1 < 0 ? filteredModels.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedModelIndex >= 0 && focusedModelIndex < filteredModels.length) {
          const target = filteredModels[focusedModelIndex];
          const isLocked = !isPro && !target.isAutoOption;
          if (isLocked) {
            handleLockedClick();
          } else {
            selectModel(target.name);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        setModelSearchQuery('');
        setDebouncedModelSearchQuery('');
        break;
      case 'Tab':
        if (!e.shiftKey && focusedModelIndex === filteredModels.length - 1) {
          onClose();
        }
        break;
      case 'k':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          clearModelSearch();
        }
        break;
    }
  };

  const isCurrentAuto = isAutoModel(model);
  const currentModelInfo =
    modelList.find((m) => m.name === model && m.provider === provider?.name) ||
    modelList.find((m) => m.name === model) ||
    provider?.staticModels?.find((m) => m.name === model);
  const currentParsed = currentModelInfo ? parseModelLabel(currentModelInfo.label) : null;

  return (
    <div className="relative flex w-full" onKeyDown={handleModelKeyDown} ref={modelDropdownRef}>
      <div
        className={classNames(
          'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
          'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
          'transition-all cursor-pointer select-none',
          isOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
        )}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="model-listbox"
        aria-haspopup="listbox"
        tabIndex={0}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate min-w-0">
            {isCurrentAuto ? (
              <>
                <span className="truncate font-medium">Auto</span>
                <span className="text-xs text-bolt-elements-textTertiary truncate">· Powered by Gemini</span>
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                  Free
                </span>
              </>
            ) : (
              <span className="truncate">{currentParsed ? currentParsed.cleanName : 'Select model'}</span>
            )}

            {!isCurrentAuto && currentParsed?.pricing && (
              <span
                className={classNames(
                  'shrink-0 px-1.5 py-0.5 rounded text-[11px] font-mono',
                  currentParsed?.pricing?.isFree
                    ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25 font-sans'
                    : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary border border-bolt-elements-borderColor',
                )}
              >
                {currentParsed?.pricing?.isFree
                  ? 'Free'
                  : `$${currentParsed?.pricing?.prompt} / $${currentParsed?.pricing?.completion}`}
              </span>
            )}
          </div>
          <div
            className={classNames(
              'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75 shrink-0',
              isOpen ? 'rotate-180' : undefined,
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full left-0 right-0 bottom-full mb-1.5 py-1 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
          role="listbox"
          id="model-listbox"
        >
          <div className="px-2 pb-2 space-y-2">
            {provider?.name === 'OpenRouter' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFreeModelsOnly(!showFreeModelsOnly);
                  }}
                  className={classNames(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all',
                    'hover:bg-bolt-elements-background-depth-3',
                    showFreeModelsOnly
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor',
                  )}
                >
                  <span className="i-ph:gift text-xs" />
                  Free models only
                </button>
                {showFreeModelsOnly && (
                  <span className="text-xs text-bolt-elements-textTertiary">
                    {filteredModels.length} free model{filteredModels.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {debouncedModelSearchQuery && filteredModels.length > 0 && (
              <div className="text-xs text-bolt-elements-textTertiary px-1">
                {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} found
                {filteredModels.length > 5 && ' (showing best matches)'}
              </div>
            )}

            <div className="relative">
              <input
                ref={modelSearchInputRef}
                type="text"
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                placeholder="Search models... (⌘K to clear)"
                className={classNames(
                  'w-full pl-8 pr-8 py-1.5 rounded-md text-sm',
                  'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                  'transition-all',
                )}
                onClick={(e) => e.stopPropagation()}
                role="searchbox"
                aria-label="Search models"
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
              </div>
              {modelSearchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearModelSearch();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-bolt-elements-background-depth-3 transition-colors"
                  aria-label="Clear search"
                >
                  <span className="i-ph:x text-bolt-elements-textTertiary text-xs" />
                </button>
              )}
            </div>
          </div>

          <div
            className={classNames(
              'max-h-64 overflow-y-auto',
              'sm:scrollbar-none',
              '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2',
              '[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor',
              '[&::-webkit-scrollbar-thumb]:hover:bg-bolt-elements-borderColorHover',
              '[&::-webkit-scrollbar-thumb]:rounded-full',
              '[&::-webkit-scrollbar-track]:bg-bolt-elements-background-depth-2',
              '[&::-webkit-scrollbar-track]:rounded-full',
            )}
          >
            {modelLoading === 'all' || modelLoading === provider?.name ? (
              <div className="px-3 py-3 text-sm">
                <div className="flex items-center gap-2 text-bolt-elements-textTertiary">
                  <span className="i-ph:spinner animate-spin" />
                  Loading models...
                </div>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="px-3 py-3 text-sm">
                <div className="text-bolt-elements-textTertiary mb-1">
                  {debouncedModelSearchQuery
                    ? `No models match "${debouncedModelSearchQuery}"${showFreeModelsOnly ? ' (free only)' : ''}`
                    : showFreeModelsOnly
                      ? 'No free models available'
                      : provider?.name && LOCAL_PROVIDERS.includes(provider.name)
                        ? `No models found — is ${provider.name} running?`
                        : 'No models available'}
                </div>
                {!debouncedModelSearchQuery && provider?.name && LOCAL_PROVIDERS.includes(provider.name) && (
                  <div className="text-xs text-bolt-elements-textTertiary mt-1">
                    Make sure {provider.name} is running and has at least one model loaded.
                  </div>
                )}
              </div>
            ) : (
              filteredModels.map((modelOption, index) => {
                const isSelected = isCurrentAuto ? modelOption.isAutoOption : model === modelOption.name;
                const isFocused = focusedModelIndex === index;
                const isLocked = !isPro && !modelOption.isAutoOption;

                return (
                  <ModelDropdownItem
                    key={modelOption.name}
                    itemRef={(el) => (modelOptionsRef.current[index] = el)}
                    modelOption={modelOption}
                    isSelected={Boolean(isSelected)}
                    isFocused={isFocused}
                    isLocked={isLocked}
                    debouncedSearchQuery={debouncedModelSearchQuery}
                    onSelect={selectModel}
                    onLockedClick={handleLockedClick}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
