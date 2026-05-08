import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type ReactNode,
  type Ref,
  type UIEvent,
} from 'react';
import { cn } from '@/lib/utils';

interface HighlightTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

function renderHighlightedText(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(VARIABLE_PATTERN)) {
    const start = match.index ?? 0;
    const variable = match[0];

    if (start > lastIndex) {
      nodes.push(value.slice(lastIndex, start));
    }

    nodes.push(
      <mark key={`${variable}-${start}`} className="rounded bg-pg-accent/15 px-0.5 text-pg-accent">
        {variable}
      </mark>,
    );
    lastIndex = start + variable.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  if (nodes.length === 0) {
    nodes.push(' ');
  }

  return nodes;
}

export const HighlightTextarea = forwardRef(function HighlightTextarea(
  { value, onChange, placeholder, className }: HighlightTextareaProps,
  forwardedRef: Ref<HTMLTextAreaElement>,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <div className={cn('relative min-h-[420px] overflow-hidden rounded-lg', className)}>
      <div
        ref={highlightRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-transparent px-3 py-3 font-mono text-sm leading-6 text-text-primary"
      >
        {value ? (
          renderHighlightedText(`${value}\n`)
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        className="relative z-10 min-h-[420px] w-full resize-none rounded-lg border border-border-subtle bg-transparent px-3 py-3 font-mono text-sm leading-6 text-transparent caret-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-pg-accent focus:ring-2 focus:ring-pg-accent/20"
        spellCheck={false}
        onChange={handleChange}
        onScroll={syncScroll}
      />
    </div>
  );
});
