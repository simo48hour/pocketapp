import { useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  getMultiTabCoordinator,
  type SuspensionReason,
  type ActivePeerProject,
} from '~/lib/webcontainer/multiTabCoordinator';

export interface WorkspaceLifecycleOptions {
  projectId?: string;
  projectTitle?: string;
  inactivityTimeoutMs?: number;
}

export function useWorkspaceLifecycle(options: WorkspaceLifecycleOptions = {}) {
  const { projectId, projectTitle } = options;

  const coordinator = getMultiTabCoordinator();
  const coordinatorState = useStore(coordinator.store);

  useEffect(() => {
    if (projectId) {
      coordinator.setActiveProject(projectId, projectTitle || 'PocketApp Project');
    }
  }, [coordinator, projectId, projectTitle]);

  const resumeWorkspace = useCallback(async () => {
    try {
      await coordinator.resume();
    } catch (error) {
      console.error('[useWorkspaceLifecycle] Failed to resume workspace:', error);
    }
  }, [coordinator]);

  const requestTakeover = useCallback(() => {
    coordinator.requestTakeover();
  }, [coordinator]);

  return {
    tabId: coordinatorState.tabId,
    isSuspended: coordinatorState.isSuspended,
    suspendedReason: coordinatorState.suspendedReason,
    isThresholdExceeded: coordinatorState.isThresholdExceeded,
    activeTabsCount: coordinatorState.activeTabsCount,
    runningContainersCount: coordinatorState.runningContainersCount,
    isBackground: coordinatorState.isBackground,
    isResuming: coordinatorState.isResuming,
    isBlockedByPeer: coordinatorState.isBlockedByPeer,
    activePeerProject: coordinatorState.activePeerProject,
    isForceClosed: coordinatorState.isForceClosed,
    resumeWorkspace,
    requestTakeover,
  };
}

export type { SuspensionReason, ActivePeerProject };
