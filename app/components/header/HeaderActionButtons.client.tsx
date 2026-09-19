import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { exportFullStackProject } from '~/lib/export/exportFullStack';
import { trackAppExported } from '~/utils/plausible';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const shouldShowButtons = activePreview;

  return (
    <div className="flex items-center gap-2">
      {/* Export Full Stack Button */}
      <button
        onClick={async () => {
          const files = workbenchStore.files.get();
          trackAppExported({ exportType: 'fullstack_zip', files });
          await exportFullStackProject('PocketAppProject', files);
        }}
        className="group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all duration-150 border border-violet-500"
        title="Download React frontend + PocketBase schema + Docker Compose"
      >
        <div className="i-ph:package text-sm text-white" />
        <span>Export App</span>
      </button>

      {/* Debug & Report Tools */}
      {shouldShowButtons && (
        <div className="flex items-center border border-zinc-300 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/90 rounded-lg overflow-hidden text-xs text-zinc-700 dark:text-zinc-300">
          <button
            onClick={() =>
              window.open('https://github.com/simo48hour/pocketapp/issues', '_blank')
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition"
            title="Report Bug"
          >
            <div className="i-ph:bug text-xs text-zinc-500 dark:text-zinc-400" />
            <span className="hidden md:inline">Report</span>
          </button>
          <div className="w-px h-3.5 bg-zinc-300 dark:bg-zinc-800" />
          <button
            onClick={async () => {
              try {
                const { downloadDebugLog } = await import('~/utils/debugLogger');
                await downloadDebugLog();
              } catch (error) {
                console.error('Failed to download debug log:', error);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition"
            title="Download Debug Log"
          >
            <div className="i-ph:download-simple text-xs text-zinc-500 dark:text-zinc-400" />
            <span className="hidden md:inline">Logs</span>
          </button>
        </div>
      )}
    </div>
  );
}
