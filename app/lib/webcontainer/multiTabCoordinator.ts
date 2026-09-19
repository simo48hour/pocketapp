import { atom } from 'nanostores';
import { workbenchStore } from '~/lib/stores/workbench';
import { stopProcesses, isDevServerRunning } from '~/lib/webcontainer/processes';
import { streamingState } from '~/lib/stores/streaming';
import { revokeAllObjectURLs } from '~/utils/objectUrl';
import { MultiTabChannel } from './multiTabChannel';
import {
  type SuspensionReason,
  type TabWorkspaceState,
  type ActivePeerProject,
  type WorkspaceChannelMessage,
  type WorkspaceCoordinationState,
  MAX_CONCURRENT_WEBCONTAINERS,
} from './multiTabTypes';

export * from './multiTabTypes';

function createUniqueTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tab_${crypto.randomUUID()}`;
  }
  return `tab_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
}

export class MultiTabCoordinator {
  readonly tabId: string;
  #channelHelper?: MultiTabChannel;
  #freezeCallbacks = new Set<(reason: SuspensionReason) => void | Promise<void>>();
  #resumeCallbacks = new Set<() => void | Promise<void>>();
  #forceClosedCallbacks = new Set<() => void>();
  #listenersAttached = false;
  #streamingUnsub?: () => void;
  #restartingUnsub?: () => void;

  #boundVisibilityChange = this.#handleVisibilityChange.bind(this);
  #boundUnload = this.#handleUnload.bind(this);

  #localState: TabWorkspaceState;

  readonly store = atom<WorkspaceCoordinationState>({
    tabId: '',
    isSuspended: false,
    suspendedReason: null,
    isBackground: false,
    activeTabsCount: 1,
    runningContainersCount: 1,
    isThresholdExceeded: false,
    isResuming: false,
    isBlockedByPeer: false,
    activePeerProject: null,
    isForceClosed: false,
  });

  constructor(hasWebContainerOverride?: boolean) {
    this.tabId = createUniqueTabId();

    const isClient = typeof window !== 'undefined';
    const isVisible = isClient && typeof document !== 'undefined' ? !document.hidden : true;
    const initialHasWebContainer =
      hasWebContainerOverride !== undefined ? hasWebContainerOverride : isClient ? false : true;

    this.#localState = {
      tabId: this.tabId,
      projectId: 'default',
      title: isClient && typeof document !== 'undefined' ? document.title || 'PocketApp' : 'PocketApp',
      hasWebContainer: initialHasWebContainer,
      isActiveProject: initialHasWebContainer,
      isDevServerRunning: isDevServerRunning(),
      isVisible,
      isSuspended: false,
      suspendedReason: null,
      lastActiveTime: Date.now(),
      timestamp: Date.now(),
    };

    this.store.set({
      tabId: this.tabId,
      isSuspended: false,
      suspendedReason: null,
      isBackground: !isVisible,
      activeTabsCount: 1,
      runningContainersCount: initialHasWebContainer ? 1 : 0,
      isThresholdExceeded: false,
      isResuming: false,
      isBlockedByPeer: false,
      activePeerProject: null,
      isForceClosed: false,
    });

    if (typeof BroadcastChannel !== 'undefined') {
      this.#channelHelper = new MultiTabChannel(
        () => ({ ...this.#localState, isDevServerRunning: isDevServerRunning() }),
        (msg) => this.#handleMessage(msg),
      );

      this.#channelHelper.postMessage({
        type: 'announce',
        tab: { ...this.#localState, timestamp: Date.now() },
      });
    }

