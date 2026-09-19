import * as React from "react";
import { cn } from "~/lib/utils";
import type { AgentPhase, ToolDefinition } from "./types";
import { ThinkingState } from "./ThinkingState";

export interface StreamingTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  speed?: number;
  chunkSize?: number;
  onComplete?: () => void;
}

export function StreamingText({
  text,
  speed = 18,
  chunkSize = 2,
  className,
  onComplete,
  ...props
}: StreamingTextProps) {
  const [shown, setShown] = React.useState("");
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += chunkSize;
      const nextText = text.slice(0, i);
      setShown(nextText);
      if (i >= text.length) {
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, chunkSize]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "font-sans text-[14.5px] leading-relaxed text-foreground/90 select-text whitespace-pre-line text-pretty",
        className
      )}
      {...props}
    >
      {shown}
    </div>
  );
}

export interface AgentWorkflowProps extends React.HTMLAttributes<HTMLDivElement> {
  phases: AgentPhase[];
  tools?: Record<string, ToolDefinition>;
  workingLabel?: string;
  onComplete?: () => void;
}

export function AgentWorkflow({
  phases = [],
  tools,
  workingLabel = "Working...",
  onComplete,
  className,
  ...props
}: AgentWorkflowProps) {
  const [currentPhaseIdx, setCurrentPhaseIdx] = React.useState(0);
  const [phaseStatus, setPhaseStatus] = React.useState<"trace" | "message">("trace");
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  const handleTraceSettled = React.useCallback((idx: number) => {
    if (idx === currentPhaseIdx) {
      if (phases[idx]?.message) {
        setPhaseStatus("message");
      } else if (idx < phases.length - 1) {
        setCurrentPhaseIdx((prev) => prev + 1);
        setPhaseStatus("trace");
      } else {
        onCompleteRef.current?.();
      }
    }
  }, [currentPhaseIdx, phases]);

  const handleMessageCompleted = React.useCallback((idx: number) => {
    if (idx === currentPhaseIdx) {
      if (idx < phases.length - 1) {
        setCurrentPhaseIdx((prev) => prev + 1);
        setPhaseStatus("trace");
      } else {
        onCompleteRef.current?.();
      }
    }
  }, [currentPhaseIdx, phases]);

  return (
    <div className={cn("flex flex-col gap-4 w-full", className)} {...props}>
      {phases.map((phase, idx) => {
        if (idx > currentPhaseIdx) return null;

        const isCurrentPhase = idx === currentPhaseIdx;
        const shouldShowTrace = true;
        const shouldPlayTrace = isCurrentPhase && phaseStatus === "trace";
        const isTraceFinished = !isCurrentPhase || phaseStatus === "message";

        const shouldShowMessage = isTraceFinished && !!phase.message;
        const shouldStreamMessage = isCurrentPhase && phaseStatus === "message";

        return (
          <div key={idx} className="flex flex-col gap-1">
            {shouldShowTrace && (
              <ThinkingState
                nodes={phase.trace}
                tools={tools}
                autoPlay={shouldPlayTrace}
                workingLabel={workingLabel}
                onSettled={() => handleTraceSettled(idx)}
              />
            )}

            {shouldShowMessage && phase.message && (
              <div className="pt-0 animate-[agent-fade_300ms_ease-out_both]">
                {shouldStreamMessage ? (
                  <StreamingText
                    text={phase.message}
                    speed={18}
                    chunkSize={2}
                    onComplete={() => handleMessageCompleted(idx)}
                  />
                ) : (
                  <div className="font-sans text-[14.5px] leading-relaxed text-foreground/90 select-text whitespace-pre-line text-pretty">
                    {phase.message}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
