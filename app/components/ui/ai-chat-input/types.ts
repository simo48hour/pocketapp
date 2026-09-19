import type React from 'react';

export interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
  width?: number;
  height?: number;
}

export interface PromptInputProps {
  onSubmit?: (
    value: string,
    meta: { model: string; effort: string; attachments: File[] }
  ) => void;
  placeholder?: string;
  className?: string;
  models?: string[];
  efforts?: string[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxAttachments?: number;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;

  // PocketApp Integration Props
  isStreaming?: boolean;
  onStop?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  fullWidth?: boolean;
  extraActions?: React.ReactNode;
  onOpenSettings?: () => void;
  disabled?: boolean;
  isPro?: boolean;
  onModelSelectToggle?: (isOpen: boolean) => void;
  initialExpanded?: boolean;
  chatMode?: 'discuss' | 'build';
  onChatModeChange?: (mode: 'discuss' | 'build') => void;
}
