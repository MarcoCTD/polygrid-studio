import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function DetailPanel() {
  const open = useUIStore((s) => s.detailPanelOpen);
  const content = useUIStore((s) => s.detailPanelContent);
  const close = useUIStore((s) => s.closeDetailPanel);

  if (!open) return null;

  return (
    <aside
      className={cn(
        'h-screen w-[400px] shrink-0 border-l border-border-subtle bg-bg-elevated overflow-y-auto',
        'shadow-md dark:bg-bg-elevated-2 dark:border-transparent dark:shadow-lg',
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle p-4">
        <span className="text-sm font-semibold text-text-primary">Details</span>
        <button
          onClick={close}
          className="rounded-md p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">{content}</div>
    </aside>
  );
}
