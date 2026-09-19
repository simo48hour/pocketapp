import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { description as descriptionStore, chatProjectId, projectsAtom, PROJECT_COLORS } from '~/lib/persistence';

export function ChatDescription() {
  const initialDescription = useStore(descriptionStore)!;
  const currentProjectId = useStore(chatProjectId);
  const projects = useStore(projectsAtom);

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : undefined;
  const projectColor = PROJECT_COLORS.find((c) => c.id === currentProject?.color) || PROJECT_COLORS[0];

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription,
      syncWithGlobalStore: true,
    });

  if (!initialDescription) {
    // doing this to prevent showing edit button until chat description is set
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {currentProject && (
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${projectColor.lightBg} ${projectColor.text} ${projectColor.border}`}
          title={`Project: ${currentProject.name}`}
        >
          <div className="i-ph:folder-fill text-xs" />
          <span className="max-w-[120px] truncate">{currentProject.name}</span>
        </div>
      )}
      {currentProject && <span className="text-zinc-400 dark:text-zinc-500 text-xs select-none">/</span>}
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center justify-center gap-1.5">
          <input
            type="text"
            className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 border border-violet-500/50 rounded-lg px-2.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500/20 transition-all shadow-inner"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ width: `${Math.max(currentDescription.length * 8, 140)}px` }}
          />
          <button
            type="submit"
            className="flex items-center justify-center p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition shadow-sm"
            onMouseDown={handleSubmit}
            title="Save title"
          >
            <div className="i-ph:check-bold text-xs" />
          </button>
        </form>
      ) : (
        <div
          onClick={(event) => {
            event.preventDefault();
            toggleEditMode();
          }}
          className="group flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition cursor-pointer"
        >
          <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition max-w-[280px] truncate">
            {currentDescription}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 group-hover:hidden shadow-[0_0_6px_rgba(16,185,129,0.5)]" title="Auto-saved" />
            <div className="hidden group-hover:block i-ph:pencil-simple text-zinc-500 dark:text-zinc-400 text-xs transition" />
          </div>
        </div>
      )}
    </div>
  );
}
