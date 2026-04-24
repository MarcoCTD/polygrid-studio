import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureOneDriveStructure, setOneDriveBasePath } from '@/services/filesystem';

interface OneDriveSetupDialogProps {
  onConfigured: (path: string) => void;
}

export function OneDriveSetupDialog({ onConfigured }: OneDriveSetupDialogProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectFolder() {
    setIsSelecting(true);
    setError(null);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const polyGridPath = appendPolyGridFolder(selected);
      await ensureOneDriveStructure(polyGridPath);
      await setOneDriveBasePath(polyGridPath);
      onConfigured(polyGridPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSelecting(false);
    }
  }

  return (
    <div className="flex min-h-[560px] items-center justify-center bg-bg-primary p-6">
      <section className="w-full max-w-xl rounded-lg border border-border bg-bg-elevated p-6 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            <FolderOpen size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">OneDrive einrichten</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Wähle deinen OneDrive-Ordner. PolyGrid Studio legt darin automatisch einen Unterordner
              /PolyGrid Studio/ an.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-danger bg-danger-subtle p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <Button onClick={handleSelectFolder} disabled={isSelecting} className="gap-2">
          <FolderOpen size={16} />
          {isSelecting ? 'Ordner wird geprüft...' : 'Ordner auswählen'}
        </Button>
      </section>
    </div>
  );
}

function appendPolyGridFolder(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  const trimmed = path.replace(/[\\/]+$/, '');
  return `${trimmed}${separator}PolyGrid Studio`;
}
