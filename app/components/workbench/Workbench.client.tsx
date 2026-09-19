import { ProFeature } from '~/components/billing/ProFeature';
import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { streamingState } from '~/lib/stores/streaming';
import type { FileHistory } from '~/types/actions';
import { DiffView } from './DiffView';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';

import { usePreviewStore } from '~/lib/stores/previews';
import { chatStore } from '~/lib/stores/chat';
import type { ElementInfo } from './Inspector';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { exportChat, description } from '~/lib/persistence';
import { Database, BarChart3 } from 'lucide-react';
import { DatabaseViewer } from './database/DatabaseViewer';
import { AnalyticsViewer } from './analytics/AnalyticsViewer';
import { WorkspaceNoticeBanner } from './WorkspaceNoticeBanner';
import { ActiveProjectLockModal } from './ActiveProjectLockModal';
import { FileModifiedDropdown } from './FileModifiedDropdown';
import { useWorkspaceLifecycle } from '~/lib/hooks/useWorkspaceLifecycle';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: ElementInfo | null) => void;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = [
  {
    value: 'code',
    text: 'Code',
  },
  {
    value: 'diff',
    text: 'Diff',
  },
  {
    value: 'preview',
    text: 'Preview',
  },
  {
    value: 'database',
    text: 'Database',
    icon: <Database className="w-3.5 h-3.5 text-violet-400" />,
  },
  {
    value: 'analytics',
    text: 'Analytics',
    icon: <BarChart3 className="w-3.5 h-3.5 text-violet-400" />,
  },
];

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(
  ({
    chatStarted,
    isStreaming,
    metadata: _metadata,
    updateChatMestaData: _updateChatMestaData,
    setSelectedElement,
  }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const projectTitle = useStore(description) || 'PocketApp Project';
    const lifecycle = useWorkspaceLifecycle({ projectTitle });
    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    // const modifiedFiles = Array.from(useStore(workbenchStore.unsavedFiles).keys());

    const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
    const previews = useStore(workbenchStore.previews);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const selectedView = useStore(workbenchStore.currentView);
    const { showChat } = useStore(chatStore);
    const canHideChat = showWorkbench || !showChat;

    const isSmallViewport = useViewport(1024);
    const streaming = useStore(streamingState);
    const wasStreaming = useRef(streaming);
    const [isSyncing, setIsSyncing] = useState(false);
    const [diffMounted, setDiffMounted] = useState(false);
    const [previewMounted, setPreviewMounted] = useState(false);
    const [dbMounted, setDbMounted] = useState(false);
    const [analyticsMounted, setAnalyticsMounted] = useState(false);

    const setSelectedView = (view: WorkbenchViewType) => {
      workbenchStore.currentView.set(view);
    };

    useEffect(() => {
      if (hasPreview) {
        setSelectedView('preview');
      }
    }, [hasPreview, chatStarted, previews.map((preview) => `${preview.port}:${preview.baseUrl}`).join('|')]);

    // Return to the live result after each completed AI change. File actions
    // temporarily open Code so generated files can be inspected while streaming.
    useEffect(() => {
      if (wasStreaming.current && !streaming && hasPreview) {
        setSelectedView('preview');
      }
      wasStreaming.current = streaming;
    }, [streaming, hasPreview]);

    useEffect(() => {
      if (selectedView === 'diff') setDiffMounted(true);
      if (selectedView === 'preview') setPreviewMounted(true);
      if (selectedView === 'database') setDbMounted(true);
      if (selectedView === 'analytics') setAnalyticsMounted(true);
    }, [selectedView]);

    // Also mount preview when server becomes ready
    useEffect(() => {
      if (hasPreview) setPreviewMounted(true);
    }, [hasPreview]);

    useEffect(() => {
      const timer = setTimeout(() => workbenchStore.setDocuments(files), 200);
      return () => clearTimeout(timer);
    }, [files]);

    const onEditorChange = useCallback<OnEditorChange>((update) => {
      workbenchStore.setCurrentDocumentContent(update.content);
    }, []);

    const onEditorScroll = useCallback<OnEditorScroll>((position) => {
      workbenchStore.setCurrentDocumentScrollPosition(position);
    }, []);

    const onFileSelect = useCallback((filePath: string | undefined) => {
      workbenchStore.setSelectedFile(filePath);
    }, []);

    const onFileSave = useCallback(() => {
      workbenchStore
        .saveCurrentDocument()
        .then(() => {
          // Explicitly refresh all previews after a file save
          const previewStore = usePreviewStore();
          previewStore.refreshAllPreviews();
        })
        .catch(() => {
          toast.error('Failed to update file content');
        });
    }, []);

    const onFileReset = useCallback(() => {
      workbenchStore.resetCurrentDocument();
    }, []);

    const handleSelectFile = useCallback((filePath: string) => {
      workbenchStore.setSelectedFile(filePath);
      workbenchStore.currentView.set('diff');
    }, []);

    const handleSyncFiles = useCallback(async () => {
      setIsSyncing(true);

      try {
        const directoryHandle = await window.showDirectoryPicker();
        await workbenchStore.syncFiles(directoryHandle);
        toast.success('Files synced successfully');
      } catch (error) {
        console.error('Error syncing files:', error);
        toast.error('Failed to sync files');
      } finally {
        setIsSyncing(false);
      }
    }, []);

    return (
      <>
        <ActiveProjectLockModal
          isBlockedByPeer={lifecycle.isBlockedByPeer}
          activePeerProject={lifecycle.activePeerProject}
          isForceClosed={lifecycle.isForceClosed}
          onTakeover={lifecycle.requestTakeover}
          onResume={lifecycle.resumeWorkspace}
        />
        {chatStarted && (
          <motion.div
            initial="closed"
            animate={showWorkbench ? 'open' : 'closed'}
            variants={workbenchVariants}
            className="z-workbench shrink-0"
          >
          <div
            className={classNames(
              'fixed top-[calc(var(--header-height)+1.2rem)] bottom-6 w-[var(--workbench-inner-width)] z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
              {
                'w-full': isSmallViewport,
                'left-0': showWorkbench && isSmallViewport,
                'left-[var(--workbench-left)]': showWorkbench && !isSmallViewport,
                'left-[100%]': !showWorkbench,
              },
            )}
          >
            <div className="absolute inset-0 px-2 lg:px-4">
              <div className="h-full flex flex-col bg-white dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/80 shadow-2xl rounded-xl overflow-hidden backdrop-blur-md">
                <div className="flex items-center px-3 py-2 border-b border-zinc-200/90 dark:border-zinc-800/80 gap-2 bg-zinc-50/90 dark:bg-zinc-950/50">
                  <button
                    className={`${showChat ? 'i-ph:sidebar-simple-fill' : 'i-ph:sidebar-simple'} text-base text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition cursor-pointer mr-1`}
                    disabled={!canHideChat || isSmallViewport}
                    onClick={() => {
                      if (canHideChat) {
                        chatStore.setKey('showChat', !showChat);
                      }
                    }}
                    title="Toggle chat panel"
                  />
                  <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                  <div className="ml-auto" />
                  {selectedView === 'code' && (
                    <div className="flex items-center gap-1.5 overflow-y-auto">
                      {/* Export Chat Button */}
                      <ExportChatButton exportChat={exportChat} />

                      {/* Sync Button */}
                      <div className="flex">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger
                            disabled={isSyncing || streaming}
                            className="rounded-lg items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-50 px-2.5 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:border-zinc-700/60 transition flex gap-1.5"
                          >
                            {isSyncing ? 'Syncing...' : 'Sync'}
                            <span
                              className={classNames(
                                'i-ph:caret-down text-[10px] text-zinc-500 dark:text-zinc-400 transition-transform',
                              )}
                            />
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content
                            className={classNames(
                              'min-w-[200px] z-[250]',
                              'bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md',
                              'rounded-xl shadow-2xl',
                              'border border-zinc-200 dark:border-zinc-800',
                              'animate-in fade-in-0 zoom-in-95',
                              'p-1',
                            )}
                            sideOffset={5}
                            align="end"
                          >
                            <DropdownMenu.Item
                              className={classNames(
                                'cursor-pointer flex items-center w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80 gap-2 rounded-lg group relative transition',
                              )}
                              onClick={handleSyncFiles}
                              disabled={isSyncing}
                            >
                              <div className="flex items-center gap-2">
                                {isSyncing ? (
                                  <div className="i-ph:spinner animate-spin text-violet-500 dark:text-violet-400" />
                                ) : (
                                  <div className="i-ph:cloud-arrow-down text-zinc-500 dark:text-zinc-400" />
                                )}
                                <span>{isSyncing ? 'Syncing...' : 'Sync Local Files'}</span>
                              </div>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      </div>

                      {/* Toggle Terminal Button */}
                      <button
                        onClick={() => {
                          workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                        }}
                        className="rounded-lg items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-50 px-2.5 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:border-zinc-700/60 transition flex items-center gap-1.5"
                        title="Toggle terminal panel"
                      >
                        <div className="i-ph:terminal text-zinc-500 dark:text-zinc-400" />
                        <span>Terminal</span>
                      </button>
                    </div>
                  )}

                  {selectedView === 'diff' && (
                    <FileModifiedDropdown fileHistory={fileHistory} onSelectFile={handleSelectFile} />
                  )}
                  <IconButton
                    icon="i-ph:x-circle"
                    className="-mr-1"
                    size="xl"
                    onClick={() => {
                      workbenchStore.showWorkbench.set(false);
                    }}
                  />
                </div>
                <WorkspaceNoticeBanner
                  isSuspended={lifecycle.isSuspended}
                  suspendedReason={lifecycle.suspendedReason}
                  isResuming={lifecycle.isResuming}
                  activeTabsCount={lifecycle.activeTabsCount}
                  runningContainersCount={lifecycle.runningContainersCount}
                  onResume={lifecycle.resumeWorkspace}
                />
                <div className="relative flex-1 overflow-hidden">
                  <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
                    <EditorPanel
                      editorDocument={currentDocument}
                      isStreaming={isStreaming}
                      selectedFile={selectedFile}
                      files={files}
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      onFileSelect={onFileSelect}
                      onEditorScroll={onEditorScroll}
                      onEditorChange={onEditorChange}
                      onFileSave={onFileSave}
                      onFileReset={onFileReset}
                    />
                  </View>
                  {diffMounted && (
                    <View
                      initial={{ x: '100%' }}
                      animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
                    >
                      <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />
                    </View>
                  )}
                  {previewMounted && (
                    <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
                      <Preview setSelectedElement={setSelectedElement} />
                    </View>
                  )}
                  {dbMounted && (
                    <View initial={{ x: '100%' }} animate={{ x: selectedView === 'database' ? '0%' : '100%' }}>
                      <DatabaseViewer />
                    </View>
                  )}
                  {analyticsMounted && (
                    <View initial={{ x: '100%' }} animate={{ x: selectedView === 'analytics' ? '0%' : '100%' }}>
                      <ProFeature><AnalyticsViewer /></ProFeature>
                    </View>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
  },
);

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
