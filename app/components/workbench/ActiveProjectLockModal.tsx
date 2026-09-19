import React from 'react';
import type { ActivePeerProject } from '~/lib/webcontainer/multiTabCoordinator';

interface ActiveProjectLockModalProps {
  isBlockedByPeer: boolean;
  activePeerProject: ActivePeerProject | null;
  isForceClosed?: boolean;
  onTakeover: () => void;
  onResume: () => void | Promise<void>;
}

export const ActiveProjectLockModal: React.FC<ActiveProjectLockModalProps> = ({
  isBlockedByPeer,
  activePeerProject,
  isForceClosed,
  onTakeover,
  onResume,
}) => {
  if (!isBlockedByPeer && !isForceClosed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none animate-fade-in"
    >
      <div className="max-w-md w-full bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4 text-amber-400">
          {isForceClosed ? (
            <div className="i-ph:pause-circle-duotone text-3xl text-purple-400" />
          ) : (
            <div className="i-ph:browsers-duotone text-3xl text-amber-400" />
          )}
        </div>

        {/* Title */}
        <h3 id="project-lock-title" className="text-lg font-bold text-bolt-elements-textPrimary mb-1.5">
          {isForceClosed ? 'Project Paused' : 'Another Project is Already Open'}
        </h3>

        {/* Peer Project Details */}
        {isBlockedByPeer && activePeerProject && (
          <div className="my-2 px-3 py-1.5 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-xs font-semibold text-purple-400 max-w-full truncate">
            {activePeerProject.title || 'Active Project Workspace'}
          </div>
        )}

        {/* Informative Explanation */}
        <p className="text-xs text-bolt-elements-textSecondary leading-relaxed mt-2 mb-4">
          {isForceClosed
            ? 'This workspace was closed because another project was opened in a different browser tab. To work on this project again, click below.'
            : 'PocketApp allows only one active project at a time to prevent browser memory issues and crashes. Please close the opened project tab before starting another.'}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {isBlockedByPeer ? (
            <>
              <button
                type="button"
                onClick={onTakeover}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <div className="i-ph:swap-bold text-sm" />
                <span>Close Other Project & Open Here</span>
              </button>
              <p className="text-[11px] text-bolt-elements-textTertiary">
                Or close the other tab — this workspace will automatically open.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onResume()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <div className="i-ph:play-bold text-sm" />
              <span>Reactivate This Project</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
