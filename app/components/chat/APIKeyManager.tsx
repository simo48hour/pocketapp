import React, { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { ProviderInfo } from '~/types/model';
import Cookies from 'js-cookie';
import { saveUserApiKeyToCloud, deleteUserApiKey } from '~/lib/stores/authStore';
import { hasConfiguredKeysAtom } from '~/lib/stores/modalStore';

interface APIKeyManagerProps {
  provider: ProviderInfo;
  apiKey: string;
  setApiKey: (key: string) => void;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
}

// Global cache for environment key status
const providerEnvKeyStatusCache: Record<string, boolean> = {};

// Global status cache for configured provider keys
let cachedKeyStatus: Record<string, boolean> | null = null;
let statusFetchPromise: Promise<Record<string, boolean>> | null = null;

export async function fetchKeyStatus(): Promise<Record<string, boolean>> {
  if (cachedKeyStatus) {
    return cachedKeyStatus;
  }

  if (statusFetchPromise) {
    return statusFetchPromise;
  }

  const headers: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    const pbAuth = localStorage.getItem('pocketbase_auth');

    if (pbAuth) {
      try {
        const parsed = JSON.parse(pbAuth);

        if (parsed.token) {
          headers.Authorization = `Bearer ${parsed.token}`;
        }
      } catch {}
    }
  }

  statusFetchPromise = fetch('/api/user/keys/status', { headers })
    .then((res) => (res.ok ? res.json() : { configured: {} }))
    .then((data: any) => {
      cachedKeyStatus = data.configured || {};
      const hasAny = Object.values(cachedKeyStatus || {}).some(Boolean);
      hasConfiguredKeysAtom.set(hasAny);
      statusFetchPromise = null;
      return cachedKeyStatus!;
    })
    .catch(() => {
      statusFetchPromise = null;
      return {};
    });

  return statusFetchPromise;
}

export function invalidateKeyStatusCache() {
  cachedKeyStatus = null;
}

export function getApiKeysFromCookies(): Record<string, string> {
  const storedApiKeys = Cookies.get('apiKeys');

  if (storedApiKeys) {
    try {
      return JSON.parse(storedApiKeys);
    } catch {}
  }

  return {};
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ provider, apiKey, setApiKey }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [isEnvKeySet, setIsEnvKeySet] = useState(false);
  const [isConfigured, setIsConfigured] = useState(Boolean(apiKey));
  const [isSaving, setIsSaving] = useState(false);

  // Sync configured state from secure status endpoint
  useEffect(() => {
    fetchKeyStatus().then((configured) => {
      const isSet =
        provider.name === 'Recommended'
          ? Boolean(configured.Recommended || configured.OpenRouter)
          : Boolean(configured[provider.name]);
      setIsConfigured(isSet);
    });

    setTempKey('');
    setIsEditing(false);
  }, [provider.name]);

  const checkEnvApiKey = useCallback(async () => {
    const keyName = provider.name === 'Recommended' ? 'OpenRouter' : provider.name;
    if (providerEnvKeyStatusCache[keyName] !== undefined) {
      setIsEnvKeySet(providerEnvKeyStatusCache[keyName]);
      return;
    }

    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(keyName)}`);
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;

      providerEnvKeyStatusCache[keyName] = isSet;
      setIsEnvKeySet(isSet);
    } catch (error) {
      console.error('Failed to check environment API key:', error);
      setIsEnvKeySet(false);
    }
  }, [provider.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  const handleSave = async () => {
    const trimmed = tempKey.trim();

    if (!trimmed || trimmed === 'configured' || trimmed === 'true' || trimmed === 'false') {
      return;
    }

    setIsSaving(true);

    try {
      // Send to server: Encrypts with AES-256-GCM, stores in PocketBase, sets HttpOnly cookie
      const targetProviders = provider.name === 'Recommended' ? ['Recommended', 'OpenRouter'] : [provider.name];
      let anySuccess = false;

      for (const p of targetProviders) {
        const ok = await saveUserApiKeyToCloud(p, trimmed);
        if (ok) anySuccess = true;
      }

      if (anySuccess) {
        setIsConfigured(true);

        if (cachedKeyStatus) {
          for (const p of targetProviders) {
            cachedKeyStatus[p] = true;
          }
        }

        hasConfiguredKeysAtom.set(true);
        setApiKey(trimmed);
      }
    } finally {
      // Clear sensitive memory immediately
      setTempKey('');
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);

    try {
      const targetProviders = provider.name === 'Recommended' ? ['Recommended', 'OpenRouter'] : [provider.name];

      for (const p of targetProviders) {
        await deleteUserApiKey(p);
      }
      setIsConfigured(false);

      if (cachedKeyStatus) {
        for (const p of targetProviders) {
          cachedKeyStatus[p] = false;
        }
      }

      const hasRemaining = Object.values(cachedKeyStatus || {}).some(Boolean);
      hasConfiguredKeysAtom.set(hasRemaining);

      setApiKey('');
      setTempKey('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-bolt-elements-textSecondary">
            {provider?.name === 'Recommended' ? 'OpenRouter (Recommended)' : provider?.name} API Key:
          </span>
          {!isEditing && (
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">Configured (Encrypted)</span>
                </>
              ) : isEnvKeySet ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">Set via environment variable</span>
                </>
              ) : (
                <>
                  <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                  <span className="text-xs text-red-500">Not Set (Please set via UI or ENV_VAR)</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={tempKey}
              placeholder="Enter API Key"
              onChange={(e) => setTempKey(e.target.value)}
              className="w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor 
                        bg-bolt-elements-prompt-background text-bolt-elements-textPrimary 
                        focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
              autoFocus
            />
            <IconButton
              onClick={handleSave}
              disabled={isSaving || !tempKey.trim()}
              title="Save API Key"
              className="bg-green-500/10 hover:bg-green-500/20 text-green-500 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="i-ph:spinner animate-spin w-4 h-4" />
              ) : (
                <div className="i-ph:check w-4 h-4" />
              )}
            </IconButton>
            <IconButton
              onClick={() => {
                setTempKey('');
                setIsEditing(false);
              }}
              title="Cancel"
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
            >
              <div className="i-ph:x w-4 h-4" />
            </IconButton>
          </div>
        ) : (
          <>
            <IconButton
              onClick={() => {
                setTempKey('');
                setIsEditing(true);
              }}
              title={isConfigured ? 'Update API Key' : 'Add API Key'}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
            >
              <div className="i-ph:pencil-simple w-4 h-4" />
            </IconButton>

            {isConfigured && (
              <IconButton
                onClick={handleDelete}
                disabled={isSaving}
                title="Remove API Key"
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-50"
              >
                <div className="i-ph:trash w-4 h-4" />
              </IconButton>
            )}

            {provider?.getApiKeyLink && !isConfigured && !isEnvKeySet && (
              <IconButton
                onClick={() => window.open(provider?.getApiKeyLink)}
                title="Get API Key"
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
              >
                <span className="text-xs whitespace-nowrap">{provider?.labelForGetApiKey || 'Get API Key'}</span>
                <div className={`${provider?.icon || 'i-ph:key'} w-4 h-4`} />
              </IconButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};
