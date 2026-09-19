import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { isMissingKeyModalOpen, hasConfiguredKeysAtom, triggerKeySaved } from '~/lib/stores/modalStore';
import { saveUserApiKeyToCloud } from '~/lib/stores/authStore';

type SupportedProvider = 'OpenRouter' | 'Anthropic' | 'OpenAI' | 'Google' | 'Groq';

const PROVIDER_INFO: Record<SupportedProvider, { placeholder: string; link: string; prefix?: string }> = {
  OpenRouter: {
    placeholder: 'sk-or-v1-...',
    link: 'https://openrouter.ai/keys',
    prefix: 'sk-or-',
  },
  Anthropic: {
    placeholder: 'sk-ant-api03-...',
    link: 'https://console.anthropic.com/settings/keys',
    prefix: 'sk-ant-',
  },
  OpenAI: {
    placeholder: 'sk-proj-...',
    link: 'https://platform.openai.com/api-keys',
    prefix: 'sk-',
  },
  Google: {
    placeholder: 'AIzaSy...',
    link: 'https://aistudio.google.com/app/apikey',
  },
  Groq: {
    placeholder: 'gsk_...',
    link: 'https://console.groq.com/keys',
    prefix: 'gsk_',
  },
};

export function MissingKeyModal() {
  const isOpen = useStore(isMissingKeyModalOpen);
  const [provider, setProvider] = useState<SupportedProvider>('OpenRouter');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentProviderConfig = PROVIDER_INFO[provider];

  const handleSave = async () => {
    setError('');
    const trimmed = apiKey.trim();

    if (!trimmed) {
      setError('Please enter an API key');
      return;
    }

    if (currentProviderConfig.prefix && !trimmed.startsWith(currentProviderConfig.prefix)) {
      setError(`${provider} keys usually start with "${currentProviderConfig.prefix}"`);
    }

    setIsSaving(true);

    try {
      const success = await saveUserApiKeyToCloud(provider, trimmed);

      if (provider === 'OpenRouter') {
        await saveUserApiKeyToCloud('Recommended', trimmed);
      }

      if (!success) {
        setError('Failed to save API key. Please try again.');
        return;
      }

      hasConfiguredKeysAtom.set(true);
      setApiKey('');
      isMissingKeyModalOpen.set(false);
      triggerKeySaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl text-purple-600 dark:text-purple-400">
              🔑
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Bring Your Own Key (BYOK)</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Provide an API key to start generating code</p>
            </div>
          </div>
          <button
            onClick={() => isMissingKeyModalOpen.set(false)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Close"
          >
            <div className="i-ph:x text-base" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
          This community version runs on a <strong>Bring Your Own Key</strong> model. Your keys stay in your browser and connect directly to the AI provider with zero host markup.
        </p>

        {/* Provider Tabs */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {(['OpenRouter', 'Anthropic', 'OpenAI', 'Google', 'Groq'] as const).map((p) => (
            <button
              key={p}
              type="button"
              disabled={isSaving}
              onClick={() => {
                setProvider(p);
                setError('');
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex flex-col items-center gap-1 ${
                provider === p
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-600 dark:border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span className="truncate w-full text-center">{p}</span>
              {p === 'OpenRouter' && <span className="text-[9px] text-purple-600 dark:text-purple-400 font-normal">Rec</span>}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              {provider} API Key
            </label>
            <input
              type="password"
              disabled={isSaving}
              placeholder={currentProviderConfig.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition disabled:opacity-50"
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 pt-1">
            <span>Don&apos;t have a key?</span>
            <a
              href={currentProviderConfig.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-500 hover:underline flex items-center gap-1"
            >
              Get {provider} key &rarr;
            </a>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => isMissingKeyModalOpen.set(false)}
              disabled={isSaving}
              className="w-1/3 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white transition shadow-lg disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Key & Start Coding'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
