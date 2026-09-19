import { AnimatePresence, cubicBezier, motion } from 'framer-motion';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ show, isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className="absolute flex justify-center items-center top-[14px] right-[14px] p-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg w-[32px] h-[32px] shadow-[0_0_12px_rgba(139,92,246,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
        >
          <div className="text-base flex items-center justify-center">
            {!isStreaming ? <div className="i-ph:arrow-up-bold"></div> : <div className="i-ph:stop-fill text-sm"></div>}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
