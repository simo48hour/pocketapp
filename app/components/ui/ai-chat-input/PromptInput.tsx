'use client';

import * as React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '~/lib/utils';
import type { Attachment, PromptInputProps } from './types';
import { FloatingAttachmentBar } from './FloatingAttachmentBar';
import { AttachmentGalleryModal } from './AttachmentGalleryModal';
import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import { ActionToolbar } from './ActionToolbar';
import { DynamicBarsIcon } from './Icons';
import { useAudioRecording } from './useAudioRecording';

const DEFAULT_MODELS = ['Auto', 'Claude 3.5 Sonnet', 'GPT-4o', 'DeepSeek R1', 'Gemini 3.5 Flash', 'Composer 2.5'];
const DEFAULT_EFFORTS = ['Low', 'Medium', 'Max Effort'];

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      onSubmit,
      placeholder = 'Ask anything...',
      className,
      models = DEFAULT_MODELS,
      efforts = DEFAULT_EFFORTS,
      defaultValue = '',
      value: controlledValue,
      onChange,
      maxAttachments = 6,
      attachments: controlledAttachments,
      onAttachmentsChange,
      isStreaming = false,
      onStop,
      selectedModel: controlledSelectedModel,
      onModelChange,
      extraActions,
      onOpenSettings,
      disabled = false,
      isPro = false,
      onModelSelectToggle,
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const [localValue, setLocalValue] = useState(defaultValue);
    const value = isControlled ? controlledValue : localValue;

    const [localSelectedModel, setLocalSelectedModel] = useState(models[0] || 'Auto');
    const selectedModel = controlledSelectedModel !== undefined ? controlledSelectedModel : localSelectedModel;

    const [effortIndex, setEffortIndex] = useState(1);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);

    const [localAttachments, setLocalAttachments] = useState<Attachment[]>([]);
    const attachments = controlledAttachments !== undefined ? controlledAttachments : localAttachments;

    const [activeAttachment, setActiveAttachment] = useState<{ attachment: Attachment; rect: DOMRect } | null>(null);

    const [textareaHeight, setTextareaHeight] = useState(80);
    const [isScrolling, setIsScrolling] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const topFadeRef = useRef<HTMLDivElement>(null);
    const bottomFadeRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

    const hasAttachments = attachments.length > 0;
    const hasValue = value.trim() !== '' || hasAttachments;

    const handleValueChange = useCallback(
      (val: string) => {
        if (!isControlled) setLocalValue(val);
        onChange?.(val);
      },
      [isControlled, onChange],
    );

    const { isRecording, audioData, startRecording, stopRecording } = useAudioRecording({
      value,
      onValueChange: handleValueChange,
      onStart: () => {},
    });

    const updateFades = () => {
      const el = textareaRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (topFadeRef.current) {
        topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString();
      }
      if (bottomFadeRef.current) {
        const bottomScroll = scrollHeight - clientHeight - scrollTop;
        bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString();
      }
    };

    // Auto-scroll textarea while voice recording
    useEffect(() => {
      if (isRecording && textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, [value, isRecording]);

    // Textarea height auto-grow calculation
    useEffect(() => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;

      const currentHeight = el.style.height;
      el.style.transition = 'none';
      el.style.height = '0px';
      const scrollHeight = el.scrollHeight;
      el.style.height = currentHeight;
      void el.offsetHeight;
      el.style.transition = '';

      const newHeight = Math.max(80, Math.min(scrollHeight, 240));
      el.style.height = `${newHeight}px`;

      setTextareaHeight(newHeight);
      setIsScrolling(scrollHeight > 240);

      setTimeout(updateFades, 0);
    }, [value]);

    // Close model dropdown on outside click
    useEffect(() => {
      if (!isModelSelectOpen) return;
      const handleOutsideClick = (e: MouseEvent) => {
        if (internalContainerRef.current && !internalContainerRef.current.contains(e.target as Node)) {
          setIsModelSelectOpen(false);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isModelSelectOpen]);

    const handleSubmit = () => {
      if (isStreaming) {
        onStop?.();
        return;
      }
      if (value.trim() === '' && !hasAttachments) return;

      onSubmit?.(value, {
        model: selectedModel,
        effort: efforts[effortIndex],
        attachments: attachments.map((a) => a.file),
      });

      handleValueChange('');
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      if (onAttachmentsChange) {
        onAttachmentsChange([]);
      } else {
        setLocalAttachments([]);
      }
      setIsModelSelectOpen(false);
    };

    const cycleEffort = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEffortIndex((prev) => (prev + 1) % efforts.length);
    };

    const openFileChooser = (e: React.MouseEvent) => {
      e.stopPropagation();
      fileInputRef.current?.click();
    };

    const addAttachment = (file: File, url: string, width: number, height: number) => {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
      const newAtt = { id, file, url, name: file.name, width, height };
      if (onAttachmentsChange) {
        onAttachmentsChange([...attachments, newAtt]);
      } else {
        setLocalAttachments((prev) => [...prev, newAtt]);
      }
    };

    const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
      e.target.value = '';

      if (files.length === 0) return;
      const room = Math.max(0, maxAttachments - attachments.length);
      const accepted = files.slice(0, room);

      for (const file of accepted) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => addAttachment(file, url, img.naturalWidth, img.naturalHeight);
        img.onerror = () => addAttachment(file, url, 800, 600);
        img.src = url;
      }
    };

    const removeAttachment = (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const updated = attachments.filter((a) => a.id !== id);
      if (onAttachmentsChange) {
        onAttachmentsChange(updated);
      } else {
        setLocalAttachments(updated);
      }
      thumbRefs.current.delete(id);
    };

    const onActionButtonClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (isStreaming) {
        onStop?.();
      } else if (isRecording) {
        stopRecording();
      } else if (hasValue) {
        handleSubmit();
      } else {
        startRecording();
      }
    };

    return (
      <>
        <div
          ref={(node) => {
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
            // @ts-ignore
            internalContainerRef.current = node;
          }}
          className={cn('relative flex flex-col w-full mx-auto', isModelSelectOpen ? 'z-50' : 'z-20', className)}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesChosen}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Floating Attachment Tab (Slides up behind prompt input) */}
          <FloatingAttachmentBar
            hasAttachments={hasAttachments}
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onOpenAttachment={(a, rect) => setActiveAttachment({ attachment: a, rect })}
            registerThumbRef={(id, el) => thumbRefs.current.set(id, el)}
          />

          {/* Main Input Card - Permanently Open */}
          <div
            onMouseDown={(e) => {
              const isInteractive = (e.target as HTMLElement).closest('button, input, textarea, a');
              if (!isInteractive && textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
            style={{
              borderRadius: 24,
              minHeight: Math.max(136, textareaHeight + 54),
            }}
            className={cn(
              'relative w-full border border-border bg-card shadow-lg focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/20 hover:border-border/90 z-10 transition-shadow duration-200 cursor-text',
              disabled && 'opacity-60 pointer-events-none',
            )}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onScroll={updateFades}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={placeholder}
              aria-label="Prompt"
              disabled={isRecording || disabled}
              className={cn(
                'prompt-scrollbar w-full resize-none bg-transparent px-4.5 pt-4 pb-14 text-[15px] sm:text-base leading-[24px] text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/80 cursor-text',
                isScrolling ? 'overflow-y-auto' : 'overflow-y-hidden',
                isRecording && 'pointer-events-none',
              )}
            />

            <div
              ref={topFadeRef}
              className="absolute left-4.5 right-12 top-0 z-[2] h-6 bg-gradient-to-b from-card via-card/90 to-transparent pointer-events-none opacity-0 transition-opacity duration-150"
            />
            <div
              ref={bottomFadeRef}
              className="absolute left-4.5 right-12 z-[2] h-6 bg-gradient-to-t from-card via-card/90 to-transparent pointer-events-none opacity-0 transition-opacity duration-150"
              style={{
                top: `${textareaHeight - 20}px`,
              }}
            />

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-3 inset-x-3.5 z-10 flex items-center justify-between gap-2 pointer-events-auto select-none">
              {/* Left side: Model dropdown, Effort toggle, Extra actions */}
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                <ModelSelectorDropdown
                  selectedModel={selectedModel}
                  models={models}
                  isPro={isPro}
                  isOpen={isModelSelectOpen}
                  onToggleOpen={() => {
                    setIsModelSelectOpen((prev) => {
                      const next = !prev;
                      onModelSelectToggle?.(next);
                      return next;
                    });
                  }}
                  onSelectModel={(model) => {
                    if (!isControlled) setLocalSelectedModel(model);
                    onModelChange?.(model);
                    setIsModelSelectOpen(false);
                  }}
                  onOpenSettings={() => {
                    setIsModelSelectOpen(false);
                    onOpenSettings?.();
                  }}
                />

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cycleEffort}
                  className="group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/60 transition-all duration-200 hover:bg-accent/60 hover:text-foreground outline-none cursor-pointer shrink-0"
                  title="Reasoning / Effort Level"
                >
                  <DynamicBarsIcon level={efforts[effortIndex]} />
                  <span className="text-xs font-semibold select-none transition-colors">
                    {efforts[effortIndex]}
                  </span>
                </button>

                {extraActions}
              </div>

              {/* Right side: Attachment Plus button, audio waveform, action button (Mic/Send/Stop) */}
              <ActionToolbar
                onOpenFileChooser={openFileChooser}
                attachmentsCount={attachments.length}
                maxAttachments={maxAttachments}
                isRecording={isRecording}
                audioData={audioData}
                isStreaming={isStreaming}
                hasValue={hasValue}
                onActionButtonClick={onActionButtonClick}
              />
            </div>
          </div>
        </div>

        {activeAttachment && (
          <AttachmentGalleryModal
            attachment={activeAttachment.attachment}
            originRect={activeAttachment.rect}
            onClose={() => setActiveAttachment(null)}
          />
        )}
      </>
    );
  },
);

PromptInput.displayName = 'PromptInput';