    if (isClient) {
      this.#setupBrowserListeners();
      this.#setupBusyMonitoring();
    }
  }

  setInactivityTimeoutMs(_ms: number) {
    /* No-op: Background dev server suspension is disabled to prevent infinite loading */
  }

  #setupBrowserListeners() {
    if (this.#listenersAttached || typeof window === 'undefined') return;

    document.addEventListener('visibilitychange', this.#boundVisibilityChange);
    window.addEventListener('beforeunload', this.#boundUnload);
    window.addEventListener('pagehide', this.#boundUnload);
    window.addEventListener('unload', this.#boundUnload);

    this.#listenersAttached = true;
  }

  #setupBusyMonitoring() {
    const checkAndBroadcastBusy = () => {
      const isStreaming = streamingState.get();
      const isRestarting = workbenchStore.restartingEnvironment.get();
      const isBusy = Boolean(isStreaming || isRestarting);

      this.#channelHelper?.postMessage({
        type: 'tab-busy',
        tabId: this.tabId,
        isBusy,
      });
    };

    this.#streamingUnsub = streamingState.subscribe(() => checkAndBroadcastBusy());
    this.#restartingUnsub = workbenchStore.restartingEnvironment.subscribe(() => checkAndBroadcastBusy());
  }

  #handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    const isHidden = document.hidden;
    this.updateLocalState({ isVisible: !isHidden });

    if (isHidden) {
      // Throttle terminal renders to save background CPU, but keep dev server running
      workbenchStore.pauseStreamsAndWatchers();
    } else {
      workbenchStore.resumeStreamsAndWatchers();
    }
  }

  #handleUnload() {
    console.log('[MultiTabCoordinator] Tab closing - releasing processes and buffers');

    void stopProcesses();
    workbenchStore.disposeAll();
    revokeAllObjectURLs();
    this.destroy();
  }

  #handleMessage(data: WorkspaceChannelMessage) {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'announce': {
        if (data.tab.tabId === this.tabId) return;
        this.#channelHelper?.peerTabs.set(data.tab.tabId, data.tab);
        this.#channelHelper?.postMessage({
          type: 'heartbeat',
          tab: { ...this.#localState, isDevServerRunning: isDevServerRunning(), timestamp: Date.now() },
        });
        this.#evaluateThreshold();
        break;
      }

      case 'heartbeat':
      case 'state-change': {
        if (data.tab.tabId === this.tabId) return;
        this.#channelHelper?.peerTabs.set(data.tab.tabId, data.tab);
        this.#evaluateThreshold();
        break;
      }

      case 'tab-close': {
        this.#channelHelper?.peerTabs.delete(data.tabId);
        this.#evaluateThreshold();
        break;
      }

      case 'tab-busy': {
        if (data.tabId === this.tabId) return;
        if (data.isBusy && !this.#localState.isVisible && !this.#localState.isSuspended) {
          workbenchStore.pauseStreamsAndWatchers();
        }
        break;
      }

      case 'force-close-project': {
        if (data.targetTabId === this.tabId) {
          console.log('[MultiTabCoordinator] Project closed remotely by peer tab:', data.requesterTabId);
          void this.#handleRemoteForceClose();
        }
        break;
      }
    }
  }

  async #handleRemoteForceClose() {
    this.#localState.hasWebContainer = false;
    this.#localState.isActiveProject = false;
    this.#localState.isSuspended = true;
    this.#localState.suspendedReason = 'peer-takeover';

    this.store.set({
      ...this.store.get(),
      isSuspended: true,
      suspendedReason: 'peer-takeover',
      isForceClosed: true,
      runningContainersCount: 0,
    });

    this.#channelHelper?.postMessage({
      type: 'state-change',
      tab: { ...this.#localState },
    });

    try {
      void stopProcesses();
      workbenchStore.disposeAll();
      workbenchStore.pauseStreamsAndWatchers();
    } catch (e) {
      console.warn('[MultiTabCoordinator] Error stopping processes on force close:', e);
    }

    for (const cb of this.#forceClosedCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error('[MultiTabCoordinator] Error in force-closed callback:', err);
      }
    }

    this.#evaluateThreshold();
  }

  #evaluateThreshold() {
    this.#channelHelper?.pruneStaleTabs();

    const peers = this.#channelHelper ? [...this.#channelHelper.peerTabs.values()] : [];
    const allTabs: TabWorkspaceState[] = [this.#localState, ...peers];
    const runningContainers = allTabs.filter((t) => (t.hasWebContainer || t.isActiveProject) && !t.isSuspended);

    const isThresholdExceeded = runningContainers.length > MAX_CONCURRENT_WEBCONTAINERS;

    // Active project in another tab
    const activePeer = peers.find(
      (t) => (t.hasWebContainer || t.isActiveProject) && !t.isSuspended && t.tabId !== this.tabId,
    );

    const activePeerProject: ActivePeerProject | null = activePeer
      ? { tabId: activePeer.tabId, projectId: activePeer.projectId, title: activePeer.title }
      : null;

    // This tab is blocked if a peer owns the project and this tab wants to open or run a project
    const isBlockedByPeer = Boolean(
      activePeerProject &&
        (this.#localState.hasWebContainer || this.#localState.isActiveProject) &&
        this.#localState.isSuspended,
    );

    this.store.set({
      tabId: this.tabId,
      isSuspended: this.#localState.isSuspended,
      suspendedReason: this.#localState.suspendedReason,
      isBackground: !this.#localState.isVisible,
      activeTabsCount: allTabs.length,
      runningContainersCount: runningContainers.length,
      isThresholdExceeded,
      isResuming: this.store.get().isResuming,
      isBlockedByPeer,
      activePeerProject,
      isForceClosed: this.store.get().isForceClosed,
    });
  }

  updateLocalState(partial: Partial<TabWorkspaceState>) {
    Object.assign(this.#localState, partial, { timestamp: Date.now() });

    if (partial.isVisible !== undefined && partial.isVisible) {
      this.#localState.lastActiveTime = Date.now();
    }

    this.#channelHelper?.postMessage({
      type: 'state-change',
      tab: { ...this.#localState },
    });

    this.#evaluateThreshold();
  }

  setActiveProject(projectId: string, title: string): boolean {
    this.#channelHelper?.pruneStaleTabs();

    const peers = this.#channelHelper ? [...this.#channelHelper.peerTabs.values()] : [];
    const activePeer = peers.find(
      (t) => (t.hasWebContainer || t.isActiveProject) && !t.isSuspended && t.tabId !== this.tabId,
    );

    if (activePeer) {
      // Force user to close opened project before starting another
      this.updateLocalState({
        projectId,
        title,
        isActiveProject: true,
        isSuspended: true,
        suspendedReason: 'tab-limit',
      });
      return false;
    }

    this.updateLocalState({
      projectId,
      title,
      isActiveProject: true,
      isSuspended: false,
      suspendedReason: null,
    });
    return true;
  }

  requestTakeover() {
    const current = this.store.get();
    if (current.activePeerProject) {
      this.#channelHelper?.postMessage({
        type: 'force-close-project',
        targetTabId: current.activePeerProject.tabId,
        requesterTabId: this.tabId,
        requesterProjectTitle: this.#localState.title,
      });
    }

    this.updateLocalState({
      isActiveProject: true,
      hasWebContainer: true,
      isSuspended: false,
      suspendedReason: null,
    });

    this.store.set({
      ...this.store.get(),
      isSuspended: false,
      suspendedReason: null,
      isBlockedByPeer: false,
      activePeerProject: null,
      isForceClosed: false,
    });
  }

  onForceClosed(callback: () => void): () => void {
    this.#forceClosedCallbacks.add(callback);
    return () => this.#forceClosedCallbacks.delete(callback);
  }

  onFreeze(callback: (reason: SuspensionReason) => void | Promise<void>): () => void {
    this.#freezeCallbacks.add(callback);
    return () => this.#freezeCallbacks.delete(callback);
  }

  onResume(callback: () => void | Promise<void>): () => void {
    this.#resumeCallbacks.add(callback);
    return () => this.#resumeCallbacks.delete(callback);
  }

  async freeze(reason: SuspensionReason = 'tab-limit') {
    if (this.#localState.isSuspended) return;

    this.#localState.isSuspended = true;
    this.#localState.suspendedReason = reason;

    this.store.set({
      ...this.store.get(),
      isSuspended: true,
      suspendedReason: reason,
    });

    this.#channelHelper?.postMessage({
      type: 'state-change',
      tab: { ...this.#localState },
    });

    for (const callback of this.#freezeCallbacks) {
      try {
        await callback(reason);
      } catch (err) {
        console.error('[MultiTabCoordinator] Error in freeze callback:', err);
      }
    }
  }

  async resume() {
    this.requestTakeover();

    this.store.set({
      ...this.store.get(),
      isResuming: true,
    });

    try {
      workbenchStore.resumeStreamsAndWatchers();
      void workbenchStore.resumeDevServer();
      workbenchStore.previewsStore.refreshAllPreviews();

      for (const callback of this.#resumeCallbacks) {
        try {
          await callback();
        } catch (err) {
          console.error('[MultiTabCoordinator] Error in resume callback:', err);
        }
      }

      this.#localState.isSuspended = false;
      this.#localState.suspendedReason = null;
      this.#localState.lastActiveTime = Date.now();

      this.store.set({
        ...this.store.get(),
        isSuspended: false,
        suspendedReason: null,
        isResuming: false,
        isBlockedByPeer: false,
      });

      this.#channelHelper?.postMessage({
        type: 'state-change',
        tab: { ...this.#localState },
      });

      this.#evaluateThreshold();
    } catch (err) {
      console.error('[MultiTabCoordinator] Error during resume:', err);
    } finally {
      this.store.set({
        ...this.store.get(),
        isResuming: false,
      });
    }
  }

  destroy() {
    if (this.#streamingUnsub) {
      this.#streamingUnsub();
      this.#streamingUnsub = undefined;
    }

    if (this.#restartingUnsub) {
      this.#restartingUnsub();
      this.#restartingUnsub = undefined;
    }

    if (this.#listenersAttached && typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#boundVisibilityChange);
      window.removeEventListener('beforeunload', this.#boundUnload);
      window.removeEventListener('pagehide', this.#boundUnload);
      window.removeEventListener('unload', this.#boundUnload);
      this.#listenersAttached = false;
    }

    this.#channelHelper?.destroy(this.tabId);
    this.#channelHelper = undefined;

    this.#freezeCallbacks.clear();
    this.#resumeCallbacks.clear();
    this.#forceClosedCallbacks.clear();
  }
}

// Global coordinator singleton per browser tab
let coordinatorInstance: MultiTabCoordinator | undefined;

export function getMultiTabCoordinator(): MultiTabCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new MultiTabCoordinator();
  }
  return coordinatorInstance;
}
