import * as React from "react";
import { cn } from "~/lib/utils";
import { Brain, ChevronDown } from "lucide-react";

export interface NestedReasoningBlockProps {
  sentences: string[];
  delays?: number[];
  isActive?: boolean;
  isFinished?: boolean;
  durationSeconds?: number;
  onFinished?: () => void;
}

const SENT_H = 46;
const GAP = 8;
const MAX_H = 184;
const FADE = 18;

export function NestedReasoningBlock({
  sentences,
  delays,
  isActive = false,
  isFinished = true,
  durationSeconds = 4.2,
  onFinished,
}: NestedReasoningBlockProps) {
  const [revealedCount, setRevealedCount] = React.useState(isFinished ? sentences.length : 0);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [fade, setFade] = React.useState({ top: false, bottom: true });
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const onFinishedRef = React.useRef(onFinished);
  onFinishedRef.current = onFinished;

  React.useEffect(() => {
    if (!isActive || isFinished) return;

    const cadence = delays || sentences.map(() => 1800 + Math.floor(Math.random() * 400));
    const totalMs = cadence.reduce((a, b) => a + b, 0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;

    cadence.forEach((delay, idx) => {
      cumulative += delay;
      timers.push(
        setTimeout(() => {
          setRevealedCount(idx + 1);
        }, cumulative)
      );
    });

    timers.push(
      setTimeout(() => {
        onFinishedRef.current?.();
      }, totalMs + 600)
    );

    return () => timers.forEach(clearTimeout);
  }, [isActive, isFinished, delays, sentences]);

  const expanded = isFinished ? manualOpen : isActive;
  const count = isFinished ? sentences.length : revealedCount;
  const contentH = count > 0 ? count * SENT_H + (count - 1) * GAP : 0;
  const capped = contentH > MAX_H;
  const viewH = capped ? MAX_H : contentH;
  const scrollable = isFinished && manualOpen;
  const translate = scrollable ? 0 : capped ? MAX_H - FADE - contentH : 0;

  const showTop = scrollable ? fade.top : capped;
  const showBottom = scrollable ? fade.bottom : capped;

  const mask = capped
    ? `linear-gradient(to bottom, transparent 0, #000 ${
        showTop ? FADE : 0
      }px, #000 calc(100% - ${showBottom ? FADE : 0}px), transparent 100%)`
    : "none";

  const onScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    setFade({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  };

  return (
    <div className="flex w-full flex-col my-0.5" style={{ animation: "agent-fade 280ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <button
        type="button"
        disabled={!isFinished}
        aria-expanded={expanded}
        onClick={() => isFinished && setManualOpen((v) => !v)}
        className={cn(
          "group/row relative flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[12px] transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          isFinished ? "hover:bg-muted/60 cursor-pointer active:scale-[0.98]" : "cursor-default"
        )}
      >
        <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <Brain
            aria-hidden="true"
            className={cn(
              "size-3.5 opacity-75 transition-opacity duration-150",
              isFinished && "group-hover/row:opacity-0",
              manualOpen && "opacity-0"
            )}
          />
          {isFinished && (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "absolute size-3.5 transition-transform duration-200 opacity-0",
                "group-hover/row:opacity-100",
                manualOpen ? "opacity-100 rotate-0" : "-rotate-90"
              )}
            />
          )}
        </span>

        <span className="text-[12px] font-medium transition-colors">
          {isFinished ? (
            <span className="text-foreground">
              Thought for <span className="tabular-nums font-mono text-[11.5px]">{durationSeconds}s</span>
            </span>
          ) : (
            <span
              className="bg-clip-text text-transparent font-medium"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-muted-foreground, oklch(0.55 0 0)) 35%, var(--color-foreground, oklch(0.95 0 0)) 50%, var(--color-muted-foreground, oklch(0.55 0 0)) 65%)",
                backgroundSize: "200% 100%",
                animation: "agent-shimmer 1.8s linear infinite",
              }}
            >
              Thinking…
            </span>
          )}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1 mb-1.5 ml-2.5 border-l border-border/70 py-0.5 pl-2.5">
            <div
              ref={viewportRef}
              className={cn(
                "overflow-hidden transition-[height] duration-300 ease-out pr-1",
                scrollable && "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              )}
              style={{
                height: `${viewH}px`,
                WebkitMaskImage: mask,
                maskImage: mask,
              }}
              onScroll={scrollable ? onScroll : undefined}
            >
              <div
                className="flex flex-col gap-2 transition-transform duration-400 ease-out will-change-transform"
                style={{ transform: `translateY(${translate}px)` }}
              >
                {sentences.slice(0, count).map((line, i) => (
                  <p
                    key={i}
                    className="m-0 h-[46px] text-[13px] font-[425] leading-[23px] tracking-tight text-muted-foreground line-clamp-2 overflow-hidden text-pretty"
                    style={{ animation: "agent-fade 250ms cubic-bezier(0.23,1,0.32,1) both" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
