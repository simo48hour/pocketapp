import React from 'react';
import { cn } from '~/lib/utils';

export function ModelIcon({ model, className }: { model: string; className?: string }) {
  const lower = model.toLowerCase();
  const isGemini = lower.includes('gemini') || model === 'Auto' || lower.includes('google');
  const isClaude =
    lower.includes('claude') ||
    lower.includes('anthropic') ||
    lower.includes('opus');
  const isGpt = lower.includes('gpt') || lower.includes('openai');
  const isDeepseek = lower.includes('deepseek');
  const isXiaomi = lower.includes('xiaomi') || lower.includes('mimo');

  let iconSrc = '/icons/Default.svg';
  if (isGemini) {
    iconSrc = '/icons/Google.svg';
  } else if (isClaude) {
    iconSrc = '/icons/Anthropic.svg';
  } else if (isGpt) {
    iconSrc = '/icons/OpenAI.svg';
  } else if (isDeepseek) {
    iconSrc = '/icons/Deepseek.svg';
  } else if (isXiaomi) {
    iconSrc = '/icons/OpenRouter.svg';
  }

  const isDarkInvert = isGpt || isClaude;

  return (
    <img
      src={iconSrc}
      alt={model}
      className={cn('object-contain', isDarkInvert && 'dark:invert', className)}
      loading="lazy"
    />
  );
}

export function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DynamicBarsIcon({ level }: { level: string }) {
  const isMediumOrHigh = level === 'Medium' || level === 'Max Effort';
  const isHigh = level === 'Max Effort';

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={1} />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isMediumOrHigh ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isHigh ? 1 : 0.3} />
    </svg>
  );
}
