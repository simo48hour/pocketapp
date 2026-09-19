export interface SidebarProject {
  id: string;
  name: string;
  description?: string;
  color?: string; // e.g. 'purple', 'blue', 'emerald', 'amber', 'rose', 'cyan'
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_COLORS = [
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-500', lightBg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-500', lightBg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-500', lightBg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500', text: 'text-amber-500', lightBg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500', text: 'text-rose-500', lightBg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-500', text: 'text-cyan-500', lightBg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
] as const;

export type ProjectColorId = (typeof PROJECT_COLORS)[number]['id'];
