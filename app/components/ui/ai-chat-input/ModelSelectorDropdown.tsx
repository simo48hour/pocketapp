import React, { useState } from 'react';
import { cn } from '~/lib/utils';
import { ModelIcon } from './Icons';

interface ModelSelectorDropdownProps {
  selectedModel: string;
  models: string[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectModel: (model: string) => void;
  onOpenSettings?: () => void;
  isPro?: boolean;
}

export function ModelSelectorDropdown({
  selectedModel,
  models,
  isOpen,
  onToggleOpen,
  onSelectModel,
  onOpenSettings,
  isPro,
}: ModelSelectorDropdownProps) {
  const [hoverStyle, setHoverStyle] = useState({
    opacity: 0,
    transform: 'translateY(0px) scale(0.95)',
    transition: 'none',
  });

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleOpen();
        }}
        className={cn(
          'group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-foreground/70 transition-all duration-200 outline-none hover:bg-accent/60 hover:text-foreground cursor-pointer',
          isOpen ? 'bg-accent/60 text-foreground ring-1 ring-border' : '',
        )}
        aria-label={`Select model. Current: ${selectedModel}`}
      >
        <ModelIcon model={selectedModel} className="size-3.5 opacity-80 group-hover:opacity-100 transition-opacity" />
        <span className="text-xs font-semibold select-none transition-colors">
          {selectedModel}
        </span>
      </button>

      <div
        style={{ transformOrigin: 'bottom left' }}
        onMouseLeave={() => {
          setHoverStyle((prev) => ({
            ...prev,
            opacity: 0,
            transform: prev.transform.replace('scale(1)', 'scale(0.95)'),
            transition: 'opacity 0.2s ease-in, transform 0.2s ease-out',
          }));
        }}
        className={cn(
          'absolute bottom-full left-0 mb-2.5 z-50 w-72 rounded-2xl border border-border bg-card/95 p-1 shadow-2xl backdrop-blur-md flex flex-col gap-0.5 transition-all duration-200 cursor-default',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
        )}
      >
        <div className="relative flex flex-col gap-0.5">
          <div style={hoverStyle} className="absolute left-0 right-0 top-0 h-8 -z-10 rounded-xl bg-accent pointer-events-none" />
          {models.map((model, idx) => (
            <button
              key={model}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => {
                setHoverStyle((prev) => ({
                  opacity: 1,
                  transform: `translateY(${idx * 34}px) scale(1)`,
                  transition:
                    prev.opacity === 0
                      ? 'opacity 0.15s ease-out'
                      : 'transform 0.2s ease-out, opacity 0.15s ease',
                }));
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectModel(model);
              }}
              className="group relative flex h-8 w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground/85 outline-none active:scale-[0.98] cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <ModelIcon model={model} className="size-3.5 opacity-85 group-hover:opacity-100 transition-opacity shrink-0" />
                <span className="truncate">{model}</span>
              </span>
              {model === 'Auto' ? (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                  Free
                </span>
              ) : isPro ? (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                  Pro
                </span>
              ) : (
                <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                  <span className="i-ph:lock-key-fill text-[9px]" />
                  Pro
                </span>
              )}
            </button>
          ))}

          {onOpenSettings && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              className="mt-1 pt-1.5 pb-0.5 border-t border-border flex items-center justify-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
            >
              <span>More AI Models & Keys...</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
