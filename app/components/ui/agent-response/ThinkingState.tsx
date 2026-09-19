import * as React from "react";
import { cn } from "~/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  type TraceNode,
  type ToolDefinition,
  DEFAULT_TOOL_REGISTRY,
  PixelDotsLoader,
} from "./types";
import { NestedReasoningBlock } from "./NestedReasoningBlock";
import { TracePillRow } from "./TracePillRow";

export interface ThinkingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes?: TraceNode[];
  tools?: Record<string, ToolDefinition>;
  autoPlay?: boolean;
  defaultExpanded?: boolean;
  workingLabel?: string;
  onSettled?: () => void;
}

export const ThinkingState = React.forwardRef<HTMLDivElement, ThinkingStateProps>(
  (
    {
      nodes = [],
      tools = DEFAULT_TOOL_REGISTRY,
      autoPlay = true,
      defaultExpanded,
      workingLabel = "Working...",
      onSettled,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const totalNodes = nodes.length;
    const [activeIndex, setActiveIndex] = React.useState(autoPlay ? 0 : totalNodes);
    const [isWorking, setIsWorking] = React.useState(autoPlay);
    const [manualExpanded, setManualExpanded] = React.useState<boolean | null>(
      defaultExpanded !== undefined ? defaultExpanded : null
    );

    const startTimeRef = React.useRef<number>(Date.now());
    const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
    const isWorkingRef = React.useRef(isWorking);
    isWorkingRef.current = isWorking;

    const onSettledRef = React.useRef(onSettled);
    onSettledRef.current = onSettled;

    React.useEffect(() => {
      if (!autoPlay) return;
      startTimeRef.current = Date.now();

      const timer = setInterval(() => {
        if (!isWorkingRef.current) {
          clearInterval(timer);
          return;
        }
        const diff = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setElapsedSeconds(diff);
      }, 250);

      return () => clearInterval(timer);
    }, [autoPlay]);

    const advanceStep = React.useCallback(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= totalNodes) {
          setIsWorking(false);
          const finalDuration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
          setElapsedSeconds(finalDuration);
        }
        return next;
      });
    }, [totalNodes]);

    React.useEffect(() => {
      if (!autoPlay || !isWorking || activeIndex >= totalNodes) return;

      const currentNode = nodes[activeIndex];
      if (currentNode?.type === "reasoning") return;

      const delay =
        currentNode?.type === "tool" || currentNode?.type === "terminal"
          ? 2200
          : currentNode?.type === "search"
          ? 2400
          : 1700;

      const timer = setTimeout(() => {
        advanceStep();
      }, delay);

      return () => clearTimeout(timer);
    }, [activeIndex, autoPlay, isWorking, totalNodes, nodes, advanceStep]);

    React.useEffect(() => {
      if (!isWorking && autoPlay) {
        onSettledRef.current?.();
      }
    }, [isWorking, autoPlay]);

    const isGlobalExpanded = manualExpanded !== null ? manualExpanded : isWorking;

    return (
      <div
        ref={ref}
        className={cn("flex w-full flex-col font-sans select-none text-foreground", className)}
        style={style}
        {...props}
      >
        <style>{`
          @keyframes agent-pixel-on {
            0%, 100% { opacity: 0.15; transform: scale(0.9); }
            50% { opacity: 0.95; transform: scale(1.1); }
          }
          @keyframes agent-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes agent-fade {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Master Header Trigger */}
        <button
          type="button"
          aria-expanded={isGlobalExpanded}
          onClick={() => setManualExpanded((prev) => !(prev !== null ? prev : isWorking))}
          className={cn(
            "group flex w-fit items-center gap-1.5 p-0 bg-transparent text-left transition-colors duration-150 cursor-pointer",
            "text-muted-foreground/75 hover:text-foreground font-normal text-[13.5px] leading-relaxed",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-xs"
          )}
        >
          {isWorking && <PixelDotsLoader />}

          <span className="text-[13.5px] font-normal transition-colors">
            {isWorking ? (
              <span
                className="bg-clip-text text-transparent font-medium"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-muted-foreground, oklch(0.55 0 0)) 35%, var(--color-foreground, oklch(0.95 0 0)) 50%, var(--color-muted-foreground, oklch(0.55 0 0)) 65%)",
                  backgroundSize: "200% 100%",
                  animation: "agent-shimmer 1.5s linear infinite",
                }}
              >
                {workingLabel}
              </span>
            ) : (
              <span>
                Worked for <span className="tabular-nums font-mono text-[12px]">{elapsedSeconds}</span> {elapsedSeconds === 1 ? "second" : "seconds"}
              </span>
            )}
          </span>

          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3 opacity-30 transition-transform duration-300 group-hover:opacity-80",
              isGlobalExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </button>

        {/* Master Collapsible Timeline Channel */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            isGlobalExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-1 ml-2 border-l border-border/60 py-0.5 pl-2 flex flex-col gap-0.5">
              {nodes.slice(0, activeIndex + 1).map((node, idx) => {
                const isNodeActive = idx === activeIndex && isWorking;
                const isNodeFinished = idx < activeIndex || !isWorking;

                if (node.type === "reasoning" && node.sentences) {
                  return (
                    <NestedReasoningBlock
                      key={idx}
                      sentences={node.sentences}
                      durationSeconds={node.durationSeconds}
                      isActive={isNodeActive}
                      isFinished={isNodeFinished}
                      onFinished={advanceStep}
                    />
                  );
                }

                return (
                  <TracePillRow
                    key={idx}
                    node={node}
                    isActive={isNodeActive}
                    isFinished={isNodeFinished}
                    toolRegistry={tools}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
ThinkingState.displayName = "ThinkingState";
