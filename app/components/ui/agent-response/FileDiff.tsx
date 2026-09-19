import * as React from "react";
import { cn } from "~/lib/utils";
import { Code2, Copy, CheckCheck } from "lucide-react";

export type DiffRow = {
  old?: number | null;
  cur?: number | null;
  type: "add" | "del" | "ctx";
  text: string;
};

export interface FileDiffProps {
  file: string;
  rows: DiffRow[];
  className?: string;
}

export function FileDiff({ file, rows = [], className }: FileDiffProps) {
  const [copied, setCopied] = React.useState(false);
  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "del").length;

  const handleCopy = () => {
    const textContent = rows
      .map((r) => `${r.type === "add" ? "+" : r.type === "del" ? "-" : " "} ${r.text}`)
      .join("\n");
    navigator.clipboard.writeText(textContent);
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
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-2.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="truncate font-medium text-foreground tracking-tight">{file}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className="flex items-center gap-1.5 tabular-nums text-[11px] font-semibold">
            {added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>}
            {removed > 0 && <span className="text-rose-600 dark:text-rose-400">−{removed}</span>}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied diff" : "Copy diff to clipboard"}
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

      {/* Code Gutter & Lines */}
      <div className="relative flex flex-col py-1.5 overflow-x-auto leading-[21px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-[70px] top-0 w-[1px] bg-border/60 z-1"
        />

        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "group relative grid grid-cols-[34px_34px_20px_1fr] items-stretch transition-colors duration-100",
              r.type === "add" && "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
              r.type === "del" && "bg-rose-500/10 dark:bg-rose-500/15 text-rose-950 dark:text-rose-100",
              r.type === "ctx" && "text-muted-foreground"
            )}
          >
            {r.type === "add" && (
              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500" aria-hidden="true" />
            )}
            {r.type === "del" && (
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                aria-hidden="true"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, #ef4444 0, #ef4444 1.5px, transparent 1.5px, transparent 3px)",
                }}
              />
            )}

            <span className={cn("select-none text-right pr-2 text-[10.5px] tabular-nums", r.type === "del" ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground/60")}>
              {r.old ?? ""}
            </span>
            <span className={cn("select-none text-right pr-2 text-[10.5px] tabular-nums", r.type === "add" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground/60")}>
              {r.cur ?? ""}
            </span>

            <span className={cn("select-none text-center text-[11px] font-bold", r.type === "add" && "text-emerald-600 dark:text-emerald-400", r.type === "del" && "text-rose-600 dark:text-rose-400")}>
              {r.type === "add" ? "+" : r.type === "del" ? "−" : ""}
            </span>

            <code className={cn("whitespace-pre pl-1 pr-3 text-[11.5px] font-mono", r.type === "add" ? "text-foreground font-medium" : r.type === "del" ? "text-foreground line-through opacity-80" : "text-muted-foreground")}>
              {r.text}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
