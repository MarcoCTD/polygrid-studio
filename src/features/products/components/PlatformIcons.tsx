import { Store, ShoppingBag, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Platform } from '../schema';

const PLATFORM_CONFIG: Record<Platform, { icon: typeof Store; label: string }> = {
  etsy: { icon: ShoppingBag, label: 'Etsy' },
  ebay: { icon: Store, label: 'eBay' },
  kleinanzeigen: { icon: MessageSquare, label: 'Kleinanzeigen' },
};

interface PlatformIconsProps {
  platforms: Platform[] | null;
  className?: string;
}

export function PlatformIcons({ platforms, className }: PlatformIconsProps) {
  if (!platforms || platforms.length === 0) {
    return <span className="text-text-muted">–</span>;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {platforms.map((p) => {
        const config = PLATFORM_CONFIG[p];
        const Icon = config.icon;
        return (
          <span key={p} title={config.label} className="text-text-secondary">
            <Icon size={14} />
          </span>
        );
      })}
    </div>
  );
}
