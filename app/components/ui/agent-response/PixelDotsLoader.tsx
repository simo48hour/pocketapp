import * as React from "react";
import { cn } from "~/lib/utils";

const CHEVRON_DELAYS = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

export function PixelDotsLoader({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 grid-cols-[repeat(3,3px)] gap-[1.5px] items-center",
        className
      )}
    >
      {CHEVRON_DELAYS.map((delay, index) => (
        <span
          key={index}
          className="size-[3px] rounded-full bg-foreground/80 transition-opacity motion-reduce:animate-none"
          style={{
            opacity: 0.2,
            animation: `agent-pixel-on 650ms cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}
