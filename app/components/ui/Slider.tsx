import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { genericMemo } from '~/utils/react';

export type SliderOptionItem<T> = {
  value: T;
  text: string;
  icon?: React.ReactNode;
};

export type SliderOptions<T> =
  | SliderOptionItem<T>[]
  | {
      left: { value: T; text: string; icon?: React.ReactNode };
      middle?: { value: T; text: string; icon?: React.ReactNode };
      right: { value: T; text: string; icon?: React.ReactNode };
    };

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(<T,>({ selected, options, setSelected }: SliderProps<T>) => {
  const items: SliderOptionItem<T>[] = Array.isArray(options)
    ? options
    : [
        options.left,
        ...(options.middle ? [options.middle] : []),
        options.right,
      ];

  return (
    <div className="flex items-center shrink-0 gap-0.5 bg-zinc-200/80 dark:bg-zinc-950/80 border border-zinc-300/80 dark:border-zinc-800/80 overflow-hidden rounded-lg p-0.5 shadow-inner">
      {items.map((item) => {
        const isSelected = selected === item.value;

        return (
          <SliderButton
            key={String(item.value)}
            selected={isSelected}
            setSelected={() => setSelected?.(item.value)}
          >
            <div className="flex items-center gap-1.5">
              {item.icon}
              <span>{item.text}</span>
            </div>
          </SliderButton>
        );
      })}
    </div>
  );
});

interface SliderButtonProps {
  selected: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  setSelected: () => void;
}

const SliderButton = memo(({ selected, children, setSelected }: SliderButtonProps) => {
  return (
    <button
      onClick={setSelected}
      className={classNames(
        'bg-transparent text-xs font-medium px-3 py-1 rounded-md relative transition-colors',
        selected
          ? 'text-white'
          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200',
      )}
    >
      <span className="relative z-10">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.18, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-violet-600 rounded-md shadow-sm"
        ></motion.span>
      )}
    </button>
  );
});
