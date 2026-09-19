import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import {
  BarChart3,
  ExternalLink,
  RefreshCw,
  Rocket,
  Maximize2,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  X,
  ChevronDown,
} from 'lucide-react';
import { useParams } from '@remix-run/react';
import { chatId } from '~/lib/persistence/chatId';
import { pb } from '~/lib/auth/pocketbase';
import { classNames } from '~/utils/classNames';

export interface MetricItem {
  name: string;
  code?: string;
  count: number;
  percentage: number;
}

interface AnalyticsData {
  published: boolean;
  slug?: string;
  subdomain?: string;
  url?: string;
  websiteId?: string | null;
  message?: string;
  stats?: {
    pageviews: number;
    pageviewsPrev: number;
    visitors: number;
    visitorsPrev: number;
    visits: number;
    visitsPrev: number;
    bounces: number;
    bouncesPrev: number;
    bounceRate: number;
    bounceRatePrev: number;
    totaltime: number;
    avgVisitDuration: string;
    avgVisitDurationSeconds: number;
  };
  chart?: Array<{
    date: string;
    timestamp?: number;
    label: string;
    fullDate?: string;
    showLabel?: boolean;
    pageviews: number;
    visitors: number;
  }>;
  pages?: {
    path: MetricItem[];
    url: MetricItem[];
    entry: MetricItem[];
    exit: MetricItem[];
  };
  sources?: {
    referrers: MetricItem[];
    channels: MetricItem[];
  };
  environment?: {
    browsers: MetricItem[];
    os: MetricItem[];
    devices: MetricItem[];
  };
  location?: {
    countries: MetricItem[];
    regions: MetricItem[];
    cities: MetricItem[];
  };
  topCountries?: MetricItem[];
  topReferrers?: MetricItem[];
  range?: string;
}

/** Flag emoji from 2-letter ISO country code */
function getCountryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  try {
    const code = countryCode.toUpperCase();
    const first = code.charCodeAt(0) - 65 + 0x1f1e6;
    const second = code.charCodeAt(1) - 65 + 0x1f1e6;
    return String.fromCodePoint(first, second);
  } catch {
    return '🌐';
  }
}

/** SVG icons matching browser brands */
const BrowserIcon: React.FC<{ name: string }> = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('chrome')) {
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#4285F4" />
        <circle cx="12" cy="12" r="5" fill="#ffffff" />
        <circle cx="12" cy="12" r="3.5" fill="#4285F4" />
        <path d="M12 2a10 10 0 0 1 8.66 5H12z" fill="#EA4335" />
        <path d="M20.66 7A10 10 0 0 1 12 22l4.33-7.5z" fill="#FBBC05" />
        <path d="M12 22A10 10 0 0 1 3.34 7L12 12z" fill="#34A853" />
      </svg>
    );
  }
  if (n.includes('safari')) {
    return (
      <svg className="w-3.5 h-3.5 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#0284c7" />
        <polygon points="12,4 15,12 12,20 9,12" fill="#ffffff" />
        <polygon points="12,4 15,12 12,12" fill="#ef4444" />
      </svg>
    );
  }
  if (n.includes('firefox')) {
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="#f97316">
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  }
  if (n.includes('edge')) {
    return (
      <svg className="w-3.5 h-3.5 shrink-0 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="#0891b2" />
      </svg>
    );
  }
  return <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
};

/** OS icon */
const OsIcon: React.FC<{ name: string }> = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('mac') || n.includes('ios') || n.includes('apple')) {
    return (
      <svg className="w-3.5 h-3.5 text-zinc-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.92.04-2.02.61-2.67 1.38-.58.68-1.09 1.77-.95 2.82 1.02.08 2.06-.5 2.68-1.27z" />
      </svg>
    );
  }
  if (n.includes('win')) {
    return (
      <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.951-1.8" />
      </svg>
    );
  }
  if (n.includes('android')) {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  return <Monitor className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
};

/** Device icon */
const DeviceIcon: React.FC<{ name: string }> = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('mobile') || n.includes('phone')) {
    return <Smartphone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  }
  if (n.includes('tablet') || n.includes('ipad')) {
    return <Tablet className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  }
  return <Laptop className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
};

