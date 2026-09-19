import * as React from "react";
import { cn } from "~/lib/utils";
import {
  ChevronDown,
  Search,
  Terminal,
  Check,
  Globe,
  ExternalLink,
  FileCode2,
  FileText,
  Command,
  Database,
  AlertCircle,
  Cpu,
} from "lucide-react";
import {
  type TraceNode,
  type ToolDefinition,
  DEFAULT_TOOL_REGISTRY,
  renderDynamicIcon,
} from "./types";
import { TerminalCommand } from "./TerminalCommand";
import { FileDiff } from "./FileDiff";

export interface TracePillRowProps {
  node: TraceNode;
  isActive: boolean;
  isFinished: boolean;
  toolRegistry?: Record<string, ToolDefinition>;
}

export function TracePillRow({
  node,
  isActive,
  isFinished,
  toolRegistry = DEFAULT_TOOL_REGISTRY,
}: TracePillRowProps) {
  const [open, setOpen] = React.useState(false);

  const toolDef = node.toolName ? toolRegistry[node.toolName] : undefined;

  const isCommandNode = Boolean(
    node.command || node.type === "terminal" || node.type === "command"
  );

  const hasDetails = Boolean(
    isCommandNode ||
      node.renderContent ||
      toolDef?.renderCustomContent ||
      node.diffRows ||
      node.codeSnippet ||
      (node.details && node.details.length > 0) ||
      (node.sources && node.sources.length > 0) ||
      node.args ||
      node.result
  );

  const primaryText =
    node.primary ||
    (isCommandNode ? "Run" : undefined) ||
    (typeof toolDef?.label === "function" ? toolDef.label(node.args) : toolDef?.label) ||
    toolDef?.name ||
    node.type;

  const secondaryText =
    node.secondary ||
    node.command ||
    (toolDef?.formatChip ? toolDef.formatChip(node.args, node.result) : undefined) ||
    (typeof node.args === "string" ? node.args : undefined);

  const isMono = node.mono ?? (isCommandNode || Boolean(toolDef?.monoChip));

  const renderIcon = () => {
    if (isActive) {
      return (
        <span
          aria-hidden="true"
          className="size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-foreground"
        />
      );
    }
    if (node.status === "failed" || (node.exitCode !== undefined && node.exitCode > 0)) {
      return <AlertCircle className="size-3.5 text-rose-500 shrink-0" aria-hidden="true" />;
    }

    if (node.icon) return renderDynamicIcon(node.icon, node.iconClassName);
    if (toolDef?.icon) return renderDynamicIcon(toolDef.icon, toolDef.iconClassName);

    const semanticKey = `${node.primary || ""} ${node.toolName || ""} ${node.type || ""} ${node.command || ""}`.toLowerCase();

    if (semanticKey.includes("read") || semanticKey.includes("inspect") || semanticKey.includes("parse")) {
      return <FileText className="size-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />;
    }
    if (
      semanticKey.includes("edit") ||
      semanticKey.includes("write") ||
      semanticKey.includes("patch") ||
      semanticKey.includes("create")
    ) {
      return <FileCode2 className="size-3.5 text-amber-500 shrink-0" aria-hidden="true" />;
    }
    if (
      isCommandNode ||
      semanticKey.includes("run") ||
      semanticKey.includes("test") ||
      semanticKey.includes("compile") ||
      semanticKey.includes("tsc") ||
      semanticKey.includes("exec")
    ) {
      return <Terminal className="size-3.5 text-violet-500 shrink-0" aria-hidden="true" />;
    }
    if (semanticKey.includes("search") || semanticKey.includes("query") || semanticKey.includes("lookup")) {
      return <Search className="size-3.5 text-blue-500 shrink-0" aria-hidden="true" />;
    }
    if (semanticKey.includes("db") || semanticKey.includes("database") || semanticKey.includes("sql") || semanticKey.includes("redis")) {
      return <Database className="size-3.5 text-emerald-500 shrink-0" aria-hidden="true" />;
    }
    if (semanticKey.includes("deploy") || semanticKey.includes("canary") || semanticKey.includes("cluster")) {
      return <Cpu className="size-3.5 text-sky-500 shrink-0" aria-hidden="true" />;
    }
    if (node.type === "step") {
      return <Check className="size-3.5 text-emerald-500 shrink-0" aria-hidden="true" />;
    }

    return <Command className="size-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />;
  };

  return (
    <div className="flex flex-col my-0.5" style={{ animation: "agent-fade 280ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <button
        type="button"
        disabled={!hasDetails}
        aria-expanded={open}
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn(
          "group/row relative flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[12px] transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          hasDetails ? "hover:bg-muted/60 cursor-pointer active:scale-[0.98]" : "cursor-default"
        )}
      >
        <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <span
            className={cn(
              "transition-opacity duration-150 flex items-center justify-center",
              hasDetails && "group-hover/row:opacity-0",
              open && "opacity-0"
            )}
          >
            {renderIcon()}
          </span>
          {hasDetails && (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "absolute size-3.5 transition-transform duration-200 opacity-0",
                "group-hover/row:opacity-100",
                open ? "opacity-100 rotate-0" : "-rotate-90"
              )}
            />
          )}
        </span>

        <span className="shrink-0 text-[12px] font-medium text-foreground tracking-tight">
          {primaryText}
        </span>

        {secondaryText && (
          <span
            className={cn(
              "inline-flex h-5 min-w-0 max-w-[65%] items-center truncate rounded-md bg-muted/80 px-1.5 text-[11px] text-muted-foreground border border-border/40 transition-colors group-hover/row:border-border/80 group-hover/row:text-foreground",
              isMono ? "font-mono" : "font-sans"
            )}
          >
            <span className="truncate">{secondaryText}</span>
          </span>
        )}

        {(node.add !== undefined || node.del !== undefined) && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[11px] tabular-nums shrink-0">
            {node.add !== undefined && node.add > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{node.add}</span>
            )}
            {node.del !== undefined && node.del > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-medium">−{node.del}</span>
            )}
          </span>
        )}
      </button>

      {hasDetails && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-1 mb-1.5 ml-2.5 flex flex-col gap-1.5 border-l border-border/70 py-0.5 pl-2.5">
              {node.renderContent ? (
                node.renderContent()
              ) : toolDef?.renderCustomContent ? (
                toolDef.renderCustomContent({
                  args: node.args,
                  result: node.result,
                  node,
                })
              ) : null}

              {isCommandNode && node.command && (
                <TerminalCommand
                  command={node.command}
                  output={node.output}
                  exitCode={node.exitCode ?? 0}
                  durationMs={node.durationMs}
                  isRunning={isActive}
                />
              )}

              {node.diffRows && (
                <FileDiff
                  file={node.diffFile || (typeof node.secondary === "string" ? node.secondary : "patch.ts")}
                  rows={node.diffRows}
                />
              )}

              {!isCommandNode && node.details && node.details.length > 0 && (
                <div className="flex flex-col gap-1">
                  {node.details.map((line, lIdx) => (
                    <span
                      key={lIdx}
                      className={cn(
                        "text-[11.5px] leading-relaxed",
                        line.tone === "add" && "text-emerald-600 dark:text-emerald-400 font-mono",
                        line.tone === "del" && "text-rose-600 dark:text-rose-400 font-mono",
                        line.tone === "ctx" && "text-muted-foreground font-mono",
                        line.tone === "error" && "text-rose-600 dark:text-rose-400 font-medium",
                        (!line.tone || line.tone === "muted") && "text-muted-foreground"
                      )}
                    >
                      {line.text}
                    </span>
                  ))}
                </div>
              )}

              {!isCommandNode && !node.diffRows && node.codeSnippet && (
                <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto">
                  <pre className="whitespace-pre">{node.codeSnippet}</pre>
                </div>
              )}

              {node.sources && node.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {node.sources.map((src, sIdx) => (
                    <a
                      key={sIdx}
                      href={src.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-border hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Globe className="size-2.5 opacity-70" aria-hidden="true" />
                      <span>{src.name}</span>
                      <ExternalLink className="size-2.5 opacity-50" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
