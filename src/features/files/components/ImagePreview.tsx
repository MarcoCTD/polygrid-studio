import { convertFileSrc } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImagePreviewProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function ImagePreview({ filePath, fileName, onClose }: ImagePreviewProps) {
  const imageUrl = convertFileSrc(filePath);

  return (
    <aside className="w-[280px] shrink-0 border-l border-border-subtle bg-bg-elevated">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-text-primary" title={fileName}>
          {fileName}
        </h2>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
          <X size={16} />
        </Button>
      </div>
      <div className="p-3">
        <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border-subtle bg-bg-primary p-2">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-h-[400px] max-w-full object-contain"
            draggable={false}
          />
        </div>
      </div>
    </aside>
  );
}
