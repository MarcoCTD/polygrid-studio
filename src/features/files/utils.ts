export function validateFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name darf nicht leer sein.';
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Name darf keinen Schrägstrich enthalten.';
  }

  return null;
}

export function getBaseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function isImageFile(fileName: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(fileName);
}

export function isHiddenFile(name: string): boolean {
  return name.startsWith('.');
}

export function formatUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  return JSON.stringify(err);
}
