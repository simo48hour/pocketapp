import { chatId } from '~/lib/persistence/chatId';
import { chatProjectId } from '~/lib/persistence';
import {
  ensureProjectDatabase,
  syncProjectSchema,
  type ProjectDatabaseConnection,
} from '~/lib/persistence/projectDatabase';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { ScreenshotSelector } from './ScreenshotSelector';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import type { ElementInfo } from './Inspector';
import { useWorkspaceLifecycle } from '~/lib/hooks/useWorkspaceLifecycle';
import { WorkspaceSuspendedOverlay } from './WorkspaceSuspendedOverlay';
import { PreviewLoadingOverlay } from './PreviewLoadingOverlay';
import { webcontainer } from '~/lib/webcontainer';
import { revokeAllObjectURLs } from '~/utils/objectUrl';

type ResizeSide = 'left' | 'right' | null;

interface PreviewProps {
  setSelectedElement?: (element: ElementInfo | null) => void;
}

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
  hasFrame?: boolean;
  frameType?: 'mobile' | 'tablet' | 'laptop' | 'desktop';
}

const WINDOW_SIZES: WindowSize[] = [
  { name: 'iPhone SE', width: 375, height: 667, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPhone 12/13', width: 390, height: 844, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  {
    name: 'iPhone 12/13 Pro Max',
    width: 428,
    height: 926,
    icon: 'i-ph:device-mobile',
    hasFrame: true,
    frameType: 'mobile',
  },
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  {
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    icon: 'i-ph:device-tablet',
    hasFrame: true,
    frameType: 'tablet',
  },
  { name: 'Small Laptop', width: 1280, height: 800, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Large Laptop', width: 1440, height: 900, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
  { name: '4K Display', width: 3840, height: 2160, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
];

export const Preview = memo(({ setSelectedElement }: PreviewProps) => {
  const { isSuspended, suspendedReason, isResuming, resumeWorkspace } = useWorkspaceLifecycle();
  const restarting = useStore(workbenchStore.restartingEnvironment);
  const actionAlert = useStore(workbenchStore.alert);
  const previewAlertError =
    actionAlert?.source === 'preview' || actionAlert?.type === 'preview'
      ? `${actionAlert.title}: ${actionAlert.description}`
      : undefined;
  const [restartError, setRestartError] = useState<string>();
  const [iframeLoading, setIframeLoading] = useState(true);
  const [slowPreview, setSlowPreview] = useState(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout>>();
  const fallbackLoadTimer = useRef<ReturnType<typeof setTimeout>>();
  const visibilitySleepTimer = useRef<ReturnType<typeof setTimeout>>();
  const cachedPreviewSrc = useRef<string | undefined>();
  const isSubframeSleeping = useRef(false);

  const beginPreviewLoad = useCallback(() => {
    clearTimeout(loadTimer.current);
    clearTimeout(fallbackLoadTimer.current);
    setIframeLoading(true);
    setSlowPreview(false);
    loadTimer.current = setTimeout(() => setSlowPreview(true), 8000);
  }, []);

  const finishPreviewLoad = useCallback((immediate = false) => {
    clearTimeout(loadTimer.current);
    clearTimeout(fallbackLoadTimer.current);
    if (immediate) {
      setIframeLoading(false);
      setSlowPreview(false);
    } else {
      // Generous safety fallback (25s): Keep overlay visible until PREVIEW_DOM_READY arrives
      fallbackLoadTimer.current = setTimeout(() => {
        setIframeLoading(false);
        setSlowPreview(false);
      }, 25000);
    }
  }, []);
  const restartEnvironment = async () => {
    setRestartError(undefined);

    // Explicitly unmount running iframe document and terminate active scripts/websockets
    if (iframeRef.current) {
      try {
        iframeRef.current.src = 'about:blank';
      } catch {}
    }

    try {
      await workbenchStore.saveAllFiles();
      await workbenchStore.restartEnvironment();
      reloadPreview();
    } catch (error) {
      setRestartError(error instanceof Error ? error.message : 'Restart failed');
    }
  };
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [displayPath, setDisplayPath] = useState('/');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);
  const [widthPercent, setWidthPercent] = useState<number>(37.5);
  const [currentWidth, setCurrentWidth] = useState<number>(0);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
    pointerId: null as number | null,
  });

  // Reduce scaling factor to make resizing less sensitive
  const SCALING_FACTOR = 1;

  const [isWindowSizeDropdownOpen, setIsWindowSizeDropdownOpen] = useState(false);
  const [selectedWindowSize, setSelectedWindowSize] = useState<WindowSize>(WINDOW_SIZES[0]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);
  const [showDeviceFrameInPreview, setShowDeviceFrameInPreview] = useState(false);
  const expoUrl = useStore(expoUrlAtom);
  const [isExpoQrModalOpen, setIsExpoQrModalOpen] = useState(false);

  useEffect(() => {
    if (!activePreview?.baseUrl) {
      setIframeUrl(undefined);
      setDisplayPath('/');

      return;
    }

    const { baseUrl } = activePreview;
    setIframeUrl(baseUrl);
    setDisplayPath('/');
    beginPreviewLoad();
  }, [activePreview?.baseUrl, activePreviewIndex, beginPreviewLoad]);

  const currentChatId = useStore(chatId);
  const currentProjectId = useStore(chatProjectId);
  const projectFiles = useStore(workbenchStore.files);
  const schemaFile = Object.entries(projectFiles).find(
    ([name]) => name.endsWith('/pb_schema.json') || name === 'pb_schema.json',
  )?.[1];
  const schemaText = schemaFile?.type === 'file' ? schemaFile.content : undefined;
  const [database, setDatabase] = useState<{
    targetId: string;
    schema: string | undefined;
    connection: ProjectDatabaseConnection;
  } | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const initialId = chatProjectId.get() || chatId.get() || sessionStorage.getItem('pocketapp_draft_chat_id');
    if (!initialId) return undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(`pocketapp_project_db:${initialId}`) || 'null');
      if (saved?.id && saved?.ownerToken) {
        return { targetId: initialId, schema: schemaText, connection: saved };
      }
    } catch {}
    return undefined;
  });
  const [databaseError, setDatabaseError] = useState<string>();

  const sendDbConfigToIframe = useCallback(() => {
    if (database?.connection?.id && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'pocketapp_db_config',
            projectId: database.connection.id,
            origin: window.location.origin,
          },
          '*',
        );
      } catch {}
    }
  }, [database?.connection?.id]);

  useEffect(() => {
    const targetId =
      currentProjectId ||
      currentChatId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pocketapp_draft_chat_id') || undefined : undefined);

    if (!targetId || !activePreview?.baseUrl) return;
    let cancelled = false;

    const connect = async () => {
      try {
        const connection = await ensureProjectDatabase(currentChatId, currentProjectId);
        if (cancelled) return;

        setDatabase((prev) => {
          if (prev?.targetId === targetId && prev?.connection.id === connection.id) {
            return prev;
          }
          return { targetId, schema: prev?.targetId === targetId ? prev.schema : undefined, connection };
        });
        setDatabaseError(undefined);

        // Clean up any legacy .env.local in WebContainer so Vite does not trigger server restart loops
        try {
          const wc = await webcontainer;
          try {
            await wc.fs.readFile('.env.local', 'utf8');
            await wc.fs.rm('.env.local');
          } catch {}
        } catch {
          // WebContainer may still be initializing
        }

        // Post db config to preview iframe in case it has already mounted
        if (iframeRef.current?.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage(
              {
                type: 'pocketapp_db_config',
                projectId: connection.id,
                origin: window.location.origin,
              },
              '*',
            );
          } catch {}
        }

        // Synchronize schema if schema file exists and contains valid JSON
        if (schemaText) {
          try {
            const parsed = JSON.parse(schemaText);
            await syncProjectSchema(connection, parsed);
            if (!cancelled) {
              setDatabase({ targetId, schema: schemaText, connection });
            }
          } catch (err: any) {
            if (err instanceof SyntaxError) {
              // During prompt generation or typing, schema JSON may be streaming/incomplete.
              // Do not drop the database connection or display an error for partial JSON.
              console.warn('[Preview] Schema JSON streaming or invalid syntax, sync deferred:', err.message);
            } else {
              console.error('[Preview] Schema sync failed:', err);
            }
          }
        }
      } catch (error: any) {
        if (!cancelled) setDatabaseError(error.message);
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [currentChatId, currentProjectId, schemaText, activePreview?.baseUrl]);

  const currentIframeSrc = (() => {
    const base = iframeUrl || activePreview?.baseUrl;
    const targetId =
      currentProjectId ||
      currentChatId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pocketapp_draft_chat_id') || undefined : undefined);

    if (!base || !database || (targetId && database.targetId !== targetId)) return undefined;
    const url = new URL(displayPath === '/' ? base : displayPath, base);
    url.searchParams.set('pocketapp_db', database.connection.id);
    url.searchParams.set('pocketapp_origin', window.location.origin);
    return url.toString();
  })();

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);
      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex]);

  useEffect(() => {
    if (currentIframeSrc) {
      beginPreviewLoad();
    }
    return () => {
      clearTimeout(loadTimer.current);
      clearTimeout(fallbackLoadTimer.current);
    };
  }, [currentIframeSrc, beginPreviewLoad]);

  // 1. Page Visibility Sleep/Resume for WebContainer Preview:
  // If tab remains hidden for > 45 seconds:
  // - Temporarily pause unnecessary file system watchers
  // - Set Preview iframe src to 'about:blank' to instantly release Chromium's rendering subframe memory (~835 MB)
  // When user returns:
  // - Instantly restore the preview iframe URL without re-running npm install
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (visibilitySleepTimer.current) {
          clearTimeout(visibilitySleepTimer.current);
        }

        visibilitySleepTimer.current = setTimeout(() => {
          if (document.hidden && iframeRef.current) {
            console.log('[Preview] Tab hidden > 45s: releasing iframe subframe memory and pausing watchers');
            isSubframeSleeping.current = true;

            const activeSrc = iframeRef.current.src;
            if (activeSrc && activeSrc !== 'about:blank') {
              cachedPreviewSrc.current = activeSrc;
            } else if (currentIframeSrc) {
              cachedPreviewSrc.current = currentIframeSrc;
            }

            workbenchStore.pauseStreamsAndWatchers();

            try {
              iframeRef.current.src = 'about:blank';
            } catch {}
          }
        }, 45000);
      } else {
        if (visibilitySleepTimer.current) {
          clearTimeout(visibilitySleepTimer.current);
          visibilitySleepTimer.current = undefined;
        }

        if (isSubframeSleeping.current) {
          isSubframeSleeping.current = false;
          console.log('[Preview] Tab foregrounded: instantly restoring preview subframe');
          workbenchStore.resumeStreamsAndWatchers();

          const restoreUrl = cachedPreviewSrc.current || currentIframeSrc;
          if (iframeRef.current && restoreUrl && restoreUrl !== 'about:blank') {
            iframeRef.current.src = restoreUrl;
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilitySleepTimer.current) {
        clearTimeout(visibilitySleepTimer.current);
      }
    };
  }, [currentIframeSrc]);

  // 2. Strict Teardown on Window pagehide / beforeunload and unmount:
  // Purges preview iframe to about:blank ensuring Chromium doesn't hold the subframe in bfcache,
  // and revokes all active blob URLs.
  useEffect(() => {
    const purgeIframeAndBlobUrls = () => {
      if (iframeRef.current) {
        try {
          iframeRef.current.src = 'about:blank';
        } catch {}
      }
      revokeAllObjectURLs();
    };

    window.addEventListener('pagehide', purgeIframeAndBlobUrls);
    window.addEventListener('beforeunload', purgeIframeAndBlobUrls);

    return () => {
      clearTimeout(loadTimer.current);
      clearTimeout(fallbackLoadTimer.current);
      if (visibilitySleepTimer.current) {
        clearTimeout(visibilitySleepTimer.current);
      }
      window.removeEventListener('pagehide', purgeIframeAndBlobUrls);
      window.removeEventListener('beforeunload', purgeIframeAndBlobUrls);
      purgeIframeAndBlobUrls();
    };
  }, []);

  const reloadPreview = () => {
    if (iframeRef.current) {
      // A retry starts a new attempt. Keep unrelated alerts, and let any fresh
      // runtime failure report itself instead of retaining the previous error.
      const alert = workbenchStore.alert.get();
      if (alert?.source === 'preview' || alert?.type === 'preview') {
        workbenchStore.clearAlert();
      }
      setRestartError(undefined);
      beginPreviewLoad();
      const current = iframeRef.current.src;
      try {
        iframeRef.current.src = 'about:blank';
      } catch {}
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = current;
        }
      }, 50);
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleDeviceMode = () => {
    setIsDeviceModeOn((prev) => !prev);
  };

  const startResizing = (e: React.PointerEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) {
      return;
    }

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    resizingState.current = {
      isResizing: true,
      side,
      startX: e.clientX,
      startWidthPercent: widthPercent,
      windowWidth: window.innerWidth,
      pointerId: e.pointerId,
    };
  };

  const ResizeHandle = ({ side }: { side: ResizeSide }) => {
    if (!side) {
      return null;
    }

    return (
      <div
        className={`resize-handle-${side}`}
        onPointerDown={(e) => startResizing(e, side)}
        style={{
          position: 'absolute',
          top: 0,
          ...(side === 'left' ? { left: 0, marginLeft: '-7px' } : { right: 0, marginRight: '-7px' }),
          width: '15px',
          height: '100%',
          cursor: 'ew-resize',
          background: 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          userSelect: 'none',
          touchAction: 'none',
          zIndex: 10,
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))')
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))')
        }
        title="Drag to resize width"
      >
        <GripIcon />
      </div>
    );
  };

  useEffect(() => {
    // Skip if not in device mode
    if (!isDeviceModeOn) {
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const state = resizingState.current;

      if (!state.isResizing || e.pointerId !== state.pointerId) {
        return;
      }

      const dx = e.clientX - state.startX;
      const dxPercent = (dx / state.windowWidth) * 100 * SCALING_FACTOR;

      let newWidthPercent = state.startWidthPercent;

      if (state.side === 'right') {
        newWidthPercent = state.startWidthPercent + dxPercent;
      } else if (state.side === 'left') {
        newWidthPercent = state.startWidthPercent - dxPercent;
      }

      // Limit width percentage between 10% and 90%
      newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

      // Force a synchronous update to ensure the UI reflects the change immediately
      setWidthPercent(newWidthPercent);

      // Calculate and update the actual pixel width
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const newWidth = Math.round((containerWidth * newWidthPercent) / 100);
        setCurrentWidth(newWidth);

        // Apply the width directly to the container for immediate feedback
        const previewContainer = containerRef.current.querySelector('div[style*="width"]');

        if (previewContainer) {
          (previewContainer as HTMLElement).style.width = `${newWidthPercent}%`;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const state = resizingState.current;

      if (!state.isResizing || e.pointerId !== state.pointerId) {
        return;
      }

      // Find all resize handles
      const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');

      // Release pointer capture from any handle that has it
      handles.forEach((handle) => {
        if ((handle as HTMLElement).hasPointerCapture?.(e.pointerId)) {
          (handle as HTMLElement).releasePointerCapture(e.pointerId);
        }
      });

      // Reset state
      resizingState.current = {
        ...resizingState.current,
        isResizing: false,
        side: null,
        pointerId: null,
      };

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    // Add event listeners
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    // Define cleanup function
    function cleanupResizeListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);

      // Release any lingering pointer captures
      if (resizingState.current.pointerId !== null) {
        const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');
        handles.forEach((handle) => {
          if ((handle as HTMLElement).hasPointerCapture?.(resizingState.current.pointerId!)) {
            (handle as HTMLElement).releasePointerCapture(resizingState.current.pointerId!);
          }
        });

        // Reset state
        resizingState.current = {
          ...resizingState.current,
          isResizing: false,
          side: null,
          pointerId: null,
        };

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    }

    // Return the cleanup function
    // eslint-disable-next-line consistent-return
    return cleanupResizeListeners;
  }, [isDeviceModeOn, SCALING_FACTOR]);

  useEffect(() => {
    const handleWindowResize = () => {
      // Update the window width in the resizing state
      resizingState.current.windowWidth = window.innerWidth;

      // Update the current width in pixels
      if (containerRef.current && isDeviceModeOn) {
        const containerWidth = containerRef.current.clientWidth;
        setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Initial calculation of current width
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isDeviceModeOn, widthPercent]);

  // Update current width when device mode is toggled
  useEffect(() => {
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }
  }, [isDeviceModeOn]);

  const GripIcon = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: 'var(--bolt-elements-textSecondary, rgba(0,0,0,0.5))',
          fontSize: '10px',
          lineHeight: '5px',
          userSelect: 'none',
          marginLeft: '1px',
        }}
      >
        ••• •••
      </div>
    </div>
  );

  const openInNewWindow = (size: WindowSize) => {
    if (activePreview?.baseUrl) {
      const match = activePreview.baseUrl.match(/^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/);

      if (match) {
        const previewId = match[1];
        const previewUrl = `/webcontainer/preview/${previewId}`;

        // Adjust dimensions for landscape mode if applicable
        let width = size.width;
        let height = size.height;

        if (isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet')) {
          // Swap width and height for landscape mode
          width = size.height;
          height = size.width;
        }

        // Create a window with device frame if enabled
        if (showDeviceFrame && size.hasFrame) {
          // Calculate frame dimensions
          const frameWidth = size.frameType === 'mobile' ? (isLandscape ? 120 : 40) : 60; // Width padding on each side
          const frameHeight = size.frameType === 'mobile' ? (isLandscape ? 80 : 80) : isLandscape ? 60 : 100; // Height padding on top and bottom

          // Create a window with the correct dimensions first
          const newWindow = window.open(
            '',
            '_blank',
            `width=${width + frameWidth},height=${height + frameHeight + 40},menubar=no,toolbar=no,location=no,status=no`,
          );

          if (!newWindow) {
            console.error('Failed to open new window');
            return;
          }

          // Create the HTML content for the frame
          const frameColor = getFrameColor();
          const frameRadius = size.frameType === 'mobile' ? '36px' : '20px';
          const framePadding =
            size.frameType === 'mobile'
              ? isLandscape
                ? '40px 60px'
                : '40px 20px'
              : isLandscape
                ? '30px 50px'
                : '50px 30px';

          // Position notch and home button based on orientation
          const notchTop = isLandscape ? '50%' : '20px';
          const notchLeft = isLandscape ? '30px' : '50%';
          const notchTransform = isLandscape ? 'translateY(-50%)' : 'translateX(-50%)';
          const notchWidth = isLandscape ? '8px' : size.frameType === 'mobile' ? '60px' : '80px';
          const notchHeight = isLandscape ? (size.frameType === 'mobile' ? '60px' : '80px') : '8px';

          const homeBottom = isLandscape ? '50%' : '15px';
          const homeRight = isLandscape ? '30px' : '50%';
          const homeTransform = isLandscape ? 'translateY(50%)' : 'translateX(50%)';
          const homeWidth = isLandscape ? '4px' : '40px';
          const homeHeight = isLandscape ? '40px' : '4px';

          // Create HTML content for the wrapper page
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>${size.name} Preview</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  background: #f0f0f0;
                  overflow: hidden;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                
                .device-container {
                  position: relative;
                }
                
                .device-name {
                  position: absolute;
                  top: -30px;
                  left: 0;
                  right: 0;
                  text-align: center;
                  font-size: 14px;
                  color: #333;
                }
                
                .device-frame {
                  position: relative;
                  border-radius: ${frameRadius};
                  background: ${frameColor};
                  padding: ${framePadding};
                  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                  overflow: hidden;
                }
                
                /* Notch */
                .device-frame:before {
                  content: '';
                  position: absolute;
                  top: ${notchTop};
                  left: ${notchLeft};
                  transform: ${notchTransform};
                  width: ${notchWidth};
                  height: ${notchHeight};
                  background: #333;
                  border-radius: 4px;
                  z-index: 2;
                }
                
                /* Home button */
                .device-frame:after {
                  content: '';
                  position: absolute;
                  bottom: ${homeBottom};
                  right: ${homeRight};
                  transform: ${homeTransform};
                  width: ${homeWidth};
                  height: ${homeHeight};
                  background: #333;
                  border-radius: 50%;
                  z-index: 2;
                }
                
                iframe {
                  border: none;
                  width: ${width}px;
                  height: ${height}px;
                  background: white;
                  display: block;
                }
              </style>
            </head>
            <body>
              <div class="device-container">
                <div class="device-name">${size.name} ${isLandscape ? '(Landscape)' : '(Portrait)'}</div>
                <div class="device-frame">
                  <iframe src="${previewUrl}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin" allow="cross-origin-isolated"></iframe>
                </div>
              </div>
            </body>
            </html>
          `;

          // Write the HTML content to the new window
          newWindow.document.open();
          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          // Standard window without frame
          const newWindow = window.open(
            previewUrl,
            '_blank',
            `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`,
          );

          if (newWindow) {
            newWindow.focus();
          }
        }
      } else {
        console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl);
      }
    }
  };

  const openInNewTab = () => {
    const targetUrl = currentIframeSrc || activePreview?.baseUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  // Function to get the correct frame padding based on orientation
  const getFramePadding = useCallback(() => {
    if (!selectedWindowSize) {
      return '40px 20px';
    }

    const isMobile = selectedWindowSize.frameType === 'mobile';

    if (isLandscape) {
      // Increase horizontal padding in landscape mode to ensure full device frame is visible
      return isMobile ? '40px 60px' : '30px 50px';
    }

    return isMobile ? '40px 20px' : '50px 30px';
  }, [isLandscape, selectedWindowSize]);

  // Function to get the scale factor for the device frame
  const getDeviceScale = useCallback(() => {
    // Always return 1 to ensure the device frame is shown at its exact size
    return 1;
  }, [isLandscape, selectedWindowSize, widthPercent]);

  // Update the device scale when needed
  useEffect(() => {
    /*
     * Intentionally disabled - we want to maintain scale of 1
     * No dynamic scaling to ensure device frame matches external window exactly
     */
    // Intentionally empty cleanup function - no cleanup needed
    return () => {
      // No cleanup needed
    };
  }, [isDeviceModeOn, showDeviceFrameInPreview, getDeviceScale, isLandscape, selectedWindowSize]);

  // Function to get the frame color based on dark mode
  const getFrameColor = useCallback(() => {
    // Check if the document has a dark class or data-theme="dark"
    const isDarkMode =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Return a darker color for light mode, lighter color for dark mode
    return isDarkMode ? '#555' : '#111';
  }, []);

  // Effect to handle color scheme changes
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleColorSchemeChange = () => {
      // Force a re-render when color scheme changes
      if (showDeviceFrameInPreview) {
        setShowDeviceFrameInPreview(true);
      }
    };

    darkModeMediaQuery.addEventListener('change', handleColorSchemeChange);

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleColorSchemeChange);
    };
  }, [showDeviceFrameInPreview]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PREVIEW_DOM_READY') {
        finishPreviewLoad(true);
      } else if (event.data?.type === 'PREVIEW_UNLOADED') {
        beginPreviewLoad();
      } else if (event.data?.type === 'INSPECTOR_READY') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'INSPECTOR_ACTIVATE',
              active: isInspectorMode,
            },
            '*',
          );
        }
      } else if (event.data?.type === 'INSPECTOR_CLICK') {
        const element = event.data.elementInfo;

        navigator.clipboard.writeText(element.displayText).then(() => {
          setSelectedElement?.(element);
        });
      }
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [isInspectorMode, finishPreviewLoad, beginPreviewLoad, setSelectedElement]);

  const toggleInspectorMode = () => {
    const newInspectorMode = !isInspectorMode;
    setIsInspectorMode(newInspectorMode);

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'INSPECTOR_ACTIVATE',
          active: newInspectorMode,
        },
        '*',
      );
    }
  };

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col relative`}>
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-zinc-50/90 dark:bg-zinc-900/90 border-b border-zinc-200/90 dark:border-zinc-800/80 px-2.5 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Left: Traffic Lights & Navigation */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 mr-1 pl-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700/60" />
          </div>
          <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} title="Reload preview" />
          <button
            type="button"
            disabled={restarting}
            onClick={restartEnvironment}
            className="text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 px-2 py-1 rounded transition-colors"
            title="Stop environment processes, clear generated caches, and restart the dev server"
          >
            {restarting ? 'Restarting…' : 'Restart Environment'}
          </button>
          {slowPreview && (
            <span
              role="status"
              className="text-xs text-amber-500 dark:text-amber-400"
              title="Preview load exceeded 8 seconds; restarting may help"
            >
              Slow preview
            </span>
          )}
          {(restartError || databaseError) && (
            <span role="alert" className="text-xs text-red-500 dark:text-red-400">
              {restartError || databaseError}
            </span>
          )}
          <IconButton
            icon="i-ph:selection"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={isSelectionMode ? 'bg-zinc-200 text-violet-600 dark:bg-zinc-800 dark:text-violet-400' : ''}
            title="Selection Mode"
          />
        </div>

        {/* Center: Address Bar */}
        <div className="flex-1 min-w-[120px] max-w-sm flex items-center gap-1.5 bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 focus-within:border-violet-500/50 rounded-lg px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 transition-all shadow-inner">
          <div
            className="i-ph:lock-simple-fill text-xs text-emerald-500 dark:text-emerald-400/80 flex-shrink-0"
            title="Secure local container"
          />
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
          <input
            title="URL Path"
            ref={inputRef}
            className="w-full bg-transparent outline-none font-mono text-xs text-zinc-800 dark:text-zinc-200 min-w-0"
            type="text"
            value={displayPath}
            onChange={(event) => {
              setDisplayPath(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && activePreview) {
                let targetPath = displayPath.trim();

                if (!targetPath.startsWith('/')) {
                  targetPath = '/' + targetPath;
                }

                const fullUrl = activePreview.baseUrl + targetPath;
                beginPreviewLoad();
                setIframeUrl(fullUrl);
                setDisplayPath(targetPath);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
            disabled={!activePreview}
          />
        </div>

        {/* Right: PocketBase Status Badge & Viewport Tools */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activePreview && (
            <button
              onClick={openInNewTab}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200/80 border border-violet-300/80 text-violet-700 dark:bg-violet-600/20 dark:hover:bg-violet-600/30 dark:border-violet-500/40 dark:text-violet-300 text-xs font-medium transition-all shadow-sm"
              title="Open preview in a standalone browser tab"
            >
              <div className="i-ph:arrow-square-out text-xs" />
              <span className="hidden sm:inline text-[11px]">Open Tab</span>
            </button>
          )}

          <div
            className={`hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${
              databaseError
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400'
                : currentIframeSrc
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                databaseError
                  ? 'bg-rose-500 dark:bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                  : currentIframeSrc
                    ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                    : 'bg-amber-500 dark:bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="font-mono">
              {databaseError ? 'pb: error' : currentIframeSrc ? 'pb: connected' : 'pb: connecting'}
            </span>
          </div>

          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            className={isDeviceModeOn ? 'bg-zinc-200 text-violet-600 dark:bg-zinc-800 dark:text-violet-400' : ''}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />

          {expoUrl && <IconButton icon="i-ph:qr-code" onClick={() => setIsExpoQrModalOpen(true)} title="Show QR" />}

          <ExpoQrModal open={isExpoQrModalOpen} onClose={() => setIsExpoQrModalOpen(false)} />

          {isDeviceModeOn && (
            <>
              <IconButton
                icon="i-ph:device-rotate"
                onClick={() => setIsLandscape(!isLandscape)}
                title={isLandscape ? 'Switch to Portrait' : 'Switch to Landscape'}
              />
              <IconButton
                icon={showDeviceFrameInPreview ? 'i-ph:device-mobile' : 'i-ph:device-mobile-slash'}
                onClick={() => setShowDeviceFrameInPreview(!showDeviceFrameInPreview)}
                title={showDeviceFrameInPreview ? 'Hide Device Frame' : 'Show Device Frame'}
              />
            </>
          )}
          <IconButton
            icon="i-ph:cursor-click"
            onClick={toggleInspectorMode}
            className={isInspectorMode ? 'bg-zinc-200 !text-violet-600 dark:bg-zinc-800 dark:!text-violet-400' : ''}
            title={isInspectorMode ? 'Disable Element Inspector' : 'Enable Element Inspector'}
          />
          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />

          <div className="flex items-center relative">
            <IconButton
              icon="i-ph:list"
              onClick={() => setIsWindowSizeDropdownOpen(!isWindowSizeDropdownOpen)}
              title="New Window Options"
            />

            {isWindowSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsWindowSizeDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] max-h-[400px] overflow-y-auto bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="p-3 border-b border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#111827] dark:text-gray-300">Window Options</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={() => {
                          openInNewTab();
                        }}
                      >
                        <span>Open in new tab</span>
                        <div className="i-ph:arrow-square-out h-5 w-4" />
                      </button>
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={() => {
                          if (!activePreview?.baseUrl) {
                            console.warn('[Preview] No active preview available');
                            return;
                          }

                          const match = activePreview.baseUrl.match(
                            /^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/,
                          );

                          if (!match) {
                            console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl);
                            return;
                          }

                          const previewId = match[1];
                          const previewUrl = `/webcontainer/preview/${previewId}`;

                          // Open in a new window with simple parameters
                          window.open(
                            previewUrl,
                            `preview-${previewId}`,
                            'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes',
                          );
                        }}
                      >
                        <span>Open in new window</span>
                        <div className="i-ph:browser h-5 w-4" />
                      </button>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Show Device Frame</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                            showDeviceFrame ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'
                          } relative`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeviceFrame(!showDeviceFrame);
                          }}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                              showDeviceFrame ? 'transform translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Landscape Mode</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                            isLandscape ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'
                          } relative`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsLandscape(!isLandscape);
                          }}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                              isLandscape ? 'transform translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  {WINDOW_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className="w-full px-4 py-3.5 text-left text-[#111827] dark:text-gray-300 text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-gray-900 bg-white dark:bg-black"
                      onClick={() => {
                        setSelectedWindowSize(size);
                        setIsWindowSizeDropdownOpen(false);
                        openInNewWindow(size);
                      }}
                    >
                      <div
                        className={`${size.icon} w-5 h-5 text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200`}
                      />
                      <div className="flex-grow flex flex-col">
                        <span className="font-medium group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {size.name}
                        </span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet')
                            ? `${size.height} × ${size.width}`
                            : `${size.width} × ${size.height}`}
                          {size.hasFrame && showDeviceFrame ? ' (with frame)' : ''}
                        </span>
                      </div>
                      {selectedWindowSize.name === size.name && (
                        <div className="text-[#6D28D9] dark:text-[#6D28D9]">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 border-t border-bolt-elements-borderColor flex justify-center items-center overflow-auto relative">
        <WorkspaceSuspendedOverlay
          isSuspended={isSuspended}
          suspendedReason={suspendedReason}
          isResuming={isResuming}
          onResume={async () => {
            await resumeWorkspace();
            reloadPreview();
          }}
        />
        <div
          style={{
            width: isDeviceModeOn ? (showDeviceFrameInPreview ? '100%' : `${widthPercent}%`) : '100%',
            height: '100%',
            overflow: 'auto',
            background: 'var(--bolt-elements-background-depth-1)',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {activePreview ? (
            <>
              {isDeviceModeOn && showDeviceFrameInPreview ? (
                <div
                  className="device-wrapper"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    padding: '0',
                    overflow: 'auto',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}
                >
                  <div
                    className="device-frame-container"
                    style={{
                      position: 'relative',
                      borderRadius: selectedWindowSize.frameType === 'mobile' ? '36px' : '20px',
                      background: getFrameColor(),
                      padding: getFramePadding(),
                      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                      overflow: 'hidden',
                      transform: 'scale(1)',
                      transformOrigin: 'center center',
                      transition: 'all 0.3s ease',
                      margin: '40px',
                      width: isLandscape
                        ? `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 120 : 60)}px`
                        : `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 40 : 60)}px`,
                      height: isLandscape
                        ? `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 80 : 60)}px`
                        : `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 80 : 100)}px`,
                    }}
                  >
                    {/* Notch - positioned based on orientation */}
                    <div
                      style={{
                        position: 'absolute',
                        top: isLandscape ? '50%' : '20px',
                        left: isLandscape ? '30px' : '50%',
                        transform: isLandscape ? 'translateY(-50%)' : 'translateX(-50%)',
                        width: isLandscape ? '8px' : selectedWindowSize.frameType === 'mobile' ? '60px' : '80px',
                        height: isLandscape ? (selectedWindowSize.frameType === 'mobile' ? '60px' : '80px') : '8px',
                        background: '#333',
                        borderRadius: '4px',
                        zIndex: 2,
                      }}
                    />

                    {/* Home button - positioned based on orientation */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: isLandscape ? '50%' : '15px',
                        right: isLandscape ? '30px' : '50%',
                        transform: isLandscape ? 'translateY(50%)' : 'translateX(50%)',
                        width: isLandscape ? '4px' : '40px',
                        height: isLandscape ? '40px' : '4px',
                        background: '#333',
                        borderRadius: '50%',
                        zIndex: 2,
                      }}
                    />

                    <iframe
                      ref={iframeRef}
                      onLoad={() => {
                        finishPreviewLoad(false);
                        sendDbConfigToIframe();
                      }}
                      title="preview"
                      style={{
                        border: 'none',
                        width: isLandscape ? `${selectedWindowSize.height}px` : `${selectedWindowSize.width}px`,
                        height: isLandscape ? `${selectedWindowSize.width}px` : `${selectedWindowSize.height}px`,
                        background: 'var(--bolt-elements-background-depth-1)',
                        display: 'block',
                      }}
                      src={currentIframeSrc}
                      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                      allow="cross-origin-isolated"
                    />
                    <PreviewLoadingOverlay
                      isLoading={iframeLoading}
                      isStartingServer={!activePreview}
                      isConnectingDatabase={activePreview && !currentIframeSrc}
                      isRestarting={restarting}
                      isResuming={isResuming}
                      error={restartError || databaseError || previewAlertError}
                      onRestartEnvironment={restartEnvironment}
                      onReloadPreview={reloadPreview}
                      onOpenInNewTab={openInNewTab}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <iframe
                    ref={iframeRef}
                    onLoad={() => {
                      finishPreviewLoad(false);
                      sendDbConfigToIframe();
                    }}
                    title="preview"
                    className="border-none w-full h-full bg-bolt-elements-background-depth-1"
                    src={currentIframeSrc}
                    sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                    allow="geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; publickey-credentials-get; shared-storage-select-url; ch-ua-arch; bluetooth; compute-pressure; ch-prefers-reduced-transparency; deferred-fetch; usb; ch-save-data; publickey-credentials-create; shared-storage; deferred-fetch-minimal; run-ad-auction; ch-ua-form-factors; ch-downlink; otp-credentials; payment; ch-ua; ch-ua-model; ch-ect; autoplay; camera; private-state-token-issuance; accelerometer; ch-ua-platform-version; idle-detection; private-aggregation; interest-cohort; ch-viewport-height; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; join-ad-interest-group; ch-width; ch-prefers-reduced-motion; browsing-topics; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; attribution-reporting; fullscreen; identity-credentials-get; private-state-token-redemption; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; clipboard-write; microphone"
                  />
                  <PreviewLoadingOverlay
                    isLoading={iframeLoading}
                    isStartingServer={!activePreview}
                    isConnectingDatabase={activePreview && !currentIframeSrc}
                    isRestarting={restarting}
                    isResuming={isResuming}
                    error={restartError || databaseError || previewAlertError}
                    onRestartEnvironment={restartEnvironment}
                    onReloadPreview={reloadPreview}
                    onOpenInNewTab={openInNewTab}
                  />
                </div>
              )}
              <ScreenshotSelector
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                containerRef={iframeRef}
              />
            </>
          ) : (
            <PreviewLoadingOverlay
              isLoading={true}
              isStartingServer={true}
              isRestarting={restarting}
              isResuming={isResuming}
              error={restartError || databaseError || previewAlertError}
              onRestartEnvironment={restartEnvironment}
              onReloadPreview={reloadPreview}
              onOpenInNewTab={openInNewTab}
            />
          )}

          {isDeviceModeOn && !showDeviceFrameInPreview && (
            <>
              {/* Width indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,0.7))',
                  color: 'var(--bolt-elements-textPrimary, white)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  pointerEvents: 'none',
                  opacity: resizingState.current.isResizing ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              >
                {currentWidth}px
              </div>

              <ResizeHandle side="left" />
              <ResizeHandle side="right" />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
