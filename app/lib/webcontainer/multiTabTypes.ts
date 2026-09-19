export type SuspensionReason = 'tab-limit' | 'peer-takeover' | null;

export interface TabWorkspaceState {
  tabId: string;
  projectId: string;
  title: string;
  hasWebContainer: boolean;
  isActiveProject: boolean;
  isDevServerRunning: boolean;
  isVisible: boolean;
  isSuspended: boolean;
  suspendedReason: SuspensionReason;
  lastActiveTime: number;
  timestamp: number;
}

export interface ActivePeerProject {
  tabId: string;
  projectId: string;
  title: string;
}

export type WorkspaceChannelMessage =
  | { type: 'heartbeat'; tab: TabWorkspaceState }
  | { type: 'announce'; tab: TabWorkspaceState }
  | { type: 'state-change'; tab: TabWorkspaceState }
  | { type: 'force-close-project'; targetTabId: string; requesterTabId: string; requesterProjectTitle?: string }
  | { type: 'tab-close'; tabId: string }
  | { type: 'tab-busy'; tabId: string; isBusy: boolean };

export interface WorkspaceCoordinationState {
  tabId: string;
  isSuspended: boolean;
  suspendedReason: SuspensionReason;
  isBackground: boolean;
  activeTabsCount: number;
  runningContainersCount: number;
  isThresholdExceeded: boolean;
  isResuming: boolean;
  isBlockedByPeer: boolean;
  activePeerProject: ActivePeerProject | null;
  isForceClosed: boolean;
}

export const WORKSPACE_CHANNEL_NAME = 'pocketapp_tabs';
export const MAX_CONCURRENT_WEBCONTAINERS = 1;
export const HEARTBEAT_INTERVAL_MS = 2500;
export const STALE_TAB_TIMEOUT_MS = 7500;
