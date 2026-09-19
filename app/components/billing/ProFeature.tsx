import type { ReactNode } from 'react';
import { BillingCard, useBilling } from './Billing';
export function ProFeature({ children }: { children: ReactNode }) {
  const state = useBilling();
  if (!state) return <p className="p-6 text-zinc-400">Checking subscription…</p>;
  if (state.status !== 'active') return <div className="mx-auto max-w-lg p-6"><BillingCard /></div>;
  return <>{children}</>;
}
