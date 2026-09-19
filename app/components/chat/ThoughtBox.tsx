import { useMemo, type PropsWithChildren } from 'react';
import { NestedReasoningBlock } from '~/components/ui/ai-agent-response';

const ThoughtBox = ({ title = 'Thought process', children }: PropsWithChildren<{ title: string }>) => {
  const textContent = typeof children === 'string' ? children : '';
  const sentences = useMemo(() => {
    if (!textContent) return [];
    return textContent
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [textContent]);

  if (sentences.length > 0) {
    return (
      <div className="my-2.5 p-2 rounded-lg border border-border/80 bg-card/60 shadow-xs">
        <NestedReasoningBlock
          sentences={sentences}
          isFinished={true}
          durationSeconds={Math.max(1.5, Math.min(15, Math.round(sentences.length * 0.8)))}
        />
      </div>
    );
  }

  return (
    <div className="my-2.5 p-2 rounded-lg border border-border/80 bg-card/60 shadow-xs">
      <NestedReasoningBlock
        sentences={[typeof title === 'string' ? title : 'Reasoning process']}
        isFinished={true}
      />
      <div className="pl-4 pt-1.5 text-xs text-muted-foreground border-l border-border/70 ml-2.5 my-1">
        {children}
      </div>
    </div>
  );
};

export default ThoughtBox;
