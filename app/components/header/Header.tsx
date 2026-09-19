import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { ApiKeyHeaderButton } from './ApiKeyHeaderButton';

import { toggleSidebar } from '~/lib/stores/sidebar';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('site-header relative z-20 flex items-center px-4 border-b h-[var(--header-height)] backdrop-blur-md transition-colors', {
        'border-transparent': !chat.started,
        'border-zinc-200 dark:border-zinc-800/80': chat.started,
      })}
    >
      <div className="flex items-center gap-3 z-logo text-bolt-elements-textPrimary">
        <button
          type="button"
          aria-label="Toggle sidebar menu"
          onClick={() => toggleSidebar()}
          className="site-header-menu p-1 rounded-md transition focus:outline-none"
        >
          <div className="i-ph:sidebar-simple-duotone text-lg" />
        </button>
        <a href="/" className="site-header-brand flex items-center gap-2.5 font-bold tracking-tight transition hover:opacity-90">
          <img
            src="/logo-dark.png"
            alt="PocketApp.dev"
            className="logo-dark h-7 sm:h-8 w-auto object-contain hidden dark:block"
          />
          <img
            src="/logo-light.png"
            alt="PocketApp.dev"
            className="logo-light h-7 sm:h-8 w-auto object-contain block dark:hidden"
          />
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[0_0_8px_rgba(139,92,246,0.15)]">
            v0.1-beta
          </span>
        </a>
      </div>
      {chat.started && (
        <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
          <ClientOnly>{() => <ChatDescription />}</ClientOnly>
        </span>
      )}
      <div className="ml-auto flex items-center gap-3">
        {chat.started && (
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        )}
        <ClientOnly>{() => <ApiKeyHeaderButton />}</ClientOnly>
      </div>
    </header>
  );
}
