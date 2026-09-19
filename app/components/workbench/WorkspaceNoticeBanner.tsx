import React from 'react';
import type { SuspensionReason } from '~/lib/webcontainer/multiTabCoordinator';

interface WorkspaceNoticeBannerProps {
  isSuspended: boolean;
  suspendedReason: SuspensionReason;
  isResuming: boolean;
  activeTabsCount: number;
  runningContainersCount: number;
  onResume: () => void | Promise<void>;
}

export const WorkspaceNoticeBanner: React.FC<WorkspaceNoticeBannerProps> = ({
  isSuspended,
  isResuming,
  onResume,
}) => {
  if (!isSuspended) {
    return null;
  }

  return (
    <aside
      aria-label="Workspace notice"
      className="w-full flex items-center justify-between px-3 py-1.5 bg-bolt-elements-background-depth-3/90 backdrop-blur-sm border-b border-bolt-elements-borderColor text-xs text-bolt-elements-textSecondary animate-fade-in transition-all z-20"
    >
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <span className="font-medium text-bolt-elements-textPrimary">
          Single Project Limit
        </span>
        <span className="hidden sm:inline text-bolt-elements-textTertiary">
          — Another project is currently active. PocketApp only runs 1 project at a time.
        </span>
      </div>

      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => void onResume()}
          disabled={isResuming}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-accent-500 hover:bg-accent-600 text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isResuming ? (
            <>
              <div className="i-ph:spinner animate-spin text-xs" />
              <span>Activating...</span>
            </>
          ) : (
            <>
              <div className="i-ph:play-fill text-xs" />
              <span>Activate Here</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
