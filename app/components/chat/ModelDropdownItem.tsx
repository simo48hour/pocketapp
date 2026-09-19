import { classNames } from '~/utils/classNames';
import { formatContextSize } from './modelSelectorUtils';
import type { ModelInfo } from '~/lib/modules/llm/types';

export interface ModelOptionItem extends ModelInfo {
  parsed: {
    cleanName: string;
    pricing: {
      prompt: string;
      completion: string;
      isFree?: boolean;
    } | null;
  };
  searchScore?: number;
  searchMatches?: boolean;
  highlightedName?: string;
  isAutoOption?: boolean;
}

interface ModelDropdownItemProps {
  modelOption: ModelOptionItem;
  isSelected: boolean;
  isFocused: boolean;
  isLocked: boolean;
  debouncedSearchQuery: string;
  onSelect: (modelName: string) => void;
  onLockedClick: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

export const ModelDropdownItem = ({
  modelOption,
  isSelected,
  isFocused,
  isLocked,
  debouncedSearchQuery,
  onSelect,
  onLockedClick,
  itemRef,
}: ModelDropdownItemProps) => {
  const { parsed, isAutoOption } = modelOption;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) {
      onLockedClick();
    } else {
      onSelect(modelOption.name);
    }
  };

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isSelected}
      className={classNames(
        'px-3 py-2 text-sm cursor-pointer border-b border-bolt-elements-borderColor/30 last:border-b-0',
        'hover:bg-bolt-elements-background-depth-3 transition-colors outline-none',
        isSelected || isFocused ? 'bg-bolt-elements-background-depth-3/80' : undefined,
        isFocused ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
      )}
      onClick={handleClick}
      tabIndex={isFocused ? 0 : -1}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate font-medium text-bolt-elements-textPrimary text-[13px]">
              {isAutoOption ? (
                'Auto'
              ) : (
                <span
                  dangerouslySetInnerHTML={{
                    __html: modelOption.highlightedName || parsed.cleanName,
                  }}
                />
              )}
            </span>

            {isAutoOption && (
              <span className="text-[11px] text-bolt-elements-textTertiary font-normal">
                · Powered by Gemini
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <span className="text-[11px] text-bolt-elements-textTertiary font-mono">
              {formatContextSize(modelOption.maxTokenAllowed)} tokens
            </span>

            {isAutoOption ? (
              <>
                <span className="text-bolt-elements-textTertiary text-[10px]">•</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                  Free
                </span>
              </>
            ) : parsed.pricing ? (
              <>
                <span className="text-bolt-elements-textTertiary text-[10px]">•</span>
                {parsed.pricing.isFree ? (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                    Free
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border border-bolt-elements-borderColor"
                    title="Input price (in) / Output price (out) per 1M tokens"
                  >
                    <span>↓${parsed.pricing.prompt}</span>
                    <span className="text-bolt-elements-textTertiary">·</span>
                    <span>↑${parsed.pricing.completion}</span>
                    <span className="text-[9px] text-bolt-elements-textTertiary font-sans">/1M</span>
                  </span>
                )}
              </>
            ) : null}

            {debouncedSearchQuery && (modelOption.searchScore || 0) > 70 && (
              <>
                <span className="text-bolt-elements-textTertiary text-[10px]">•</span>
                <span className="text-[11px] text-green-500 font-medium">
                  {(modelOption.searchScore || 0).toFixed(0)}% match
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {isLocked ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300">
              <span className="i-ph:lock-simple-fill text-[11px]" />
              <span className="text-[10px] font-bold tracking-wider">PRO</span>
            </div>
          ) : isSelected ? (
            <span className="i-ph:check text-sm text-green-500" title="Selected" />
          ) : null}
        </div>
      </div>
    </div>
  );
};
