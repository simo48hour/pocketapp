import { atom } from 'nanostores';
import type { ReactNode } from 'react';

export const upgradeOpen = atom(false);

export interface BillingState {
  status: string;
  usage: number;
  limit: number;
  hasCustomer: boolean;
  periodEnd: number;
  freeRequestsLimit?: number;
  freeRequestsUsed?: number;
  freeRequestsRemaining?: number;
}

const activeState: BillingState = {
  status: 'active',
  usage: 0,
  limit: 1000,
  hasCustomer: false,
  periodEnd: 0,
  freeRequestsLimit: 999999,
  freeRequestsUsed: 0,
  freeRequestsRemaining: 999999,
};

export const billing = atom<BillingState | null>(activeState);

export async function refreshBilling() {
  billing.set(activeState);
}

export function useBilling(): BillingState {
  return activeState;
}

export function UpgradeModal() {
  return null;
}

export function ProBanner() {
  return null;
}

export function UpgradeTrigger({ children }: { children?: ReactNode }) {
  return <>{children || null}</>;
}

export function BillingCard({ isDashboard }: { isDashboard?: boolean } = {}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
          <div className="i-ph:sparkle w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Community Edition</h3>
          <p className="text-xs text-zinc-400">Open-source & self-hosted</p>
        </div>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        All models and builder capabilities are fully unlocked with Bring Your Own Keys (BYOK).
        Configure your preferred LLM providers in Settings.
      </p>
    </div>
  );
}
