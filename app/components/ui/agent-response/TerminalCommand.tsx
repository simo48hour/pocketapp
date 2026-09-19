import * as React from "react";
import { cn } from "~/lib/utils";
import { Terminal, Copy, CheckCheck } from "lucide-react";

export interface TerminalCommandProps {
  command: string;
  output?: string;
  exitCode?: number;
  durationMs?: number;
  isRunning?: boolean;
  className?: string;
}

export function TerminalCommand({
  command,
  output,
  exitCode = 0,
  durationMs,
  isRunning = false,
  className,
}: TerminalCommandProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const fullText = output ? `$ ${command}\n\n${output}` : `$ ${command}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-lg border border-border/80 bg-card font-mono text-[11.5px] shadow-xs select-text",
        className
      )}
    >
      {/* Terminal Command Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Terminal className="size-3.5 text-violet-500 shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/60 select-none font-bold">$</span>
          <span className="truncate font-semibold text-foreground tracking-tight">{command}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {durationMs !== undefined && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {durationMs}ms
            </span>
          )}

          {isRunning ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10.5px] font-medium text-violet-600 dark:text-violet-400">
              <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
              running
            </span>
          ) : exitCode === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
              exit 0
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-600 dark:text-rose-400 tabular-nums">
              exit {exitCode}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied command and output" : "Copy command"}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm px-1 py-0.5 active:scale-[0.96]"
          >
            {copied ? (
              <CheckCheck className="size-3 text-emerald-500" aria-hidden="true" />
            ) : (
              <Copy className="size-3" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Stdout Output Area */}
      {output && (
        <div className="relative p-2.5 overflow-x-auto bg-muted/20 text-[11px] leading-relaxed text-muted-foreground">
          <pre className="whitespace-pre font-mono">
            {output.split("\n").map((line, idx) => {
              const isPass = line.includes("✓") || line.includes("PASS") || line.includes("passed");
              const isFail = line.includes("FAIL") || line.includes("Error") || line.includes("failed");
              const isWarn = line.includes("WARN") || line.includes("warning");

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-1",
                    isPass && "text-emerald-600 dark:text-emerald-400 font-medium",
                    isFail && "text-rose-600 dark:text-rose-400 font-medium",
                    isWarn && "text-amber-600 dark:text-amber-400",
                    !isPass && !isFail && !isWarn && "text-muted-foreground"
                  )}
                >
                  <span>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}
