import React, { useEffect, useState } from 'react';

interface PreviewLoadingOverlayProps {
  isLoading: boolean;
  isStartingServer?: boolean;
  isConnectingDatabase?: boolean;
  isRestarting?: boolean;
  isResuming?: boolean;
  error?: string;
  onRestartEnvironment?: () => void;
  onReloadPreview?: () => void;
  onOpenInNewTab?: () => void;
}

export const PreviewLoadingOverlay: React.FC<PreviewLoadingOverlayProps> = ({
  isLoading,
  isStartingServer = false,
  isConnectingDatabase = false,
  isRestarting = false,
  isResuming = false,
  error,
  onRestartEnvironment,
  onReloadPreview,
  onOpenInNewTab,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isVisible = isLoading || isStartingServer || isConnectingDatabase || isRestarting || isResuming || !!error;

  useEffect(() => {
    if (!isVisible) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Determine stage title and description
  let title = 'Loading preview';
  let subtitle = 'Starting Vite and compiling application...';
  let progressPercent = 30;

  if (isRestarting) {
    title = 'Restarting environment';
    subtitle = 'Clearing caches and rebooting the dev server...';
    progressPercent = 50;
  } else if (isResuming) {
    title = 'Resuming workspace';
    subtitle = 'Waking up the dev server and container...';
    progressPercent = 60;
  } else if (isStartingServer) {
    title = 'Starting dev server';
    subtitle = 'Booting WebContainer and launching Vite...';
    progressPercent = 40;
  } else if (isConnectingDatabase) {
    title = 'Connecting database';
    subtitle = 'Configuring PocketBase backend connection...';
    progressPercent = 50;
  } else if (isLoading) {
    if (elapsedSeconds < 3) {
      title = 'Loading application preview';
      subtitle = 'Requesting index document and initializing modules...';
      progressPercent = Math.min(30 + elapsedSeconds * 10, 60);
    } else if (elapsedSeconds < 7) {
      title = 'Compiling application modules';
      subtitle = 'Vite is transforming TypeScript, React, and styles...';
      progressPercent = Math.min(60 + (elapsedSeconds - 3) * 7, 85);
    } else {
      title = 'Still loading preview...';
      subtitle = 'Vite dev server is compiling dependencies in WebContainer.';
      progressPercent = 90;
    }
  }

  const isTakingLong = elapsedSeconds >= 7 && !isRestarting && !isResuming;

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 select-none bg-bolt-elements-background-depth-1 transition-opacity duration-300 ${
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isVisible}
    >
      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Glow & Animated Icon */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full bg-violet-500/15 dark:bg-violet-600/20 blur-xl animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl shadow-violet-500/5 flex items-center justify-center">
            {error ? (
              <div className="i-ph:warning-circle-bold text-2xl text-rose-500" />
            ) : isRestarting ? (
              <div className="i-ph:arrows-clockwise-bold text-2xl text-violet-500 dark:text-violet-400 animate-spin" />
            ) : (
              <div className="i-ph:spinner-gap-bold text-2xl text-violet-600 dark:text-violet-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1 tracking-tight">
          {error ? 'Preview Error' : title}
        </h3>

        {/* Subtitle / Status */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 max-w-xs leading-relaxed">
          {error ? error : subtitle}
        </p>

        {/* Progress Bar (when not errored) */}
        {!error && (
          <div className="w-56 h-1 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Action Buttons when taking long or upon error */}
        {(isTakingLong || error) && (
          <div className="flex flex-col items-center gap-3 w-full animate-fade-in">
            {isTakingLong && !error && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-1.5 mb-1 max-w-sm">
                Compilation is taking longer than usual. A quick restart often resolves stuck bundlers.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {onReloadPreview && (
                <button
                  type="button"
                  onClick={onReloadPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm"
                >
                  <div className="i-ph:arrow-clockwise text-xs" />
                  <span>Reload Preview</span>
                </button>
              )}

              {onRestartEnvironment && (
                <button
                  type="button"
                  onClick={onRestartEnvironment}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-sm shadow-violet-600/20"
                >
                  <div className="i-ph:arrows-clockwise text-xs" />
                  <span>Restart Environment</span>
                </button>
              )}

              {onOpenInNewTab && (
                <button
                  type="button"
                  onClick={onOpenInNewTab}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm"
                >
                  <div className="i-ph:arrow-square-out text-xs" />
                  <span>Open in Tab</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
