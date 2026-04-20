import { useEffect, useRef, useState, useCallback } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { productUpdateSchema, type ProductUpdate } from '../schema';
import { updateProduct } from '../db';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'validation-error' | 'error';

interface UseAutoSaveOptions {
  productId: string;
  form: UseFormReturn<ProductUpdate>;
  onSaved?: () => void;
}

interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  lastError: string | null;
  retry: () => void;
}

const DEBOUNCE_MS = 800;

export function useAutoSave({ productId, form, onSaved }: UseAutoSaveOptions): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isInitialRender = useRef(true);
  const lastSavedData = useRef<string>('');
  const pendingData = useRef<ProductUpdate | null>(null);

  const watchedValues = useWatch({ control: form.control });

  const performSave = useCallback(
    async (data: ProductUpdate) => {
      const result = productUpdateSchema.safeParse(data);
      if (!result.success) {
        setSaveStatus('validation-error');
        setLastError('Validierungsfehler');
        return;
      }

      // Filter out unchanged/empty fields to only send what changed
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(result.data)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }

      if (Object.keys(cleanData).length === 0) return;

      setSaveStatus('saving');
      setLastError(null);

      try {
        await updateProduct(productId, cleanData as ProductUpdate);
        setSaveStatus('saved');
        lastSavedData.current = JSON.stringify(data);
        onSaved?.();
      } catch (err) {
        setSaveStatus('error');
        setLastError(err instanceof Error ? err.message : 'Unbekannter Fehler');
        pendingData.current = data;
      }
    },
    [productId, onSaved],
  );

  const retry = useCallback(() => {
    if (pendingData.current) {
      performSave(pendingData.current);
    }
  }, [performSave]);

  useEffect(() => {
    // Skip initial render (don't auto-save the loaded values)
    if (isInitialRender.current) {
      isInitialRender.current = false;
      lastSavedData.current = JSON.stringify(watchedValues);
      return;
    }

    // Check if data actually changed
    const currentJson = JSON.stringify(watchedValues);
    if (currentJson === lastSavedData.current) return;

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      performSave(watchedValues as ProductUpdate);
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer.current);
  }, [watchedValues, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  return { saveStatus, lastError, retry };
}
