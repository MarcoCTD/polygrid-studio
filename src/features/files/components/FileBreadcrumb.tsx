import { ChevronRight } from 'lucide-react';

interface FileBreadcrumbProps {
  rootPath: string;
  selectedPath: string;
  onNavigate: (path: string) => void;
}

interface BreadcrumbSegment {
  label: string;
  path: string;
}

export function FileBreadcrumb({ rootPath, selectedPath, onNavigate }: FileBreadcrumbProps) {
  const segments = buildSegments(rootPath, selectedPath);

  return (
    <nav className="flex min-h-9 flex-wrap items-center gap-1 text-sm text-text-secondary">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <div key={segment.path} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight size={13} className="text-text-muted" /> : null}
            {isLast ? (
              <span className="font-medium text-text-primary">{segment.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(segment.path)}
                className="rounded-md px-1.5 py-1 hover:bg-bg-hover hover:text-text-primary"
              >
                {segment.label}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function buildSegments(rootPath: string, selectedPath: string): BreadcrumbSegment[] {
  const normalizedRoot = rootPath.replace(/[\\/]+$/, '');
  const normalizedSelected = selectedPath.replace(/[\\/]+$/, '');

  if (normalizedRoot === normalizedSelected) {
    return [{ label: 'PolyGrid Studio', path: rootPath }];
  }

  const relative = normalizedSelected.slice(normalizedRoot.length).replace(/^[\\/]+/, '');
  const separator = selectedPath.includes('\\') ? '\\' : '/';
  const parts = relative.split(/[\\/]+/).filter(Boolean);
  const segments: BreadcrumbSegment[] = [{ label: 'PolyGrid Studio', path: rootPath }];

  let currentPath = normalizedRoot;
  for (const part of parts) {
    currentPath = `${currentPath}${separator}${part}`;
    segments.push({ label: part, path: currentPath });
  }

  return segments;
}
