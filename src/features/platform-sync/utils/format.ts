export function formatRelativeDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 30) return `vor ${days} Tagen`;
  return date.toLocaleDateString('de-DE');
}

export function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '-';
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '-';
  const diff = Math.max(end - start, 0);
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(1)}s`;
}

export function formatPayload(value: string | null): string {
  if (!value) return '-';
  return value.length > 800 ? `${value.slice(0, 800)}...` : value;
}
