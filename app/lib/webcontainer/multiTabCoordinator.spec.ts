import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  MultiTabCoordinator,
  WORKSPACE_CHANNEL_NAME,
  MAX_CONCURRENT_WEBCONTAINERS,
  type TabWorkspaceState,
} from './multiTabCoordinator';

// Mock BroadcastChannel for multi-tab testing
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: any }) => void) | null = null;
  static channels = new Map<string, Set<MockBroadcastChannel>>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: any) {
    const channelSet = MockBroadcastChannel.channels.get(this.name);
    if (!channelSet) return;
    for (const channel of channelSet) {
      if (channel !== this && channel.onmessage) {
        channel.onmessage({ data });
      }
    }
  }

  close() {
    const channelSet = MockBroadcastChannel.channels.get(this.name);
    if (channelSet) {
      channelSet.delete(this);
    }
  }
}

describe('MultiTabCoordinator', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.channels.clear();
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    MockBroadcastChannel.channels.clear();
    (globalThis as any).BroadcastChannel = originalBroadcastChannel;
  });

  it('initializes with unique tabId and default active state', () => {
    const coordinator = new MultiTabCoordinator();
    const state = coordinator.store.get();

    expect(coordinator.tabId).toBeDefined();
    expect(state.tabId).toBe(coordinator.tabId);
    expect(state.isSuspended).toBe(false);
    expect(state.suspendedReason).toBeNull();
    expect(state.runningContainersCount).toBe(1);

    coordinator.destroy();
  });

  it('enforces single active project policy (MAX_CONCURRENT_WEBCONTAINERS = 1)', () => {
    expect(MAX_CONCURRENT_WEBCONTAINERS).toBe(1);
  });

  it('blocks opening a second project when another tab has an active project', () => {
    const testChannel = new MockBroadcastChannel(WORKSPACE_CHANNEL_NAME);

    // Tab 1 is running Project 1
    const peerTab: TabWorkspaceState = {
      tabId: 'tab_peer_1',
      projectId: 'project-1',
      title: 'Active First Project',
      hasWebContainer: true,
      isActiveProject: true,
      isDevServerRunning: true,
      isVisible: true,
      isSuspended: false,
      suspendedReason: null,
      lastActiveTime: Date.now(),
      timestamp: Date.now(),
    };

    const coordinator = new MultiTabCoordinator(false); // Tab 2 starts without WebContainer
    testChannel.postMessage({ type: 'heartbeat', tab: peerTab });

    // Tab 2 attempts to start a project
    const canStart = coordinator.setActiveProject('project-2', 'Second Project');

    // Should return false and block
    expect(canStart).toBe(false);
    expect(coordinator.store.get().isBlockedByPeer).toBe(true);
    expect(coordinator.store.get().activePeerProject?.title).toBe('Active First Project');

    coordinator.destroy();
    testChannel.close();
  });

  it('broadcasts force-close-project when requesting takeover', () => {
    const testChannel = new MockBroadcastChannel(WORKSPACE_CHANNEL_NAME);
    const messages: any[] = [];
    testChannel.onmessage = (event) => {
      messages.push(event.data);
    };

    const peerTab: TabWorkspaceState = {
      tabId: 'tab_peer_1',
      projectId: 'project-1',
      title: 'Active First Project',
      hasWebContainer: true,
      isActiveProject: true,
      isDevServerRunning: true,
      isVisible: true,
      isSuspended: false,
      suspendedReason: null,
      lastActiveTime: Date.now(),
      timestamp: Date.now(),
    };

    const coordinator = new MultiTabCoordinator(false);
    testChannel.postMessage({ type: 'heartbeat', tab: peerTab });

    coordinator.setActiveProject('project-2', 'Second Project');
    expect(coordinator.store.get().isBlockedByPeer).toBe(true);

    // Request takeover
    coordinator.requestTakeover();

    const forceCloseMsg = messages.find((m) => m.type === 'force-close-project');
    expect(forceCloseMsg).toBeDefined();
    expect(forceCloseMsg.targetTabId).toBe('tab_peer_1');

    coordinator.destroy();
    testChannel.close();
  });

  it('handles remote force-close by entering suspended peer-takeover state', async () => {
    const testChannel = new MockBroadcastChannel(WORKSPACE_CHANNEL_NAME);
    const coordinator = new MultiTabCoordinator(true); // Tab has active container

    const forceClosedSpy = vi.fn();
    coordinator.onForceClosed(forceClosedSpy);

    // Another tab sends force-close-project to this coordinator
    testChannel.postMessage({
      type: 'force-close-project',
      targetTabId: coordinator.tabId,
      requesterTabId: 'tab_requester',
      requesterProjectTitle: 'New Takeover Project',
    });

    await Promise.resolve();

    expect(coordinator.store.get().isSuspended).toBe(true);
    expect(coordinator.store.get().suspendedReason).toBe('peer-takeover');
    expect(coordinator.store.get().isForceClosed).toBe(true);
    expect(forceClosedSpy).toHaveBeenCalled();

    coordinator.destroy();
    testChannel.close();
  });

  it('properly informs peers on tab close/destroy', () => {
    const testChannel = new MockBroadcastChannel(WORKSPACE_CHANNEL_NAME);
    const messages: any[] = [];
    testChannel.onmessage = (event) => {
      messages.push(event.data);
    };

    const coordinator = new MultiTabCoordinator();
    coordinator.destroy();

    const closeMessage = messages.find((m) => m.type === 'tab-close');
    expect(closeMessage).toBeDefined();
    expect(closeMessage.tabId).toBe(coordinator.tabId);

    testChannel.close();
  });

  it('uses the pocketapp_tabs channel name', () => {
    expect(WORKSPACE_CHANNEL_NAME).toBe('pocketapp_tabs');
  });
});
