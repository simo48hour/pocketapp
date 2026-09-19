import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { currentUser, isAuthModalOpen, logout } from '~/lib/stores/authStore';
import { openSettings } from '~/lib/stores/settings';

export function UserProfileButton() {
  const user = useStore(currentUser);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => isAuthModalOpen.set(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor hover:border-purple-500/50 shadow-sm transition"
      >
        <div className="i-ph:user text-xs text-purple-500 dark:text-purple-400" />
        <span>Sign In</span>
      </button>
    );
  }

  const initial = (user.name || user.email || 'U')[0].toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs shadow-sm transition"
      >
        {user.avatar && !imgError ? (
          <img
            src={user.avatar}
            alt={user.name || 'User avatar'}
            onError={() => setImgError(true)}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-purple-500/40"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-purple-600 ring-1 ring-purple-400/40 flex items-center justify-center font-bold text-[10px] text-white">
            {initial}
          </div>
        )}
        <span className="max-w-[110px] truncate font-medium text-bolt-elements-textPrimary">
          {user.name || user.email.split('@')[0]}
        </span>
        <div className="i-ph:caret-down text-bolt-elements-textTertiary text-[10px]" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl py-1.5 z-50 text-xs text-bolt-elements-textPrimary animate-fade-in">
          <div className="px-3 py-2 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-2 mb-1">
              {user.avatar && !imgError ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'User avatar'}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-purple-500/40"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">
                  {initial}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="font-semibold text-bolt-elements-textPrimary truncate">{user.name || 'Developer'}</p>
                <p className="text-[11px] text-bolt-elements-textSecondary truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setDropdownOpen(false);
                openSettings();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 text-bolt-elements-textPrimary text-left transition"
            >
              <div className="i-ph:gear text-sm" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-left transition"
            >
              <div className="i-ph:sign-out text-sm" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
