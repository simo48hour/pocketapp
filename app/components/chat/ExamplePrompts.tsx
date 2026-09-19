import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'SaaS CRM with PocketBase auth & real-time leads' },
  { text: 'AI Image Generator with PocketBase file storage' },
  { text: 'Kanban task board with PocketBase collections' },
  { text: 'E-commerce store with product catalog & cart' },
  { text: 'Real-time collaborative chat with PocketBase' },
  { text: 'Developer portfolio with blog & contact form' },
];

export interface ExamplePromptsProps {
  onSelectPrompt?: (text: string) => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

export function ExamplePrompts(
  propsOrHandler?:
    | ExamplePromptsProps
    | ((event: React.UIEvent, messageInput?: string) => void | undefined),
) {
  const onSelect =
    typeof propsOrHandler === 'function'
      ? (text: string) => (propsOrHandler as any)(undefined, text)
      : propsOrHandler?.onSelectPrompt ||
        ((text: string) => propsOrHandler?.sendMessage?.(undefined as any, text));

  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                onSelect?.(examplePrompt.text);
              }}
              className="border border-zinc-800/80 hover:border-violet-500/40 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 px-3 py-1.2 text-xs font-medium transition-all shadow-xs cursor-pointer"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
