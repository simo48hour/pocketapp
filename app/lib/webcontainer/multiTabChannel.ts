import {
  type TabWorkspaceState,
  type WorkspaceChannelMessage,
  WORKSPACE_CHANNEL_NAME,
  HEARTBEAT_INTERVAL_MS,
  STALE_TAB_TIMEOUT_MS,
} from './multiTabTypes';

export class MultiTabChannel {
  #channel?: BroadcastChannel;
  #heartbeatTimer?: ReturnType<typeof setInterval>;
  readonly peerTabs = new Map<string, TabWorkspaceState>();
  #onMessageCallback: (message: WorkspaceChannelMessage) => void;
  #getHeartbeatState: () => TabWorkspaceState;

  constructor(
    getHeartbeatState: () => TabWorkspaceState,
    onMessage: (message: WorkspaceChannelMessage) => void,
  ) {
    this.#getHeartbeatState = getHeartbeatState;
    this.#onMessageCallback = onMessage;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.#channel = new BroadcastChannel(WORKSPACE_CHANNEL_NAME);
        this.#channel.onmessage = (event: MessageEvent<WorkspaceChannelMessage>) => {
          if (event.data && typeof event.data === 'object') {
            this.#onMessageCallback(event.data);
          }
        };

        this.#heartbeatTimer = setInterval(() => {
          this.sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
      } catch (error) {
        console.warn('[MultiTabChannel] BroadcastChannel initialization failed:', error);
      }
    }
  }

  postMessage(message: WorkspaceChannelMessage) {
    if (!this.#channel) return;
    try {
      this.#channel.postMessage(message);
    } catch (err) {
      console.warn('[MultiTabChannel] Failed to post message:', err);
    }
  }

  sendHeartbeat() {
    this.pruneStaleTabs();
    const state = this.#getHeartbeatState();
    state.timestamp = Date.now();
    this.postMessage({
      type: 'heartbeat',
      tab: { ...state },
    });
  }

  pruneStaleTabs() {
    const now = Date.now();
    for (const [id, peer] of this.peerTabs.entries()) {
      if (now - peer.timestamp > STALE_TAB_TIMEOUT_MS) {
        this.peerTabs.delete(id);
      }
    }
  }

  destroy(tabId: string) {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = undefined;
    }

    this.postMessage({
      type: 'tab-close',
      tabId,
    });

    if (this.#channel) {
      try {
        this.#channel.close();
      } catch (e) {
        /* Ignore on close */
      }
      this.#channel = undefined;
    }

    this.peerTabs.clear();
  }
}
