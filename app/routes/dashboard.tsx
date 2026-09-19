import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BillingCard, billing, refreshBilling } from '~/components/billing/Billing';
import { Header } from '~/components/header/Header';
function DashboardBilling() {
  const [pending, setPending] = useState(new URLSearchParams(window.location.search).has('session_id'));
  useEffect(() => {
    if (!pending) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      await refreshBilling().catch(() => {});
      if (billing.get()?.status === 'active') { setPending(false); clearInterval(timer); }
      if (++attempts >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [pending]);
  return (
    <>
      {pending && (
        <p role="status" className="mb-5 text-sm font-medium text-violet-600 dark:text-violet-300">
          Confirming your subscription and preparing AI credits. This can take a moment; refresh if it stays pending.
        </p>
      )}
      <BillingCard isDashboard />
    </>
  );
}
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <Header />
      <main className="mx-auto max-w-xl px-5 py-12">
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <h1 className="mb-6 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Your subscription
          </h1>
          <ClientOnly>{() => <DashboardBilling />}</ClientOnly>
        </div>
      </main>
    </div>
  );
}

