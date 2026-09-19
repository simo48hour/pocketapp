import React from 'react';
import { useStore } from '@nanostores/react';
import { isMissingKeyModalOpen, hasConfiguredKeysAtom } from '~/lib/stores/modalStore';

export function ApiKeyHeaderButton() {
  const hasKeys = useStore(hasConfiguredKeysAtom);

  return (
    <button
      onClick={() => isMissingKeyModalOpen.set(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 shadow-sm transition"
      title="Manage AI API Keys (BYOK)"
    >
      <span className="text-sm">🔑</span>
      <span>API Keys</span>
      {hasKeys ? (
        <span
          className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
          title="Active API key configured"
        />
      ) : (
        <span
          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
          title="No API key configured"
        />
      )}
    </button>
  );
}
