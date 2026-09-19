import React from 'react';
import type { SuspensionReason } from '~/lib/webcontainer/multiTabCoordinator';

interface WorkspaceSuspendedOverlayProps {
  isSuspended: boolean;
  suspendedReason: SuspensionReason;
  isResuming: boolean;
  onResume: () => void | Promise<void>;
}

export const WorkspaceSuspendedOverlay: React.FC<WorkspaceSuspendedOverlayProps> = ({
  isSuspended,
  isResuming,
  onResume,
}) => {
  if (!isSuspended) {
    return null;
  }

  return (
    <div
      onClick={() => {
        if (!isResuming) {
          void onResume();
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isResuming) {
          void onResume();
        }
      }}
      aria-label="Click to activate workspace"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-bolt-elements-background-depth-1/80 backdrop-blur-sm transition-all duration-300 p-6 select-none animate-fade-in cursor-pointer group"
    >
      <div className="max-w-sm w-full bg-bolt-elements-background-depth-2/95 border border-bolt-elements-borderColor rounded-xl p-6 shadow-xl flex flex-col items-center text-center group-hover:border-accent-500/50 group-hover:shadow-accent-500/10 transition-all duration-200">
        <div className="w-12 h-12 rounded-full bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor flex items-center justify-center mb-3.5 text-bolt-elements-textSecondary group-hover:text-accent-500 group-hover:border-accent-500/30 transition-colors">
          {isResuming ? (
            <div className="i-ph:spinner animate-spin text-2xl text-accent-500" />
          ) : (
            <div className="i-ph:browsers-bold text-2xl text-accent-500" />
          )}
        </div>

        <h3 className="text-base font-semibold text-bolt-elements-textPrimary mb-1">
          {isResuming ? 'Activating workspace...' : 'Workspace Inactive'}
        </h3>

        <p className="text-xs text-accent-500 font-medium group-hover:underline flex items-center gap-1.5 mt-1 mb-2">
          {isResuming ? (
            'Preparing dev server & preview...'
          ) : (
            <>
              <span className="i-ph:cursor-click-bold text-sm" />
              Click to activate this project
            </>
          )}
        </p>

        <p className="text-[11px] text-bolt-elements-textTertiary leading-relaxed">
          PocketApp only runs one active project at a time to prevent browser crashes. Click anywhere to activate this workspace.
        </p>
      </div>
    </div>
  );
};