export const AnalyticsViewer: React.FC = () => {
  const params = useParams();
  const currentChatId = useStore(chatId);

  // Extract chat ID from URL path synchronously so initial render on refresh has project identity
  const urlChatId = useMemo(() => {
    if (params?.id) return params.id;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/chat\/([^\/?#]+)/);
      return match ? match[1] : undefined;
    }
    return undefined;
  }, [params?.id]);

  // Unified project identity: strictly the active workspace chat id
  const effectiveProjectId = currentChatId || urlChatId || '';

  // Get project database ID from localStorage scoped to this project
  const projectDatabaseId = useMemo(() => {
    if (!effectiveProjectId || typeof window === 'undefined') return '';
    try {
      const stored = localStorage.getItem(`pocketapp_project_db:${effectiveProjectId}`);
      return stored ? JSON.parse(stored)?.id || '' : '';
    } catch {
      return '';
    }
  }, [effectiveProjectId]);

  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Active tabs inside the 4 widgets
  const [pagesTab, setPagesTab] = useState<'path' | 'url' | 'entry' | 'exit'>('path');
  const [sourcesTab, setSourcesTab] = useState<'referrers' | 'channels'>('referrers');
  const [envTab, setEnvTab] = useState<'browsers' | 'os' | 'devices'>('browsers');
  const [locationTab, setLocationTab] = useState<'countries' | 'regions' | 'cities'>('countries');

  // Modal dialog for "More" expansion
  const [moreModalData, setMoreModalData] = useState<{ title: string; items: MetricItem[] } | null>(null);

  const fetchAnalytics = useCallback(
    async (showLoader: boolean = true) => {
      if (!effectiveProjectId) return;
      if (showLoader) setIsLoading(true);

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const query = new URLSearchParams({ range, timezone });
        if (projectDatabaseId) {
          query.set('databaseId', projectDatabaseId);
        }

        const headers: Record<string, string> = {};
        if (pb.authStore?.token) {
          headers['Authorization'] = pb.authStore.token;
        }

        const res = await fetch(
          `/api/projects/${encodeURIComponent(effectiveProjectId)}/analytics?${query.toString()}`,
          {
            headers,
          },
        );

        if (res.ok) {
          const result = (await res.json()) as AnalyticsData;
          setData(result);
        } else {
          setData({ published: false });
        }
      } catch (err) {
        console.warn('[AnalyticsViewer] Failed to load analytics:', err);
        setData({ published: false });
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveProjectId, projectDatabaseId, range],
  );

  useEffect(() => {
    if (effectiveProjectId) {
      fetchAnalytics(true);
    }
  }, [fetchAnalytics, effectiveProjectId]);

  useEffect(() => {
    const handleDeployed = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId?: string }>;
      if (!customEvent.detail?.projectId || customEvent.detail.projectId === effectiveProjectId) {
        fetchAnalytics(false);
      }
    };

    window.addEventListener('pocketapp-deployed', handleDeployed);
    return () => {
      window.removeEventListener('pocketapp-deployed', handleDeployed);
    };
  }, [effectiveProjectId, fetchAnalytics]);

  // Calculations for trend badges (matching Umami styling)
  const calcTrend = (current: number, prev: number) => {
    if (prev === 0) {
      return current > 0 ? { text: '↑ 100%', isPositive: true } : { text: '0%', isPositive: false };
    }
    const diff = Math.round(((current - prev) / prev) * 100);
    return {
      text: `${diff >= 0 ? '↑ ' : '↓ '}${Math.abs(diff)}%`,
      isPositive: diff >= 0,
    };
  };

  const visitorsTrend = useMemo(() => {
    if (!data?.stats) return { text: '0%', isPositive: false };
    return calcTrend(data.stats.visitors, data.stats.visitorsPrev || 0);
  }, [data?.stats]);

  const visitsTrend = useMemo(() => {
    if (!data?.stats) return { text: '0%', isPositive: false };
    return calcTrend(data.stats.visits, data.stats.visitsPrev || 0);
  }, [data?.stats]);

  const viewsTrend = useMemo(() => {
    if (!data?.stats) return { text: '0%', isPositive: false };
    return calcTrend(data.stats.pageviews, data.stats.pageviewsPrev || 0);
  }, [data?.stats]);

  const bounceTrend = useMemo(() => {
    if (!data?.stats) return { text: '0%', isPositive: false };
    const diff = data.stats.bounceRate - (data.stats.bounceRatePrev || 0);
    return {
      text: `${diff > 0 ? '↑ ' : diff < 0 ? '↓ ' : ''}${Math.abs(diff)}%`,
      isPositive: diff <= 0,
    };
  }, [data?.stats]);

  const durationTrend = useMemo(() => {
    return { text: '0%', isPositive: false };
  }, []);

  // Chart data calculations
  const chartSeries = data?.chart || [];
  const maxMetricVal = useMemo(() => {
    if (!chartSeries.length) return 3;
    const maxVal = Math.max(...chartSeries.map((c) => Math.max(c.visitors, c.pageviews)), 0);
    return maxVal > 0 ? maxVal : 3;
  }, [chartSeries]);

  // Compute clean Y-axis tick values
  const yTicks = useMemo(() => {
    const rawMax = Math.max(...chartSeries.map((c) => Math.max(c.visitors, c.pageviews)), 0);
    if (rawMax <= 3) return [3, 2, 1, 0];
    if (rawMax <= 5) return [5, 4, 3, 2, 1, 0];
    if (rawMax <= 10) {
      const top = Math.ceil(rawMax);
      const ticks: number[] = [];
      for (let i = top; i >= 0; i--) {
        ticks.push(i);
      }
      return ticks;
    }
    const stepTarget = rawMax / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(stepTarget)));
    const norm = stepTarget / mag;
    let step = 10 * mag;
    if (norm <= 1) step = 1 * mag;
    else if (norm <= 2) step = 2 * mag;
    else if (norm <= 5) step = 5 * mag;

    const top = Math.ceil(rawMax / step) * step;
    const ticks: number[] = [];
    for (let v = top; v >= 0; v -= step) {
      ticks.push(v);
    }
    return ticks;
  }, [chartSeries]);

  const chartMaxVal = useMemo(() => yTicks[0] || 3, [yTicks]);

  return (
    <div className="h-full flex flex-col bg-[#09090b] text-zinc-100 overflow-y-auto select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-[#27272a] bg-[#121214] gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-[#18181b] border border-[#27272a] text-blue-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">Analytics</span>
              {data?.published && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            {data?.published && data.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-400 transition-colors mt-0.5"
              >
                <span>{data.subdomain || data.slug}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Range Picker */}
          <div className="inline-flex rounded-md p-0.5 bg-[#18181b] border border-[#27272a] text-xs">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={classNames(
                  'px-2.5 py-1 rounded transition-all font-medium cursor-pointer border-0 outline-none text-xs',
                  range === r
                    ? 'bg-[#27272a] text-white shadow-sm'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isLoading}
            title="Refresh statistics"
            className="p-1.5 rounded-md border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={classNames('w-4 h-4', isLoading && 'animate-spin text-blue-400')} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 space-y-5 max-w-7xl mx-auto w-full">
        {/* Loading Skeleton */}
        {isLoading && !data && (
          <div className="space-y-5 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-[#18181b] border border-[#27272a] p-4" />
              ))}
            </div>
            <div className="h-72 rounded-lg bg-[#18181b] border border-[#27272a]" />
          </div>
        )}

        {/* Empty State: App not published yet */}
        {!isLoading && (!data || !data.published) && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 shadow-lg shadow-blue-500/5">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight mb-2">
              Deploy your app to view live analytics
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Export your project with Docker Compose or deploy to your preferred server to track visitors, pageviews, and performance in real time.
            </p>
          </div>
        )}

        {/* Active Analytics View */}
        {data && data.published && (
          <>
            {/* 5 Metric Cards matching Screenshot 2 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Card 1: Visitors */}
              <div className="p-4 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
                <div className="text-xs font-semibold text-zinc-300">Visitors</div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  {data.stats?.visitors.toLocaleString() || 0}
                </div>
                <div
                  className={classNames(
                    'mt-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                    visitorsTrend.isPositive
                      ? 'bg-[#132d21] text-[#22c55e] border-emerald-900/40'
                      : 'bg-[#301717] text-[#f87171] border-rose-900/40',
                  )}
                >
                  {visitorsTrend.text}
                </div>
              </div>

              {/* Card 2: Visits */}
              <div className="p-4 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
                <div className="text-xs font-semibold text-zinc-300">Visits</div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  {data.stats?.visits.toLocaleString() || 0}
                </div>
                <div
                  className={classNames(
                    'mt-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                    visitsTrend.isPositive
                      ? 'bg-[#132d21] text-[#22c55e] border-emerald-900/40'
                      : 'bg-[#301717] text-[#f87171] border-rose-900/40',
                  )}
                >
                  {visitsTrend.text}
                </div>
              </div>

              {/* Card 3: Views */}
              <div className="p-4 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
                <div className="text-xs font-semibold text-zinc-300">Views</div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  {data.stats?.pageviews.toLocaleString() || 0}
                </div>
                <div
                  className={classNames(
                    'mt-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                    viewsTrend.isPositive
                      ? 'bg-[#132d21] text-[#22c55e] border-emerald-900/40'
                      : 'bg-[#301717] text-[#f87171] border-rose-900/40',
                  )}
                >
                  {viewsTrend.text}
                </div>
              </div>

              {/* Card 4: Bounce rate */}
              <div className="p-4 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
                <div className="text-xs font-semibold text-zinc-300">Bounce rate</div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  {data.stats ? `${data.stats.bounceRate}%` : '0%'}
                </div>
                <div
                  className={classNames(
                    'mt-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                    bounceTrend.isPositive
                      ? 'bg-[#132d21] text-[#22c55e] border-emerald-900/40'
                      : 'bg-[#301717] text-[#f87171] border-rose-900/40',
                  )}
                >
                  {bounceTrend.text}
                </div>
              </div>

              {/* Card 5: Visit duration */}
              <div className="p-4 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
                <div className="text-xs font-semibold text-zinc-300">Visit duration</div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                  {data.stats?.avgVisitDuration || '0s'}
                </div>
                <div
                  className={classNames(
                    'mt-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border',
                    durationTrend.isPositive
                      ? 'bg-[#132d21] text-[#22c55e] border-emerald-900/40'
                      : 'bg-[#301717] text-[#f87171] border-rose-900/40',
                  )}
                >
                  {durationTrend.text}
                </div>
              </div>
            </div>

            {/* Bar Chart matching Umami panel */}
            <div className="p-5 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm">
              {/* Granularity dropdown matching Screenshot 3 */}
              <div className="flex items-center justify-end mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[#18181b] border border-[#27272a] text-zinc-300 shadow-xs">
                  <span>{range === '24h' ? 'Hour' : 'Day'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </div>
              </div>

              <div className="relative h-56 w-full flex">
                {/* Left Y-axis labels */}
                <div className="w-8 h-full flex flex-col justify-between items-end pr-3 text-[11px] text-zinc-500 font-mono select-none">
                  {yTicks.map((val, idx) => (
                    <span key={idx} className="leading-none">
                      {val}
                    </span>
                  ))}
                </div>

                {/* Chart body with horizontal grid lines and stacked bars */}
                <div className="flex-1 relative h-full flex flex-col justify-between">
                  {/* Horizontal grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {yTicks.map((_, idx) => (
                      <div key={idx} className="border-b border-[#27272a]/60 w-full h-0" />
                    ))}
                  </div>

                  {/* Columns container with evenly distributed slots */}
                  <div className="absolute inset-0 flex items-end justify-between px-2">
                    {chartSeries.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                        No traffic recorded in this timeframe yet
                      </div>
                    ) : (
                      chartSeries.map((item, index) => {
                        const isHovered = hoveredBarIndex === index;
                        const totalVal = Math.max(item.pageviews, item.visitors);
                        const totalHeightPct = chartMaxVal > 0 ? (totalVal / chartMaxVal) * 100 : 0;
                        const visitorsPct = totalVal > 0 ? (item.visitors / totalVal) * 100 : 0;

                        // Responsive max-width per bar based on density
                        const barWidthClass =
                          range === '7d'
                            ? 'max-w-[36px] sm:max-w-[48px]'
                            : range === '24h'
                              ? 'max-w-[14px] sm:max-w-[20px]'
                              : 'max-w-[10px] sm:max-w-[14px]';

                        return (
                          <div
                            key={item.date || index}
                            onMouseEnter={() => setHoveredBarIndex(index)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            className="flex-1 h-full flex flex-col justify-end items-center relative cursor-pointer group"
                          >
                            {/* Hover Tooltip */}
                            {isHovered && (
                              <div className="absolute -top-14 z-30 px-3 py-2 rounded-lg bg-[#18181b] border border-[#3f3f46] text-xs shadow-2xl pointer-events-none whitespace-nowrap">
                                <div className="font-semibold text-white mb-1">{item.fullDate || item.label}</div>
                                <div className="flex items-center gap-3 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                                    <span className="text-zinc-300 font-medium">{item.visitors} visitors</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#1e40af]" />
                                    <span className="text-zinc-300 font-medium">{item.pageviews} views</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Stacked Bar */}
                            <div
                              className={classNames('w-full h-full flex flex-col justify-end relative', barWidthClass)}
                            >
                              {totalHeightPct > 0 && (
                                <div
                                  style={{ height: `${totalHeightPct}%` }}
                                  className={classNames(
                                    'w-full bg-[#1e40af] transition-all duration-200 rounded-t-xs relative overflow-hidden',
                                    isHovered && 'brightness-125',
                                  )}
                                >
                                  {/* Visitors segment at bottom of the bar */}
                                  {visitorsPct > 0 && (
                                    <div
                                      style={{ height: `${visitorsPct}%` }}
                                      className="w-full bg-[#2563eb] absolute bottom-0 left-0 transition-all duration-200"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom X-axis labels perfectly aligned to each column */}
                  <div className="absolute -bottom-7 inset-x-0 flex items-center justify-between px-2 text-[11px] text-zinc-500 font-medium select-none pointer-events-none">
                    {chartSeries.map((item, idx) => (
                      <div key={idx} className="flex-1 flex justify-center text-center relative">
                        {item.showLabel && (
                          <span className="absolute whitespace-nowrap -translate-x-1/2 left-1/2 text-zinc-400">
                            {item.label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart Legend at bottom center matching Screenshot 2 */}
              <div className="mt-8 pt-3 flex items-center justify-center gap-6 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  <span className="font-medium text-zinc-300">Visitors</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1e40af]" />
                  <span className="font-medium text-zinc-300">Views</span>
                </div>
              </div>
            </div>

            {/* 4 Breakdown Widgets matching Screenshots 3 & 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Widget 1: Pages (Screenshot 4) */}
              <div className="p-5 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm flex flex-col">
                <h4 className="text-base font-bold text-white mb-2">Pages</h4>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-[#27272a] mb-4 text-xs">
                  {(
                    [
                      { id: 'path', label: 'Path' },
                      { id: 'url', label: 'URL' },
                      { id: 'entry', label: 'Entry page' },
                      { id: 'exit', label: 'Exit page' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPagesTab(t.id)}
                      className={classNames(
                        'pb-2 px-1 bg-transparent border-0 border-b-2 transition-all cursor-pointer font-medium outline-none text-xs',
                        pagesTab === t.id
                          ? 'text-white border-blue-500 -mb-px font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Table Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-2 pb-2">
                  <span className="capitalize">{pagesTab === 'path' || pagesTab === 'url' ? 'Path' : pagesTab}</span>
                  <span>Visitors</span>
                </div>

                {/* Table Rows */}
                {(() => {
                  const items = data.pages?.[pagesTab] || [];
                  if (items.length === 0) {
                    return (
                      <div className="flex items-center justify-center flex-1 py-12 text-zinc-500 text-xs">
                        No data available.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1 flex-1">
                      {items.slice(0, 8).map((row, idx) => (
                        <div
                          key={idx}
                          className="relative flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-[#18181b] transition-colors group overflow-hidden"
                        >
                          {/* Background progress bar */}
                          <div
                            style={{ width: `${row.percentage}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded transition-all duration-300"
                          />
                          <span className="relative font-mono text-zinc-200 truncate max-w-[240px] sm:max-w-[320px]">
                            {row.name}
                          </span>
                          <div className="relative flex items-center gap-3 font-mono text-zinc-300">
                            <span>{row.count}</span>
                            <span className="text-[11px] text-zinc-500 w-9 text-right">{row.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* More button */}
                <div className="mt-3 pt-2 border-t border-[#27272a]/50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setMoreModalData({
                        title: `Pages — ${pagesTab.toUpperCase()}`,
                        items: data.pages?.[pagesTab] || [],
                      })
                    }
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-transparent border-0 outline-none transition-colors cursor-pointer py-1 font-medium hover:underline"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>More</span>
                  </button>
                </div>
              </div>

              {/* Widget 2: Sources (Screenshot 4) */}
              <div className="p-5 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm flex flex-col">
                <h4 className="text-base font-bold text-white mb-2">Sources</h4>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-[#27272a] mb-4 text-xs">
                  {(
                    [
                      { id: 'referrers', label: 'Referrers' },
                      { id: 'channels', label: 'Channels' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSourcesTab(t.id)}
                      className={classNames(
                        'pb-2 px-1 bg-transparent border-0 border-b-2 transition-all cursor-pointer font-medium outline-none text-xs',
                        sourcesTab === t.id
                          ? 'text-white border-blue-500 -mb-px font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Table Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-2 pb-2">
                  <span>{sourcesTab === 'referrers' ? 'Referrer' : 'Channel'}</span>
                  <span>Visitors</span>
                </div>

                {/* Table Rows */}
                {(() => {
                  const items = data.sources?.[sourcesTab] || [];
                  if (items.length === 0) {
                    return (
                      <div className="flex items-center justify-center flex-1 py-12 text-zinc-500 text-xs">
                        No data available.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1 flex-1">
                      {items.slice(0, 8).map((row, idx) => (
                        <div
                          key={idx}
                          className="relative flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-[#18181b] transition-colors group overflow-hidden"
                        >
                          <div
                            style={{ width: `${row.percentage}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded transition-all duration-300"
                          />
                          <span className="relative text-zinc-200 truncate max-w-[240px] sm:max-w-[320px]">
                            {row.name}
                          </span>
                          <div className="relative flex items-center gap-3 font-mono text-zinc-300">
                            <span>{row.count}</span>
                            <span className="text-[11px] text-zinc-500 w-9 text-right">{row.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* More button */}
                <div className="mt-3 pt-2 border-t border-[#27272a]/50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setMoreModalData({
                        title: `Sources — ${sourcesTab.toUpperCase()}`,
                        items: data.sources?.[sourcesTab] || [],
                      })
                    }
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-transparent border-0 outline-none transition-colors cursor-pointer py-1 font-medium hover:underline"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>More</span>
                  </button>
                </div>
              </div>

              {/* Widget 3: Environment (Screenshot 3) */}
              <div className="p-5 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm flex flex-col">
                <h4 className="text-base font-bold text-white mb-2">Environment</h4>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-[#27272a] mb-4 text-xs">
                  {(
                    [
                      { id: 'browsers', label: 'Browsers' },
                      { id: 'os', label: 'OS' },
                      { id: 'devices', label: 'Devices' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEnvTab(t.id)}
                      className={classNames(
                        'pb-2 px-1 bg-transparent border-0 border-b-2 transition-all cursor-pointer font-medium outline-none text-xs',
                        envTab === t.id
                          ? 'text-white border-blue-500 -mb-px font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Table Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-2 pb-2">
                  <span className="capitalize">
                    {envTab === 'browsers' ? 'Browser' : envTab === 'os' ? 'OS' : 'Device'}
                  </span>
                  <span>Visitors</span>
                </div>

                {/* Table Rows */}
                {(() => {
                  const items = data.environment?.[envTab] || [];
                  if (items.length === 0) {
                    return (
                      <div className="flex items-center justify-center flex-1 py-12 text-zinc-500 text-xs">
                        No data available.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1 flex-1">
                      {items.slice(0, 8).map((row, idx) => (
                        <div
                          key={idx}
                          className="relative flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-[#18181b] transition-colors group overflow-hidden"
                        >
                          <div
                            style={{ width: `${row.percentage}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded transition-all duration-300"
                          />
                          <div className="relative flex items-center gap-2 truncate max-w-[240px] sm:max-w-[320px]">
                            {envTab === 'browsers' && <BrowserIcon name={row.name} />}
                            {envTab === 'os' && <OsIcon name={row.name} />}
                            {envTab === 'devices' && <DeviceIcon name={row.name} />}
                            <span className="text-zinc-200 font-medium truncate">{row.name}</span>
                          </div>
                          <div className="relative flex items-center gap-3 font-mono text-zinc-300">
                            <span>{row.count}</span>
                            <span className="text-[11px] text-zinc-500 w-9 text-right">{row.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* More button */}
                <div className="mt-3 pt-2 border-t border-[#27272a]/50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setMoreModalData({
                        title: `Environment — ${envTab.toUpperCase()}`,
                        items: data.environment?.[envTab] || [],
                      })
                    }
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-transparent border-0 outline-none transition-colors cursor-pointer py-1 font-medium hover:underline"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>More</span>
                  </button>
                </div>
              </div>

              {/* Widget 4: Location (Screenshot 3) */}
              <div className="p-5 rounded-lg bg-[#121214] border border-[#27272a] shadow-sm flex flex-col">
                <h4 className="text-base font-bold text-white mb-2">Location</h4>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-[#27272a] mb-4 text-xs">
                  {(
                    [
                      { id: 'countries', label: 'Countries' },
                      { id: 'regions', label: 'Regions' },
                      { id: 'cities', label: 'Cities' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setLocationTab(t.id)}
                      className={classNames(
                        'pb-2 px-1 bg-transparent border-0 border-b-2 transition-all cursor-pointer font-medium outline-none text-xs',
                        locationTab === t.id
                          ? 'text-white border-blue-500 -mb-px font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Table Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 px-2 pb-2">
                  <span className="capitalize">
                    {locationTab === 'countries' ? 'Country' : locationTab === 'regions' ? 'Region' : 'City'}
                  </span>
                  <span>Visitors</span>
                </div>

                {/* Table Rows */}
                {(() => {
                  const items = data.location?.[locationTab] || [];
                  if (items.length === 0) {
                    return (
                      <div className="flex items-center justify-center flex-1 py-12 text-zinc-500 text-xs">
                        No data available.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1 flex-1">
                      {items.slice(0, 8).map((row, idx) => (
                        <div
                          key={idx}
                          className="relative flex items-center justify-between px-2.5 py-1.5 rounded text-xs hover:bg-[#18181b] transition-colors group overflow-hidden"
                        >
                          <div
                            style={{ width: `${row.percentage}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded transition-all duration-300"
                          />
                          <div className="relative flex items-center gap-2 truncate max-w-[240px] sm:max-w-[320px]">
                            {locationTab === 'countries' && (
                              <span className="text-sm leading-none shrink-0">{getCountryFlag(row.code)}</span>
                            )}
                            <span className="text-zinc-200 font-medium truncate">{row.name}</span>
                          </div>
                          <div className="relative flex items-center gap-3 font-mono text-zinc-300">
                            <span>{row.count}</span>
                            <span className="text-[11px] text-zinc-500 w-9 text-right">{row.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* More button */}
                <div className="mt-3 pt-2 border-t border-[#27272a]/50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setMoreModalData({
                        title: `Location — ${locationTab.toUpperCase()}`,
                        items: data.location?.[locationTab] || [],
                      })
                    }
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-transparent border-0 outline-none transition-colors cursor-pointer py-1 font-medium hover:underline"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>More</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal for "More" button view */}
      {moreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
              <h3 className="font-semibold text-sm text-white">{moreModalData.title}</h3>
              <button
                type="button"
                onClick={() => setMoreModalData(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] bg-transparent border-0 outline-none transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1.5">
              {moreModalData.items.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No data recorded yet</div>
              ) : (
                moreModalData.items.map((row, idx) => (
                  <div
                    key={idx}
                    className="relative flex items-center justify-between px-3 py-2 rounded text-xs hover:bg-[#18181b] transition-colors group overflow-hidden"
                  >
                    <div
                      style={{ width: `${row.percentage}%` }}
                      className="absolute left-0 top-0 bottom-0 bg-blue-500/10 pointer-events-none rounded"
                    />
                    <span className="relative text-zinc-200 font-medium truncate max-w-[300px]">{row.name}</span>
                    <div className="relative flex items-center gap-3 font-mono text-zinc-300">
                      <span>{row.count}</span>
                      <span className="text-[11px] text-zinc-500 w-10 text-right">{row.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#27272a] flex justify-end bg-[#18181b]/50">
              <button
                type="button"
                onClick={() => setMoreModalData(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#27272a] hover:bg-zinc-700 text-zinc-200 border-0 outline-none transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
