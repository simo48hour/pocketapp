import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const PREVIEW_CHANNEL = 'preview-updates';

export async function loader({ params }: LoaderFunctionArgs) {
  const previewId = params.id;

  if (!previewId) {
    throw new Response('Preview ID is required', { status: 400 });
  }

  return json({ previewId });
}

export default function WebContainerPreview() {
  const { previewId } = useLoaderData<typeof loader>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>();

  const finishLoading = useCallback((immediate = false) => {
    clearTimeout(fallbackTimer.current);
    if (immediate) {
      setIsLoading(false);
    } else {
      // Generous safety fallback (25s): Keep overlay visible until PREVIEW_DOM_READY arrives
      fallbackTimer.current = setTimeout(() => {
        setIsLoading(false);
      }, 25000);
    }
  }, []);

  // Handle preview refresh
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      setIsLoading(true);
      // Force a clean reload
      iframeRef.current.src = '';
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = previewUrl;
        }
      });
    }
  }, [previewUrl]);

  // Notify other tabs that this preview is ready
  const notifyPreviewReady = useCallback(() => {
    if (broadcastChannelRef.current && previewUrl) {
      broadcastChannelRef.current.postMessage({
        type: 'preview-ready',
        previewId,
        url: previewUrl,
        timestamp: Date.now(),
      });
    }
  }, [previewId, previewUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PREVIEW_DOM_READY') {
        finishLoading(true);
      } else if (event.data?.type === 'PREVIEW_UNLOADED') {
        setIsLoading(true);
      }
    };

    window.addEventListener('message', handleMessage);

    const supportsBroadcastChannel = typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';

    if (supportsBroadcastChannel) {
      broadcastChannelRef.current = new window.BroadcastChannel(PREVIEW_CHANNEL);

      // Listen for preview updates
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.previewId === previewId) {
          if (event.data.type === 'refresh-preview' || event.data.type === 'file-change') {
            handleRefresh();
          }
        }
      };
    } else {
      broadcastChannelRef.current = undefined;
    }

    // Construct the WebContainer preview URL
    const url = `https://${previewId}.local-credentialless.webcontainer-api.io`;
    setPreviewUrl(url);

    // Set the iframe src
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    // Notify other tabs that this preview is ready
    notifyPreviewReady();

    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimer.current);
      broadcastChannelRef.current?.close();
    };
  }, [previewId, handleRefresh, notifyPreviewReady, finishLoading]);

  return (
    <div className="w-full h-full relative bg-white dark:bg-zinc-950">
      <iframe
        ref={iframeRef}
        title="WebContainer Preview"
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
        allow="cross-origin-isolated"
        loading="eager"
        onLoad={() => {
          notifyPreviewReady();
          finishLoading(false);
        }}
      />
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 text-center transition-opacity duration-300">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg flex items-center justify-center mb-4">
            <div className="i-ph:spinner-gap-bold text-2xl text-violet-600 dark:text-violet-400 animate-spin" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Loading Preview</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Compiling application in WebContainer...</p>
        </div>
      )}
    </div>
  );
}
