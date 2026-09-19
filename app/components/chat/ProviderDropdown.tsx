import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import { fuzzyMatch, highlightText } from './modelSelectorUtils';

interface ProviderDropdownProps {
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList: ProviderInfo[];
  modelList: ModelInfo[];
  setModel?: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const ProviderDropdown = ({
  provider,
  setProvider,
  providerList,
  modelList,
  setModel,
  isOpen,
  onToggle,
  onClose,
}: ProviderDropdownProps) => {
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [debouncedProviderSearchQuery, setDebouncedProviderSearchQuery] = useState('');
  const [focusedProviderIndex, setFocusedProviderIndex] = useState(-1);
  const providerSearchInputRef = useRef<HTMLInputElement>(null);
  const providerOptionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';
  const [localProviderStatus, setLocalProviderStatus] = useState<Record<string, ConnectionStatus>>({});

  useEffect(() => {
    const statuses: Record<string, ConnectionStatus> = {};
    for (const p of providerList) {
      if (!LOCAL_PROVIDERS.includes(p.name)) continue;
      const hasModels = modelList.some((m) => m.provider === p.name);
      statuses[p.name] = hasModels ? 'connected' : 'disconnected';
    }
    setLocalProviderStatus(statuses);
  }, [providerList, modelList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProviderSearchQuery(providerSearchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [providerSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        onClose();
        setProviderSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    setFocusedProviderIndex(-1);
  }, [debouncedProviderSearchQuery, isOpen]);

  useEffect(() => {
    if (isOpen && providerSearchInputRef.current) {
      providerSearchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (focusedProviderIndex >= 0 && providerOptionsRef.current[focusedProviderIndex]) {
      providerOptionsRef.current[focusedProviderIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedProviderIndex]);

  const clearProviderSearch = useCallback(() => {
    setProviderSearchQuery('');
    setDebouncedProviderSearchQuery('');
    providerSearchInputRef.current?.focus();
  }, []);

  const filteredProviders = useMemo(() => {
    if (!debouncedProviderSearchQuery) return providerList;
    return providerList
      .map((p) => {
        const match = fuzzyMatch(debouncedProviderSearchQuery, p.name);
        return {
          ...p,
          searchScore: match.score,
          searchMatches: match.matches,
          highlightedName: highlightText(p.name, debouncedProviderSearchQuery),
        };
      })
      .filter((p) => p.searchMatches)
      .sort((a, b) => b.searchScore - a.searchScore);
  }, [providerList, debouncedProviderSearchQuery]);

  const selectProvider = (selected: ProviderInfo) => {
    if (setProvider) {
      setProvider(selected);
      const firstModel = modelList.find((m) => m.provider === selected.name);
      if (firstModel && setModel) {
        setModel(firstModel.name);
      }
    }
    onClose();
    setProviderSearchQuery('');
    setDebouncedProviderSearchQuery('');
  };

  const handleProviderKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev + 1 >= filteredProviders.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev - 1 < 0 ? filteredProviders.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedProviderIndex >= 0 && focusedProviderIndex < filteredProviders.length) {
          selectProvider(filteredProviders[focusedProviderIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        setProviderSearchQuery('');
        setDebouncedProviderSearchQuery('');
        break;
      case 'Tab':
        if (!e.shiftKey && focusedProviderIndex === filteredProviders.length - 1) {
          onClose();
        }
        break;
      case 'k':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          clearProviderSearch();
        }
        break;
    }
  };

  return (
    <div className="relative flex w-full" onKeyDown={handleProviderKeyDown} ref={providerDropdownRef}>
      <div
        className={classNames(
          'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
          'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
          'transition-all cursor-pointer',
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
        aria-controls="provider-listbox"
        aria-haspopup="listbox"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            {provider?.name === 'Recommended' && (
              <span className="i-ph:sparkle-fill text-amber-500 flex-shrink-0 text-sm" />
            )}
            {provider?.name && LOCAL_PROVIDERS.includes(provider.name) && (
              <span
                className={classNames(
                  'inline-block w-2 h-2 rounded-full flex-shrink-0',
                  localProviderStatus[provider.name] === 'connected'
                    ? 'bg-green-500'
                    : localProviderStatus[provider.name] === 'disconnected'
                      ? 'bg-red-400'
                      : 'bg-bolt-elements-textTertiary',
                )}
                title={
                  localProviderStatus[provider.name] === 'connected'
                    ? `${provider.name} is running`
                    : localProviderStatus[provider.name] === 'disconnected'
                      ? `${provider.name} is not reachable`
                      : 'Checking...'
                }
              />
            )}
            {provider?.name || 'Select provider'}
          </div>
          <div
            className={classNames(
              'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
              isOpen ? 'rotate-180' : undefined,
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full left-0 right-0 bottom-full mb-1.5 py-1 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
          role="listbox"
          id="provider-listbox"
        >
          <div className="px-2 pb-2">
            <div className="relative">
              <input
                ref={providerSearchInputRef}
                type="text"
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                placeholder="Search providers... (⌘K to clear)"
                className={classNames(
                  'w-full pl-8 pr-8 py-1.5 rounded-md text-sm',
                  'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                  'transition-all',
                )}
                onClick={(e) => e.stopPropagation()}
                role="searchbox"
                aria-label="Search providers"
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
              </div>
              {providerSearchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearProviderSearch();
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
              'max-h-60 overflow-y-auto',
              'sm:scrollbar-none',
              '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2',
              '[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor',
              '[&::-webkit-scrollbar-thumb]:hover:bg-bolt-elements-borderColorHover',
              '[&::-webkit-scrollbar-thumb]:rounded-full',
              '[&::-webkit-scrollbar-track]:bg-bolt-elements-background-depth-2',
              '[&::-webkit-scrollbar-track]:rounded-full',
            )}
          >
            {filteredProviders.length === 0 ? (
              <div className="px-3 py-3 text-sm">
                <div className="text-bolt-elements-textTertiary mb-1">
                  {debouncedProviderSearchQuery
                    ? `No providers match "${debouncedProviderSearchQuery}"`
                    : 'No providers found'}
                </div>
              </div>
            ) : (
              filteredProviders.map((providerOption, index) => (
                <div
                  ref={(el) => (providerOptionsRef.current[index] = el)}
                  key={providerOption.name}
                  role="option"
                  aria-selected={provider?.name === providerOption.name}
                  className={classNames(
                    'px-3 py-2 text-sm cursor-pointer',
                    'hover:bg-bolt-elements-background-depth-3',
                    'text-bolt-elements-textPrimary',
                    'outline-none',
                    provider?.name === providerOption.name || focusedProviderIndex === index
                      ? 'bg-bolt-elements-background-depth-2'
                      : undefined,
                    focusedProviderIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectProvider(providerOption);
                  }}
                  tabIndex={focusedProviderIndex === index ? 0 : -1}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 truncate">
                      {providerOption.name === 'Recommended' && (
                        <span className="i-ph:sparkle-fill text-amber-500 flex-shrink-0 text-sm" />
                      )}
                      {LOCAL_PROVIDERS.includes(providerOption.name) && (
                        <span
                          className={classNames(
                            'inline-block w-2 h-2 rounded-full flex-shrink-0',
                            localProviderStatus[providerOption.name] === 'connected'
                              ? 'bg-green-500'
                              : localProviderStatus[providerOption.name] === 'disconnected'
                                ? 'bg-red-400'
                                : 'bg-bolt-elements-textTertiary',
                          )}
                        />
                      )}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: (providerOption as any).highlightedName || providerOption.name,
                        }}
                      />
                    </div>
                    {providerOption.name === 'Recommended' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium ml-2 shrink-0">
                        ⭐ Curated
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
