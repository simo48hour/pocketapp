import { BillingCard } from '~/components/billing/Billing';
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Switch } from '~/components/ui/Switch';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { isMac } from '~/utils/os';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { currentUser, logout } from '~/lib/stores/authStore';
import { isSettingsOpenAtom, closeSettings } from '~/lib/stores/settings';

// Common timezones list including the one from user's screenshot
const TIMEZONES = [
  'Africa/Casablanca',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

// Helper to get modifier key symbols/text
const getModifierSymbol = (modifier: string): string => {
  switch (modifier) {
    case 'meta':
      return isMac ? '⌘' : 'Win';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return '⇧';
    default:
      return modifier;
  }
};

interface SimpleSettingsModalProps {
  open?: boolean;
  onClose?: () => void;
}

export function SimpleSettingsModal({ open: propsOpen, onClose: propsOnClose }: SimpleSettingsModalProps) {
  const isGlobalOpen = useStore(isSettingsOpenAtom);
  const isOpen = propsOpen !== undefined ? propsOpen : isGlobalOpen;
  const handleClose = () => {
    if (propsOnClose) {
      propsOnClose();
    }
    closeSettings();
  };

  const profile = useStore(profileStore);
  const user = useStore(currentUser);

  const [usernameInput, setUsernameInput] = useState(profile.username || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        notifications: true,
        language: 'en',
        timezone: 'UTC',
      };
    }
    try {
      const saved = localStorage.getItem('bolt_user_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      notifications: true,
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Casablanca',
    };
  });

  // Keep username input in sync with profile
  useEffect(() => {
    if (profile.username !== undefined) {
      setUsernameInput(profile.username);
    }
  }, [profile.username]);

  // Ensure current timezone is added to list if missing
  const detectedTimezone = typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'Africa/Casablanca';

  const availableTimezones = Array.from(new Set([detectedTimezone, ...TIMEZONES]));

  // Save preferences changes
  const updateSettingsField = <K extends keyof typeof settings>(field: K, value: typeof settings[K]) => {
    setSettings((prev: typeof settings) => {
      const next = { ...prev, [field]: value };
      try {
        const existing = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');
        const updated = { ...existing, ...next };
        localStorage.setItem('bolt_user_profile', JSON.stringify(updated));
      } catch (err) {
        console.error('Error saving settings to localStorage:', err);
      }
      return next;
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateProfile({ avatar: base64String });
        setIsUploadingAvatar(false);
        toast.success('Profile photo updated');
      };

      reader.onerror = () => {
        setIsUploadingAvatar(false);
        toast.error('Failed to read image file');
      };

      reader.readAsDataURL(file);
    } catch {
      setIsUploadingAvatar(false);
      toast.error('Failed to update profile photo');
    }
  };

  const handleUsernameBlur = () => {
    if (usernameInput.trim() !== profile.username) {
      updateProfile({ username: usernameInput.trim() });
      toast.success('Username updated');
    }
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100] modern-scrollbar p-3 sm:p-4">
          <RadixDialog.Overlay className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-200" />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101] w-full max-w-4xl max-h-[92vh] flex flex-col focus:outline-none"
          >
            <div
              className={classNames(
                'w-full max-h-[92vh] flex flex-col overflow-hidden',
                'bg-[#FDFDFD] dark:bg-[#0E0E10]',
                'rounded-2xl shadow-2xl',
                'border border-gray-200 dark:border-zinc-800',
                'relative',
              )}
            >
              {/* Background ambient light */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none opacity-40 dark:opacity-30">
                <BackgroundRays />
              </div>

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Back"
                    aria-label="Back"
                  >
                    <div className="i-ph:arrow-left w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <RadixDialog.Title className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Settings
                  </RadixDialog.Title>
                </div>

                <div className="flex items-center gap-4">
                  {/* Top-Right Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
                    {profile.avatar || user?.avatar ? (
                      <img
                        src={profile.avatar || user?.avatar}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="i-ph:user text-lg text-gray-500 dark:text-gray-400" />
                    )}
                  </div>

                  {/* Close button */}
                  <button
                    onClick={handleClose}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <div className="i-ph:x w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-5 modern-scrollbar">
                <BillingCard />
                {/* Profile Card */}
                <motion.div
                  className="bg-white dark:bg-[#141417] rounded-xl border border-gray-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="i-ph:user-circle-fill w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">Profile</span>
                    </div>
                    {user && (
                      <button
                        onClick={() => {
                          logout();
                          toast.info('Signed out');
                        }}
                        className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 font-medium transition"
                      >
                        <div className="i-ph:sign-out text-xs" />
                        <span>Sign Out ({user.email})</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-1">
                    {/* Avatar preview and upload */}
                    <div className="relative group shrink-0">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 border-2 border-purple-500/30 flex items-center justify-center">
                        {profile.avatar || user?.avatar ? (
                          <img
                            src={profile.avatar || user?.avatar}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="i-ph:user w-8 h-8 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Upload Photo"
                      >
                        {isUploadingAvatar ? (
                          <div className="i-ph:spinner-gap w-5 h-5 animate-spin" />
                        ) : (
                          <div className="i-ph:camera w-5 h-5" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>

                    {/* Username Input */}
                    <div className="flex-1 w-full space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Display Name
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            onBlur={handleUsernameBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUsernameBlur();
                              }
                            }}
                            placeholder="Guest User"
                            className={classNames(
                              'w-full px-3.5 py-2 rounded-lg text-sm',
                              'bg-[#FAFAFA] dark:bg-[#1A1A1E]',
                              'border border-gray-200 dark:border-zinc-700/80',
                              'text-gray-900 dark:text-white',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500',
                              'transition-all duration-150',
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 transition"
                        >
                          Change Photo
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Preferences Card */}
                <motion.div
                  className="bg-white dark:bg-[#141417] rounded-xl border border-gray-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-5"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="i-ph:palette-fill w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Preferences</span>
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="i-ph:translate-fill w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Language</label>
                    </div>
                    <select
                      value={settings.language || 'en'}
                      onChange={(e) => {
                        updateSettingsField('language', e.target.value);
                        toast.success('Language preference saved');
                      }}
                      className={classNames(
                        'w-full px-3.5 py-2.5 rounded-lg text-sm',
                        'bg-[#FAFAFA] dark:bg-[#1A1A1E]',
                        'border border-gray-200 dark:border-zinc-700/80',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500',
                        'transition-all duration-150 cursor-pointer',
                      )}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="it">Italiano</option>
                      <option value="pt">Português</option>
                      <option value="ru">Русский</option>
                      <option value="zh">中文</option>
                      <option value="ja">日本語</option>
                      <option value="ko">한국어</option>
                      <option value="ar">العربية</option>
                    </select>
                  </div>

                  {/* Notifications */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="i-ph:bell-fill w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Notifications</label>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {settings.notifications ? 'Notifications are enabled' : 'Notifications are disabled'}
                      </span>
                      <Switch
                        checked={settings.notifications}
                        onCheckedChange={(checked) => {
                          updateSettingsField('notifications', checked);
                          toast.success(`Notifications ${checked ? 'enabled' : 'disabled'}`);
                        }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Time Settings Card */}
                <motion.div
                  className="bg-white dark:bg-[#141417] rounded-xl border border-gray-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="i-ph:clock-fill w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Time Settings</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="i-ph:globe-fill w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Timezone</label>
                    </div>
                    <select
                      value={settings.timezone || detectedTimezone}
                      onChange={(e) => {
                        updateSettingsField('timezone', e.target.value);
                        toast.success('Timezone preference saved');
                      }}
                      className={classNames(
                        'w-full px-3.5 py-2.5 rounded-lg text-sm',
                        'bg-[#FAFAFA] dark:bg-[#1A1A1E]',
                        'border border-gray-200 dark:border-zinc-700/80',
                        'text-gray-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500',
                        'transition-all duration-150 cursor-pointer',
                      )}
                    >
                      {availableTimezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>

                {/* Keyboard Shortcuts Card */}
                <motion.div
                  className="bg-white dark:bg-[#141417] rounded-xl border border-gray-200/80 dark:border-zinc-800/80 shadow-sm p-5 space-y-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.15 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="i-ph:keyboard-fill w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAFA] dark:bg-[#1A1A1E] border border-gray-100 dark:border-zinc-800/60">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Toggle Theme</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark mode</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-sm">
                        {getModifierSymbol('meta')}
                      </kbd>
                      <kbd className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-sm">
                        {getModifierSymbol('alt')}
                      </kbd>
                      <kbd className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-sm">
                        {getModifierSymbol('shift')}
                      </kbd>
                      <kbd className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-sm">
                        D
                      </kbd>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export default SimpleSettingsModal;
