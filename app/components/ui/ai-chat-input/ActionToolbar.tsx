import React from 'react';
import { cn } from '~/lib/utils';
import { PlusIcon, ArrowUpIcon, MicIcon, StopIcon } from './Icons';

interface ActionToolbarProps {
  onOpenFileChooser: (e: React.MouseEvent) => void;
  attachmentsCount: number;
  maxAttachments: number;
  isRecording: boolean;
  audioData: number[];
  isStreaming: boolean;
  hasValue: boolean;
  onActionButtonClick: (e: React.MouseEvent) => void;
}

export function ActionToolbar({
  onOpenFileChooser,
  attachmentsCount,
  maxAttachments,
  isRecording,
  audioData,
  isStreaming,
  hasValue,
  onActionButtonClick,
}: ActionToolbarProps) {
  const showArrow = (hasValue || isStreaming) && !isRecording;
  const showStop = isStreaming || isRecording;
  const showMic = !hasValue && !isRecording && !isStreaming;

  return (
    <div className="flex items-center gap-2 shrink-0 select-none">
      {/* Audio Wave Visualizer Overlay (Voice Recording) */}
      {isRecording && (
        <div className="flex h-7 items-center justify-end gap-[3px] pr-1">
          {audioData.map((val, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-primary transition-[height] duration-75 ease-out"
              style={{ height: `${Math.max(4, val * 22)}px` }}
            />
          ))}
        </div>
      )}

      {/* Attachment Plus Button */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenFileChooser}
        disabled={attachmentsCount >= maxAttachments}
        className="flex size-7 items-center justify-center rounded-full text-foreground/60 transition-all duration-200 hover:bg-accent/60 hover:text-foreground outline-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        title="Attach image"
      >
        <PlusIcon />
      </button>

      {/* Action Button: Mic -> ArrowUp -> Stop */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={onActionButtonClick}
        aria-label={
          isStreaming ? 'Stop generation' : showArrow ? 'Send prompt' : showStop ? 'Stop recording' : 'Use voice input'
        }
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 hover:opacity-90 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
          isStreaming && 'bg-rose-600 hover:bg-rose-700 text-white',
        )}
      >
        {showArrow && !isStreaming && <ArrowUpIcon />}
        {showMic && !isStreaming && <MicIcon />}
        {showStop && <StopIcon />}
      </button>
    </div>
  );
}
