import { useNavigate } from '@remix-run/react';
import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { SimpleSettingsModal } from '~/components/@settings/SimpleSettingsModal';
import { HelpButton } from '~/components/ui/SettingsButton';
import { isSettingsOpenAtom } from '~/lib/stores/settings';
import { Button } from '~/components/ui/Button';
import {
  db,
  deleteById,
  getAll,
  chatId,
  chatProjectId,
  type ChatHistoryItem,
  duplicateCurrentChat,
  exportChat,
  projectsAtom,
  getAllProjects,
  createSidebarProject,
  updateSidebarProject,
  deleteSidebarProject,
  assignChatToProject,
  PROJECT_COLORS,
  type SidebarProject,
  chatHistoryListAtom,
  loadChatHistoryEntries,
  removeChatFromStore,
  removeMultipleChatsFromStore,
  setChatProjectInStore,
  deletePocketBaseProject,
  isChatHistoryCacheFresh,
} from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { ProjectItem } from './ProjectItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { isSidebarOpen } from '~/lib/stores/sidebar';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | { type: 'deleteProject'; project: SidebarProject }
  | { type: 'moveChat'; item: ChatHistoryItem }
  | null;

export const Menu = () => {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const list = useStore(chatHistoryListAtom);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // If we already have chats cached in browser memory, no need to show initial loading
    return chatHistoryListAtom.get().length === 0;
  });
  const projects = useStore(projectsAtom);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('bolt_expanded_projects');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {}
    return new Set();
  });
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectColor, setNewProjectColor] = useState<string>('purple');
  const [deleteChatsWithProject, setDeleteChatsWithProject] = useState<boolean>(false);
  const [selectedMoveProjectId, setSelectedMoveProjectId] = useState<string>('');

  const saveExpandedProjects = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem('bolt_expanded_projects', JSON.stringify(Array.from(ids)));
    } catch {}
  }, []);

  const activeChatProjectId = useStore(chatProjectId);

  // Default all projects to expanded initially so user never loses sight of project chats
  useEffect(() => {
    if (projects.length > 0) {
      setExpandedProjectIds((prev) => {
        try {
          const saved = localStorage.getItem('bolt_expanded_projects');
          if (!saved) {
            const allIds = new Set(projects.map((p) => p.id));
            saveExpandedProjects(allIds);
            return allIds;
          }
        } catch {}
        return prev;
      });
    }
  }, [projects, saveExpandedProjects]);

  // Keep active project folder expanded so the current chat is always visible
  useEffect(() => {
    if (activeChatProjectId && !expandedProjectIds.has(activeChatProjectId)) {
      setExpandedProjectIds((prev) => {
        const next = new Set(prev);
        next.add(activeChatProjectId);
        saveExpandedProjects(next);
        return next;
      });
    }
  }, [activeChatProjectId, expandedProjectIds, saveExpandedProjects]);

  const open = useStore(isSidebarOpen);
  const setOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    if (typeof val === 'function') {
      isSidebarOpen.set(val(isSidebarOpen.get()));
    } else {
      isSidebarOpen.set(val);
    }
  }, []);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const isSettingsOpen = useStore(isSettingsOpenAtom);
  const setIsSettingsOpen = useCallback((val: boolean) => isSettingsOpenAtom.set(val), []);
  const profile = useStore(profileStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { filteredItems: filteredList, handleSearchChange, searchQuery } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(async (force: boolean = false) => {
    // If not forced and memory cache is fresh, skip database calls completely!
    if (!force && isChatHistoryCacheFresh()) {
      return;
    }

    // Only show full loader if we have nothing in memory or user explicitly clicked force refresh
    if (chatHistoryListAtom.get().length === 0 || force) {
      setIsLoading(true);
    }

    if (db) {
      getAllProjects(db, { force }).catch(() => {});
    }

    try {
      await loadChatHistoryEntries(db, { force });
    } catch (error: any) {
      console.warn('[Menu] Failed to load chat history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const toggleProjectExpand = useCallback((id: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveExpandedProjects(next);
      return next;
    });
  }, [saveExpandedProjects]);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const created = await createSidebarProject(newProjectName.trim(), {
        color: newProjectColor,
        db: db || undefined,
      });
      setNewProjectName('');
      setIsCreatingProject(false);
      setExpandedProjectIds((prev) => {
        const next = new Set([...prev, created.id]);
        saveExpandedProjects(next);
        return next;
      });
      toast.success(`Project "${created.name}" created`);

      // Immediately activate project and navigate to new chat inside it
      chatProjectId.set(created.id);
      window.location.href = `/?project=${encodeURIComponent(created.id)}`;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  const handleRenameProject = useCallback(
    async (project: SidebarProject, newName: string) => {
      try {
        await updateSidebarProject(project.id, { name: newName }, db || undefined);
        toast.success('Project renamed');
      } catch (err: any) {
        toast.error(err.message || 'Failed to rename project');
      }
    },
    [],
  );

  const handleNewChatInProject = useCallback((projectId: string) => {
    window.location.href = `/?project=${encodeURIComponent(projectId)}`;
  }, []);

  const confirmDeleteProject = async (project: SidebarProject) => {
    try {
      await deleteSidebarProject(project.id, db || undefined, deleteChatsWithProject);
      toast.success(`Project "${project.name}" deleted`);
      setDialogContent(null);
      setDeleteChatsWithProject(false);
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    }
  };

  const confirmMoveChat = async (chat: ChatHistoryItem, targetProjectId: string) => {
    try {
      setChatProjectInStore(chat.id, targetProjectId ? targetProjectId : undefined);
      await assignChatToProject(
        chat.id,
        targetProjectId ? targetProjectId : undefined,
        db || undefined,
      );
      if (targetProjectId) {
        setExpandedProjectIds((prev) => {
          const next = new Set([...prev, targetProjectId]);
          saveExpandedProjects(next);
          return next;
        });
      }
      toast.success(
        targetProjectId ? 'Chat moved to project' : 'Chat removed from project',
      );
      setDialogContent(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to move chat');
      loadEntries(true);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        list.some((c) => c.projectId === p.id && c.description?.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery, list]);

  const unassignedChats = useMemo(() => {
    return filteredList.filter(
      (item) => !item.projectId || !projects.some((p) => p.id === item.projectId),
    );
  }, [filteredList, projects]);

  const getProjectChats = useCallback(
    (projectId: string) => {
      return filteredList
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [filteredList],
  );

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      // Optimistically remove from browser memory immediately for instant 0ms response
      removeChatFromStore(id);

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        console.log('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete from PocketBase cloud
      deletePocketBaseProject(id).catch(() => {});

      // Delete the chat from the database
      if (db) {
        await deleteById(db, id);
        console.log('Successfully deleted chat:', id);
      }
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      deleteChat(item.id)
        .then(() => {
          toast.success('Chat deleted successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            console.log('Navigating away from deleted chat');
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('Failed to delete conversation', {
            position: 'bottom-right',
            autoClose: 3000,
          });
        });
    },
    [deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (itemsToDeleteIds.length === 0) {
        console.log('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      console.log(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      // Optimistically remove all from browser memory store immediately
      removeMultipleChatsFromStore(itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        console.log('Navigating away from deleted chat');
        window.location.pathname = '/';
      }
    },
    [deleteChat],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);

    if (selectionMode) {
      // If turning selection mode OFF, clear selection
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        console.log('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      console.log('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  useEffect(() => {
    const enterThreshold = 20;
    const exitThreshold = 20;

    let isHoveringSidebar = false;

    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) {
        return;
      }

      if (event.pageX < enterThreshold) {
        isHoveringSidebar = true;
        setOpen(true);
        return;
      }

      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.right > 50 && event.clientX <= rect.right) {
          isHoveringSidebar = true;
        } else if (isHoveringSidebar && rect.right > 50 && event.clientX > rect.right + exitThreshold) {
          isHoveringSidebar = false;
          setOpen(false);
        }
      }
    }

    const onToggleSidebar = () => setOpen((prev) => !prev);
    const onOpenSidebar = () => setOpen(true);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('toggle-sidebar', onToggleSidebar);
    window.addEventListener('open-sidebar', onOpenSidebar);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('toggle-sidebar', onToggleSidebar);
      window.removeEventListener('open-sidebar', onOpenSidebar);
    };
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id, navigate);
    loadEntries(true); // Force fresh reload of the list after duplication
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setOpen(false);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-white dark:bg-gray-950 border-r border-bolt-elements-borderColor',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <a
                href="/"
                className="flex-1 flex gap-2 items-center bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-4 py-2 transition-colors"
              >
                <span className="inline-block i-ph:plus-circle h-4 w-4" />
                <span className="text-sm font-medium">Start new chat</span>
              </a>
              <button
                onClick={toggleSelectionMode}
                className={classNames(
                  'flex gap-1 items-center rounded-lg px-3 py-2 transition-colors',
                  selectionMode
                    ? 'bg-purple-600 dark:bg-purple-500 text-white border border-purple-700 dark:border-purple-600'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700',
                )}
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
              </button>
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                className="w-full bg-gray-50 dark:bg-gray-900 relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-800"
                type="search"
                placeholder="Search chats..."
                onChange={handleSearchChange}
                aria-label="Search chats"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            <DialogRoot open={dialogContent !== null}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none animate-in fade-in duration-150">
                  <div className="relative mb-3 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-purple-500/20 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
                    <div className="i-ph:chats-circle-duotone text-base text-purple-600 dark:text-purple-400 absolute animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Loading chats & projects...</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Fetching conversations and database projects</p>
                  <div className="w-full mt-5 space-y-2 opacity-60">
                    <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded-lg animate-pulse" />
                    <div className="h-10 bg-gray-100/70 dark:bg-gray-800/40 rounded-lg animate-pulse" />
                    <div className="h-10 bg-gray-100/40 dark:bg-gray-800/20 rounded-lg animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  {/* PROJECTS SECTION */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs px-1 py-2 font-medium text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <span className="i-ph:folders-duotone text-purple-600 dark:text-purple-400 text-sm" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Projects</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                          {projects.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCreatingProject(!isCreatingProject)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200/60 dark:border-purple-800/60 transition cursor-pointer"
                        title="Create new project"
                      >
                        <span className="i-ph:plus text-xs" />
                        <span>Project</span>
                      </button>
                    </div>

                    {/* Inline New Project Form */}
                    {isCreatingProject && (
                      <form
                        onSubmit={handleCreateProjectSubmit}
                        className="p-3 mb-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/80 space-y-2.5 animate-in fade-in duration-150"
                      >
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                          <span>New Project</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingProject(false);
                              setNewProjectName('');
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                          >
                            <span className="i-ph:x" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Project name (e.g. E-Commerce App)"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          autoFocus
                          className="w-full bg-white dark:bg-gray-900 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        {/* Color selection */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1">Color:</span>
                          {PROJECT_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setNewProjectColor(c.id)}
                              className={classNames(
                                'w-4 h-4 rounded-full transition-transform cursor-pointer',
                                c.bg,
                                newProjectColor === c.id
                                  ? 'scale-125 ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-gray-950'
                                  : 'opacity-70 hover:opacity-100',
                              )}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingProject(false);
                              setNewProjectName('');
                            }}
                            className="px-2.5 py-1 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!newProjectName.trim()}
                            className="px-3 py-1 rounded-md text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition cursor-pointer"
                          >
                            Create Project
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Project Folders */}
                    {filteredProjects.length > 0 ? (
                      <div className="space-y-1">
                        {filteredProjects.map((project) => (
                          <ProjectItem
                            key={project.id}
                            project={project}
                            chats={getProjectChats(project.id)}
                            isExpanded={searchQuery.trim() ? true : expandedProjectIds.has(project.id)}
                            onToggleExpand={() => toggleProjectExpand(project.id)}
                            onNewChat={handleNewChatInProject}
                            onRename={handleRenameProject}
                            onDelete={(p) => setDialogContent({ type: 'deleteProject', project: p })}
                            onDuplicateChat={handleDuplicate}
                            onDeleteChat={(e, item) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDialogContentWithLogging({ type: 'delete', item });
                            }}
                            exportChat={exportChat}
                            selectionMode={selectionMode}
                            selectedItems={selectedItems}
                            onToggleSelection={toggleItemSelection}
                          />
                        ))}
                      </div>
                    ) : !isCreatingProject && (
                      <div
                        onClick={() => setIsCreatingProject(true)}
                        className="p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 hover:border-purple-400/60 dark:hover:border-purple-600/60 text-center cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          <span className="i-ph:plus text-xs" />
                          <span>Create a project to organize your chats</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* UNASSIGNED / RECENT CHATS SECTION */}
                  <div className="border-t border-gray-100 dark:border-gray-800/80 pt-2">
                    <div className="flex items-center justify-between text-xs px-1 py-1.5 mb-1">
                      <div className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
                        <span className="i-ph:chat-teardrop-text text-sm" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {projects.length > 0 ? 'Other Chats' : 'Your Chats'}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          ({unassignedChats.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!selectionMode && (
                          <button
                            type="button"
                            onClick={() => loadEntries(true)}
                            disabled={isLoading}
                            title="Refresh chats & projects"
                            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                          >
                            <span className={classNames('i-ph:arrow-clockwise h-3.5 w-3.5 block', isLoading && 'animate-spin text-purple-500')} />
                          </button>
                        )}
                        {selectionMode && (
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={selectAll}>
                              {selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleBulkDeleteClick}
                              disabled={selectedItems.length === 0}
                            >
                              Delete selected
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {unassignedChats.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                        {list.length === 0 ? 'No previous conversations' : 'No unassigned chats'}
                      </div>
                    ) : (
                      binDates(unassignedChats).map(({ category, items }) => (
                        <div key={category} className="mt-2 first:mt-0 space-y-1">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-white dark:bg-gray-950 px-3 py-1">
                            {category}
                          </div>
                          <div className="space-y-0.5 pr-1">
                            {items.map((item) => (
                              <HistoryItem
                                key={item.id}
                                item={item}
                                exportChat={exportChat}
                                onMoveToProject={(it) => {
                                  setSelectedMoveProjectId(it.projectId || '');
                                  setDialogContent({ type: 'moveChat', item: it });
                                }}
                                onDelete={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setDialogContentWithLogging({ type: 'delete', item });
                                }}
                                onDuplicate={() => handleDuplicate(item.id)}
                                selectionMode={selectionMode}
                                isSelected={selectedItems.includes(item.id)}
                                onToggleSelection={toggleItemSelection}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          console.log('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}

                {dialogContent?.type === 'deleteProject' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">Delete Project?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>
                          Are you sure you want to delete the project{' '}
                          <span className="font-semibold text-gray-900 dark:text-white">
                            "{dialogContent.project.name}"
                          </span>
                          ?
                        </p>
                        <label className="mt-4 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={deleteChatsWithProject}
                            onChange={(e) => setDeleteChatsWithProject(e.target.checked)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Also delete all chats belonging to this project</span>
                        </label>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => confirmDeleteProject(dialogContent.project)}
                      >
                        Delete Project
                      </DialogButton>
                    </div>
                  </>
                )}

                {dialogContent?.type === 'moveChat' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">Move Chat to Project</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p className="text-xs mb-3">
                          Select a project for{' '}
                          <span className="font-semibold text-gray-900 dark:text-white">
                            "{dialogContent.item.description}"
                          </span>:
                        </p>
                        <div className="space-y-1 max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMoveProjectId('')}
                            className={classNames(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors text-left cursor-pointer',
                              selectedMoveProjectId === ''
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
                            )}
                          >
                            <span className="i-ph:chat-circle-dots-duotone text-sm text-gray-400" />
                            <span>No Project (Unassigned)</span>
                          </button>
                          {projects.map((p) => {
                            const col = PROJECT_COLORS.find((c) => c.id === p.color) || PROJECT_COLORS[0];
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedMoveProjectId(p.id)}
                                className={classNames(
                                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors text-left cursor-pointer',
                                  selectedMoveProjectId === p.id
                                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
                                )}
                              >
                                <span className={classNames('i-ph:folder-simple-fill text-sm', col.text)} />
                                <span className="truncate flex-1 font-medium">{p.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="primary"
                        onClick={() => confirmMoveChat(dialogContent.item, selectedMoveProjectId)}
                      >
                        Save
                      </DialogButton>
                    </div>
                  </>
                )}

                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">Delete Selected Chats?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {dialogContent.items.length === 1 ? 'chat' : 'chats'}:
                        </p>
                        <div className="mt-2 max-h-32 overflow-auto border border-gray-100 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-gray-900 dark:text-white">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">Are you sure you want to delete these chats?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          const itemsToDeleteNow = [...selectedItems];
                          console.log('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-end border-t border-gray-200 dark:border-gray-800 px-4 py-3">
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>

      <SimpleSettingsModal open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
