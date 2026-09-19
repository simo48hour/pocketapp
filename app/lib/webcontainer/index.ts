import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';
import { hydrateDependencies } from './dependency-cache';
import { getMultiTabCoordinator } from './multiTabCoordinator';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

let _bootPromise: Promise<WebContainer> | null = import.meta.hot?.data.webcontainer ?? null;
let _hydrationPromise: Promise<void> | null = import.meta.hot?.data.hydrationPromise ?? null;

export function isWebContainerBooted(): boolean {
  return _bootPromise !== null;
}

export function bootWebContainer(): Promise<WebContainer> {
  if (import.meta.env.SSR) {
    return new Promise(() => {});
  }

  if (_bootPromise) {
    return _bootPromise;
  }

  console.info('[WebContainer] Booting on-demand...');

  _bootPromise = Promise.resolve()
    .then(() => {
      return WebContainer.boot({
        coep: 'require-corp',
        workdirName: WORK_DIR_NAME,
        forwardPreviewErrors: true, // Enable error forwarding from iframes
      });
    })
    .then(async (container) => {
      try {
        getMultiTabCoordinator().updateLocalState({ hasWebContainer: true });
      } catch (err) {
        console.warn('[WebContainer] Could not update coordinator state:', err);
      }

      _hydrationPromise = hydrateDependencies(container)
        .then(() => {
          webcontainerContext.loaded = true;
        })
        .catch((err) => {
          console.warn('[WebContainer] Hydration error:', err);
        });

      const { workbenchStore } = await import('~/lib/stores/workbench');

      try {
        const response = await fetch('/inspector-script.js');
        const inspectorScript = await response.text();
        await container.setPreviewScript(inspectorScript);
      } catch (err) {
        console.warn('[WebContainer] Failed to load inspector script:', err);
      }

      // Listen for preview errors
      container.on('preview-message', (message) => {
        // Handle both uncaught exceptions and unhandled promise rejections
        if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
          const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
          const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
          workbenchStore.actionAlert.set({
            type: 'preview',
            title,
            description: 'message' in message ? message.message : 'Unknown error',
            content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
            source: 'preview',
          });
        }
      });

      workbenchStore.initStoresWithWebContainer(container);

      return container;
    });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = _bootPromise;
    import.meta.hot.data.hydrationPromise = _hydrationPromise;
  }

  return _bootPromise;
}

class LazyPromise<T> extends Promise<T> {
  private _executor: () => Promise<T>;
  private _target: Promise<T> | null = null;

  constructor(executor: () => Promise<T>) {
    super(() => {});
    this._executor = executor;
  }

  static get [Symbol.species]() {
    return Promise;
  }

  private _getTarget(): Promise<T> {
    if (!this._target) {
      this._target = this._executor();
    }
    return this._target;
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._getTarget().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this._getTarget().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | null): Promise<T> {
    return this._getTarget().finally(onfinally);
  }
}

export const webcontainer: Promise<WebContainer> = new LazyPromise<WebContainer>(() => {
  return bootWebContainer();
});

export const hydrationPromise: Promise<void> = new LazyPromise<void>(async () => {
  await bootWebContainer();
  if (_hydrationPromise) {
    await _hydrationPromise;
  }
});
