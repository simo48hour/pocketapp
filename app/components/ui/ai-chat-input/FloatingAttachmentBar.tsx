import React from 'react';
import type { Attachment } from './types';
import { AttachmentThumb } from './AttachmentThumb';

interface FloatingAttachmentBarProps {
  hasAttachments: boolean;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onOpenAttachment: (attachment: Attachment, rect: DOMRect) => void;
  registerThumbRef: (id: string, el: HTMLButtonElement | null) => void;
}

export function FloatingAttachmentBar({
  hasAttachments,
  attachments,
  onRemoveAttachment,
  onOpenAttachment,
  registerThumbRef,
}: FloatingAttachmentBarProps) {
  return (
    <div
      aria-hidden={!hasAttachments}
      style={{
        height: hasAttachments ? 68 : 0,
        transition: 'height 0.2s ease-out',
      }}
      className="w-full relative z-0 overflow-hidden"
    >
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: 20,
          right: 20,
          height: 68,
          transform: hasAttachments ? 'translateY(0)' : 'translateY(100%)',
          opacity: hasAttachments ? 1 : 0,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        }}
        className="border border-border border-b-0 bg-muted/90 rounded-t-2xl px-2 pt-2 pb-1 flex items-start gap-2 overflow-x-auto prompt-scrollbar shadow-xs"
      >
        {attachments.map((attachment, index) => (
          <AttachmentThumb
            key={attachment.id}
            attachment={attachment}
            index={index}
            onRemove={onRemoveAttachment}
            onOpen={(a, rect) => onOpenAttachment(a, rect)}
            registerRef={(id, el) => registerThumbRef(id, el)}
          />
        ))}
      </div>
    </div>
  );
}
