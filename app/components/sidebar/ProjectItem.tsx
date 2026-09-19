import React, { useState, forwardRef, type ForwardedRef } from 'react';
import type { SidebarProject } from '~/lib/persistence/projectTypes';
import type { ChatHistoryItem } from '~/lib/persistence';
import { PROJECT_COLORS } from '~/lib/persistence/projectTypes';
import { HistoryItem } from './HistoryItem';
import WithTooltip from '~/components/ui/Tooltip';
import { classNames } from '~/utils/classNames';

interface ProjectItemProps {
  project: SidebarProject;
  chats: ChatHistoryItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNewChat: (projectId: string) => void;
  onRename: (project: SidebarProject, newName: string) => void;
  onDelete: (project: SidebarProject) => void;
  onDuplicateChat?: (id: string) => void;
  onDeleteChat?: (event: React.UIEvent, item: ChatHistoryItem) => void;
  exportChat: (id?: string) => void;
  selectionMode?: boolean;
  selectedItems?: string[];
  onToggleSelection?: (id: string) => void;
}

export const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  chats,
  isExpanded,
  onToggleExpand,
  onNewChat,
  onRename,
  onDelete,
  onDuplicateChat,
  onDeleteChat,
  exportChat,
  selectionMode = false,
  selectedItems = [],
  onToggleSelection,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const colorConfig =
    PROJECT_COLORS.find((c) => c.id === project.color) || PROJECT_COLORS[0];

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim() && editName.trim() !== project.name) {
      onRename(project, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl overflow-hidden mb-1.5 transition-all bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-800/60">
      {/* Project Header / Folder Bar */}
      <div
        className={classNames(
          'group flex items-center justify-between px-3 py-2 cursor-pointer select-none transition-colors',
          isExpanded
            ? 'bg-purple-50/60 dark:bg-purple-950/20 text-gray-900 dark:text-gray-100'
            : 'hover:bg-gray-100/60 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300',
        )}
        onClick={() => {
          if (!isEditing) onToggleExpand();
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Chevron expand/collapse */}
          <span
            className={classNames(
              'i-ph:caret-right-bold text-xs text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0',
              isExpanded && 'rotate-90 text-purple-500',
            )}
          />

          {/* Folder Icon */}
          <span
            className={classNames(
              isExpanded ? 'i-ph:folder-open-duotone' : 'i-ph:folder-duotone',
              'text-base shrink-0 transition-colors',
              colorConfig.text,
            )}
          />

          {/* Project Title or Inline Rename */}
          {isEditing ? (
            <form
              onSubmit={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 flex-1"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditName(project.name);
                    setIsEditing(false);
                  }
                }}
                className="w-full bg-white dark:bg-gray-900 text-xs font-semibold px-2 py-1 rounded border border-purple-500/50 outline-none text-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                className="i-ph:check-bold text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700"
              />
            </form>
          ) : (
            <span
              className="text-xs font-semibold truncate tracking-tight flex-1"
              title={project.name}
            >
              {project.name}
            </span>
          )}

          {/* Chat count badge */}
          {!isEditing && (
            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
              {chats.length}
            </span>
          )}
        </div>

        {/* Action Buttons on Hover */}
        {!isEditing && (
          <div
            className="flex items-center gap-1 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <WithTooltip tooltip="New chat in this project" position="bottom" sideOffset={4}>
              <button
                type="button"
                onClick={() => onNewChat(project.id)}
                className="p-1 rounded hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
              >
                <div className="i-ph:plus text-xs" />
              </button>
            </WithTooltip>

            <WithTooltip tooltip="Rename project" position="bottom" sideOffset={4}>
              <button
                type="button"
                onClick={() => {
                  setEditName(project.name);
                  setIsEditing(true);
                }}
                className="p-1 rounded hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-gray-800 transition"
              >
                <div className="i-ph:pencil-simple text-xs" />
              </button>
            </WithTooltip>

            <WithTooltip tooltip="Delete project" position="bottom" sideOffset={4}>
              <button
                type="button"
                onClick={() => onDelete(project)}
                className="p-1 rounded hover:text-red-500 dark:hover:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-950/40 transition"
              >
                <div className="i-ph:trash text-xs" />
              </button>
            </WithTooltip>
          </div>
        )}
      </div>

      {/* Expanded Chats List */}
      {isExpanded && (
        <div className="pl-3 pr-1 pb-1.5 pt-0.5 space-y-0.5 border-t border-gray-100 dark:border-gray-800/40">
          {chats.length === 0 ? (
            <div className="py-2.5 px-3 text-center">
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                No chats in this project yet.
              </p>
              <button
                type="button"
                onClick={() => onNewChat(project.id)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                <span className="i-ph:plus text-[10px]" />
                Start a chat
              </button>
            </div>
          ) : (
            <>
              {chats.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  exportChat={exportChat}
                  onDelete={(e) => onDeleteChat?.(e, item)}
                  onDuplicate={() => onDuplicateChat?.(item.id)}
                  selectionMode={selectionMode}
                  isSelected={selectedItems.includes(item.id)}
                  onToggleSelection={onToggleSelection}
                />
              ))}

              {/* Action row to add a new chat to this project */}
              <button
                type="button"
                onClick={() => onNewChat(project.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors mt-1 cursor-pointer"
              >
                <span className="i-ph:plus h-3.5 w-3.5" />
                <span>New chat in {project.name}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
