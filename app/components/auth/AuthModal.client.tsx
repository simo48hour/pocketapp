import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  isAuthModalOpen,
  loginWithPassword,
  registerWithPassword,
  loginWithOAuth,
  authProvidersState,
  fetchAvailableAuthProviders,
  triggerAuthSuccess,
} from '~/lib/stores/authStore';
import { trackAuthEvent } from '~/utils/plausible';

export function AuthModal() {
  const isOpen = useStore(isAuthModalOpen);
  const providers = useStore(authProvidersState);
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableAuthProviders().catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearErrors = () => {
    setEmailError('');
    setOauthError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      if (tab === 'signin') {
        await loginWithPassword(email, password);
        trackAuthEvent('sign_in', { method: 'password' });
      } else {
        if (password !== passwordConfirm) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        await registerWithPassword(email, password, passwordConfirm, name);
        trackAuthEvent('sign_up', { method: 'password' });
      }
      isAuthModalOpen.set(false);
      triggerAuthSuccess();
    } catch (err: any) {
      console.warn('[AuthModal] Login error:', err);
      const isConnectionRefused =
        err?.status === 0 ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('load failed');

      if (isConnectionRefused) {
        setEmailError(
          'Could not connect to database server at http://localhost:8090. Make sure PocketBase is running locally (e.g. docker compose up -d platform-db) or set VITE_POCKETBASE_URL in .env.local.',
        );
      } else if (err?.status === 400) {
        setEmailError(
          tab === 'signin'
            ? 'Failed to authenticate. Please verify your email and password, or create an account.'
            : err?.data?.message || err?.message || 'Failed to create account. Please try again.',
        );
      } else {
        setEmailError(err?.data?.message || err?.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    clearErrors();
    setLoading(true);
    try {
      await loginWithOAuth(provider);
      trackAuthEvent('sign_in', { method: provider });
      isAuthModalOpen.set(false);
      triggerAuthSuccess();
    } catch (err: any) {
      const detailed =
        err?.data?.data?.provider?.message ||
        err?.response?.data?.provider?.message ||
        err?.data?.message ||
        err?.response?.message ||
        err?.message ||
        `OAuth login with ${provider} failed`;
      setOauthError(detailed);
    } finally {
      setLoading(false);
    }
  };

  const isGoogleMissingError =
    !providers?.google ||
    oauthError.toLowerCase().includes('missing or invalid') ||
    oauthError.toLowerCase().includes('provider') ||
    oauthError.toLowerCase().includes('oauth2');

  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/oauth2-redirect`
      : 'http://localhost:5173/api/oauth2-redirect';

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl p-6 shadow-2xl text-bolt-elements-textPrimary transition-colors">
        {/* Close Button */}
        <button
          onClick={() => isAuthModalOpen.set(false)}
          className="absolute top-4 right-4 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary p-1.5 rounded-lg hover:bg-bolt-elements-background-depth-3 transition"
          aria-label="Close modal"
        >
          <div className="i-ph:x text-lg" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-bold text-bolt-elements-textPrimary">
              {tab === 'signup' ? 'Create Free Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-bolt-elements-textSecondary">
              {tab === 'signup'
                ? 'Sign up to start building full-stack web apps with AI'
                : 'Sign in to access your projects and BYOK API keys'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-bolt-elements-background-depth-1 p-1 mb-5 border border-bolt-elements-borderColor">
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              clearErrors();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              tab === 'signup'
                ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary shadow-sm'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              clearErrors();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              tab === 'signin'
                ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary shadow-sm'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* OAuth Actions */}
        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:border-purple-500/40 rounded-xl text-xs font-medium text-bolt-elements-textPrimary shadow-sm transition disabled:opacity-50 group"
          >
            {/* Official 4-color Google G Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          {/* Setup Guide Box when Google provider credentials need activation */}
          {oauthError && isGoogleMissingError && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <div className="i-ph:gear-six text-sm" />
                <span>Google OAuth Credentials Required</span>
              </div>
              <p className="text-[11px] leading-relaxed text-bolt-elements-textSecondary">
                To activate Google Sign-In, add your OAuth Client ID & Secret to PocketBase or run{' '}
                <code className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary font-mono text-[10px]">
                  ./scripts/setup-google-oauth.sh
                </code>
                .
              </p>
              <div className="pt-1">
                <div className="text-[10px] text-bolt-elements-textTertiary mb-1">Authorized Redirect URI:</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={redirectUri}
                    className="flex-1 px-2 py-1 text-[11px] font-mono bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary select-all"
                  />
                  <button
                    type="button"
                    onClick={copyRedirectUri}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition shrink-0 flex items-center gap-1"
                  >
                    {copiedRedirectUri ? (
                      <>
                        <div className="i-ph:check text-green-500 text-xs" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <div className="i-ph:copy text-xs" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Standard OAuth Error Notice */}
          {oauthError && !isGoogleMissingError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
              {oauthError}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-bolt-elements-borderColor w-full" />
          <span className="bg-bolt-elements-background-depth-2 px-2 text-[10px] uppercase font-semibold tracking-wider text-bolt-elements-textTertiary absolute">
            Or with email
          </span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Your Name</label>
              <input
                type="text"
                required
                placeholder="Alex Developer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          )}

          {/* Email/Password Error Notice */}
          {emailError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <div className="i-ph:warning-circle text-base shrink-0 mt-0.5" />
              <span className="leading-relaxed">{emailError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold text-sm transition shadow-lg shadow-violet-500/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}
          >
            {loading && <div className="i-ph:spinner animate-spin text-base" />}
            <span>{tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
