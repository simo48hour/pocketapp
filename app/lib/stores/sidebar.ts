import { atom } from 'nanostores';

export const isSidebarOpen = atom<boolean>(false);

export function toggleSidebar() {
  isSidebarOpen.set(!isSidebarOpen.get());
}

export function openSidebar() {
  isSidebarOpen.set(true);
}

export function closeSidebar() {
  isSidebarOpen.set(false);
}

if (typeof window !== 'undefined') {
  (window as any).isSidebarOpen = isSidebarOpen;
  (window as any).toggleSidebar = toggleSidebar;
  (window as any).openSidebar = openSidebar;
  (window as any).closeSidebar = closeSidebar;
}
