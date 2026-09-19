import { useStore } from '@nanostores/react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';
import { IconButton } from '~/components/ui/IconButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { Terminal, type TerminalRef } from './Terminal';
import { TerminalManager } from './TerminalManager';
import { createScopedLogger } from '~/utils/logger';
import { toast } from 'react-toastify';
import { extractErrorFromTerminal, extractTerminalBuffer } from '~/utils/terminalErrorParser';
import { trackTerminalErrorAutoFix } from '~/utils/plausible';

const logger = createScopedLogger('Terminal');

const MAX_TERMINALS = 3;
export const DEFAULT_TERMINAL_SIZE = 25;

export const TerminalTabs = memo(() => {
  const showTerminal = useStore(workbenchStore.showTerminal);
  const theme = useStore(themeStore);
  const isBoltTerminalReady = useStore(workbenchStore.boltTerminal.isReady);

  const terminalRefs = useRef<Map<number, TerminalRef>>(new Map());
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalToggledByShortcut = useRef(false);

  const [activeTerminal, setActiveTerminal] = useState(0);
  const [terminalCount, setTerminalCount] = useState(0);
  const [isRefreshingTerminal, setIsRefreshingTerminal] = useState(false);

  const addTerminal = () => {
    if (terminalCount < MAX_TERMINALS) {
      setTerminalCount(terminalCount + 1);
      setActiveTerminal(terminalCount);
    }
  };

  const closeTerminal = useCallback(
    (index: number) => {
      if (index === 0) {
        return;
      } // Can't close primary terminal

      const terminalRef = terminalRefs.current.get(index);

      if (terminalRef?.getTerminal) {
        const terminal = terminalRef.getTerminal();

        if (terminal) {
          workbenchStore.detachTerminal(terminal);
        }
      }

      // Remove the terminal from refs
      terminalRefs.current.delete(index);

      // Adjust terminal count and active terminal
      setTerminalCount(terminalCount - 1);

      if (activeTerminal === index) {
        setActiveTerminal(Math.max(0, index - 1));
      } else if (activeTerminal > index) {
        setActiveTerminal(activeTerminal - 1);
      }
    },
    [activeTerminal, terminalCount],
  );

  useEffect(() => {
    return () => {
      terminalRefs.current.forEach((ref, index) => {
        if (index > 0 && ref?.getTerminal) {
          const terminal = ref.getTerminal();

          if (terminal) {
            workbenchStore.detachTerminal(terminal);
          }
        }
      });
      terminalRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    const { current: terminal } = terminalPanelRef;

    if (!terminal) {
      return;
    }

    const isCollapsed = terminal.isCollapsed();

    if (!showTerminal && !isCollapsed) {
      terminal.collapse();
    } else if (showTerminal && isCollapsed) {
      terminal.resize(DEFAULT_TERMINAL_SIZE);
    }

    terminalToggledByShortcut.current = false;
  }, [showTerminal]);

  useEffect(() => {
    const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
      terminalToggledByShortcut.current = true;
    });

    const unsubscribeFromThemeStore = themeStore.subscribe(() => {
      terminalRefs.current.forEach((ref) => {
        ref?.reloadStyles();
      });
    });

    return () => {
      unsubscribeFromEventEmitter();
      unsubscribeFromThemeStore();
      terminalRefs.current.clear();
    };
  }, []);

  const handleFixWithAI = () => {
    const ref = terminalRefs.current.get(activeTerminal);
    const terminal = ref?.getTerminal();
    let errorText = '';

    if (terminal) {
      const bufferText = extractTerminalBuffer(terminal, 80);
      const { hasError, snippet } = extractErrorFromTerminal(bufferText);

      if (hasError && snippet) {
        errorText = snippet;
      } else if (bufferText) {
        errorText = bufferText.split('\n').slice(-30).join('\n').trim();
      }
    }

    if (!errorText && workbenchStore.latestTerminalError.get()) {
      errorText = workbenchStore.latestTerminalError.get()!.content;
    }

    if (!errorText || !errorText.trim()) {
      toast.info('No terminal logs found to analyze.');
      return;
    }

    toast.info('Sending terminal error to AI to fix...');
    trackTerminalErrorAutoFix();
    workbenchStore.fixTerminalError(errorText);
  };

  const handleResetTerminal = async () => {
    if (isRefreshingTerminal) {
      return;
    }

    const ref = terminalRefs.current.get(activeTerminal);

    if (ref?.getTerminal()) {
      setIsRefreshingTerminal(true);
      const terminal = ref.getTerminal()!;
      terminal.clear();

      try {
        if (activeTerminal === 0) {
          await workbenchStore.attachBoltTerminal(terminal);
        } else {
          await workbenchStore.attachTerminal(terminal);
        }
        // Brief pleasant delay ensuring user gets clear loading confirmation
        await new Promise((resolve) => setTimeout(resolve, 600));
      } finally {
        setIsRefreshingTerminal(false);
        terminal.focus();
      }
    }
  };

  return (
    <Panel
      ref={terminalPanelRef}
      defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
      minSize={10}
      collapsible
      onExpand={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(true);
        }
      }}
      onCollapse={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(false);
        }
      }}
    >
      <div className="h-full">
        <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
          <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">
            {Array.from({ length: terminalCount + 1 }, (_, index) => {
              const isActive = activeTerminal === index;

              return (
                <React.Fragment key={index}>
                  {index == 0 ? (
                    <button
                      key={index}
                      className={classNames(
                        'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                        {
                          'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                            isActive,
                          'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                            !isActive,
                        },
                      )}
                      onClick={() => setActiveTerminal(index)}
                    >
                      <div className="i-ph:terminal-window-duotone text-lg" />
                      Terminal
                    </button>
                  ) : (
                    <React.Fragment>
                      <button
                        key={index}
                        className={classNames(
                          'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                          {
                            'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                            'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                              !isActive,
                          },
                        )}
                        onClick={() => setActiveTerminal(index)}
                      >
                        <div className="i-ph:terminal-window-duotone text-lg" />
                        Terminal {terminalCount > 1 && index}
                        <button
                          className="bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-transparent rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTerminal(index);
                          }}
                        >
                          <div className="i-ph:x text-xs" />
                        </button>
                      </button>
                    </React.Fragment>
                  )}
                </React.Fragment>
              );
            })}
            {terminalCount < MAX_TERMINALS && <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />}
            <IconButton
              icon="i-ph:arrow-clockwise"
              title="Reset Terminal"
              size="md"
              disabled={isRefreshingTerminal}
              iconClassName={classNames(isRefreshingTerminal && 'animate-spin text-purple-400')}
              onClick={handleResetTerminal}
            />
            <button
              onClick={handleFixWithAI}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer ml-1"
              title="Send terminal logs/error to AI to fix automatically"
            >
              <div className="i-ph:sparkle-fill text-xs" />
              Fix with AI
            </button>
            <IconButton
              className="ml-auto"
              icon="i-ph:caret-down"
              title="Close"
              size="md"
              onClick={() => workbenchStore.toggleTerminal(false)}
            />
          </div>
          <div className="flex-1 relative overflow-hidden min-h-0 bg-[#09090b]">
            {((activeTerminal === 0 && !isBoltTerminalReady) || isRefreshingTerminal) && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#09090b]/95 backdrop-blur-sm select-none animate-in fade-in duration-150">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="absolute w-20 h-20 rounded-full bg-violet-500/20 blur-xl animate-pulse" />
                  <div className="relative w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/60 shadow-xl shadow-violet-500/10 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
                      <div className="i-ph:terminal-window-duotone text-lg text-violet-400 absolute animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>{isRefreshingTerminal ? 'Reloading Terminal...' : 'Initializing Terminal...'}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {isRefreshingTerminal ? 'Reconnecting shell session' : 'Starting shell session...'}
                </p>
              </div>
            )}
            {Array.from({ length: terminalCount + 1 }, (_, index) => {
              const isActive = activeTerminal === index;

              logger.debug(`Starting terminal [${index}]`);

              if (index == 0) {
                return (
                  <React.Fragment key={`terminal-container-${index}`}>
                    <Terminal
                      key={`terminal-${index}`}
                      id={`terminal_${index}`}
                      className={classNames('h-full overflow-hidden modern-scrollbar-invert', {
                        hidden: !isActive,
                      })}
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current.set(index, ref);
                        }
                      }}
                      onTerminalReady={(terminal) => workbenchStore.attachBoltTerminal(terminal)}
                      onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                      theme={theme}
                    />
                    <TerminalManager
                      terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                      isActive={isActive}
                    />
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment key={`terminal-container-${index}`}>
                    <Terminal
                      key={`terminal-${index}`}
                      id={`terminal_${index}`}
                      className={classNames('modern-scrollbar h-full overflow-hidden', {
                        hidden: !isActive,
                      })}
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current.set(index, ref);
                        }
                      }}
                      onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                      onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                      theme={theme}
                    />
                    <TerminalManager
                      terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                      isActive={isActive}
                    />
                  </React.Fragment>
                );
              }
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
});
