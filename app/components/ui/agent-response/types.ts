import * as React from "react";
import { cn } from "~/lib/utils";
import {
  FileText,
  FileCode2,
  Terminal,
  Search,
  Database,
} from "lucide-react";
import type { DiffRow } from "./FileDiff";

export function renderDynamicIcon(icon: any, className?: string): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "function" || typeof icon === "object") {
    return React.createElement(icon, {
      className: cn("size-3.5 shrink-0", className),
      "aria-hidden": "true",
    });
  }
  return null;
}

export { PixelDotsLoader } from "./PixelDotsLoader";

export type TraceNodeType =
  | "reasoning"
  | "step"
  | "search"
  | "tool"
  | "terminal"
  | "diffs"
  | (string & {});

export type DetailLine = {
  text: string;
  tone?: "add" | "del" | "ctx" | "muted" | "error";
};

export interface ToolDefinition<TArgs = any, TResult = any> {
  name: string;
  label?: string | ((args: TArgs) => string);
  icon?: any;
  iconClassName?: string;
  formatChip?: (args: TArgs, result?: TResult) => string;
  monoChip?: boolean;
  renderCustomContent?: (props: {
    args?: TArgs;
    result?: TResult;
    node: TraceNode<TArgs, TResult>;
  }) => React.ReactNode;
}

export type TraceNode<TArgs = any, TResult = any> = {
  id?: string;
  type: TraceNodeType;
  toolName?: string;
  sentences?: string[];
  durationSeconds?: number;
  primary?: string;
  secondary?: string;
  mono?: boolean;
  icon?: any;
  iconClassName?: string;
  status?: "pending" | "running" | "completed" | "failed";
  args?: TArgs;
  result?: TResult;
  command?: string;
  output?: string;
  exitCode?: number;
  durationMs?: number;
  add?: number;
  del?: number;
  diffRows?: DiffRow[];
  diffFile?: string;
  codeSnippet?: string;
  details?: DetailLine[];
  sources?: { name: string; url?: string }[];
  renderContent?: () => React.ReactNode;
};

export type AgentPhase = {
  trace: TraceNode[];
  message?: string;
};

export const DEFAULT_TOOL_REGISTRY: Record<string, ToolDefinition> = {
  read_file: {
    name: "read_file",
    label: "Read",
    icon: FileText,
    iconClassName: "text-muted-foreground/80",
    monoChip: true,
  },
  edit_file: {
    name: "edit_file",
    label: "Edit",
    icon: FileCode2,
    iconClassName: "text-amber-500",
    monoChip: true,
  },
  execute_command: {
    name: "execute_command",
    label: "Run",
    icon: Terminal,
    iconClassName: "text-violet-500",
    monoChip: true,
  },
  search_web: {
    name: "search_web",
    label: "Search",
    icon: Search,
    iconClassName: "text-blue-500",
  },
  query_database: {
    name: "query_database",
    label: "SQL Query",
    icon: Database,
    iconClassName: "text-emerald-500",
    monoChip: true,
  },
};
