import { ProBanner } from '~/components/billing/Billing';
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { clearDraftChatId } from '~/lib/persistence/projectDatabase';
import { isMissingKeyModalOpen, checkHasConfiguredKeys } from '~/lib/stores/modalStore';

export const meta: MetaFunction = () => {
  return [
    { title: 'PocketApp.dev - Free Open-Source AI Full-Stack App Builder' },
    {
      name: 'description',
      content:
        'Create real full-stack web apps in seconds with AI. Free, open-source alternative to Lovable and v0. Bring Your Own Key (BYOK), embedded PocketBase database, instant in-browser testing, and 1-click publishing.',
    },
    { property: 'og:title', content: 'PocketApp.dev - Free Open-Source AI Full-Stack App Builder' },
    {
      property: 'og:description',
      content:
        'The free, open-source alternative to Lovable & v0. Build React + PocketBase apps in seconds with your own AI keys and zero monthly fees.',
    },
  ];
};

export const loader = () => json({});

/**
 * Landing page component for PocketApp
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  useEffect(() => {
    clearDraftChatId();

    checkHasConfiguredKeys().then((hasKey) => {
      if (!hasKey) {
        isMissingKeyModalOpen.set(true);
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly>{() => <ProBanner />}</ClientOnly>
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
