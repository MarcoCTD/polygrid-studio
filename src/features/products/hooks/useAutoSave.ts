import { useEffect, useRef, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { productUpdateSchema, type ProductUpdate } from '../schema';
import { updateProduct } from '../db';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'validation-error' | 'error';

interface UseAutoSaveOptions {
  productId: string;
  form: UseFormReturn<ProductUpdate>;
  enabled?: boolean;
  onSaved?: () => void;
}

interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  lastError: string | null;
  retry: () => void;
}

const DEBOUNCE_MS = 800;

/**
 * Prepares form values for partial validation.
 * HTML inputs produce "" for empty text fields. productUpdateSchema is .partial(),
 * so undefined = "field not provided" (skipped). But "" is a present value that
 * still gets validated against min() constraints. We convert "" → undefined so
 * the partial schema treats empty fields as absent.
 */
function prepareForPartialValidation(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '') {
      // Empty string → treat as "not provided" for partial schema
      cleaned[key] = undefined;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function useAutoSave({
  productId,
  form,
  enabled = true,
  onSaved,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedData = useRef<string>('');
  const pendingData = useRef<ProductUpdate | null>(null);
  const onSavedRef = useRef(onSaved);
  const hasInitialized = useRef(false);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  // Watch all form values for changes
  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    console.log('[AutoSave] Effect triggered', {
      enabled,
      hasInitialized: hasInitialized.current,
      productId,
    });

    // Don't do anything while data is still loading
    if (!enabled) {
      console.log('[AutoSave] Skipped: not enabled (still loading)');
      return;
    }

    const currentJson = JSON.stringify(watchedValues);

    // First run after enabled becomes true: snapshot the loaded data, don't save
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastSavedData.current = currentJson;
      console.log('[AutoSave] Initialized with loaded data snapshot', {
        dataLength: currentJson.length,
      });
      return;
    }

    // Check if data actually changed from last saved/loaded snapshot
    if (currentJson === lastSavedData.current) {
      console.log('[AutoSave] Skipped: data unchanged from snapshot');
      return;
    }

    console.log('[AutoSave] Data changed, scheduling debounced save');

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      async function save() {
        const rawData = watchedValues as Record<string, unknown>;
        console.log('[AutoSave] Debounce fired, validating...', {
          nameField: rawData.name,
          categoryField: rawData.category,
          productId,
        });

        // Convert empty strings → undefined so partial schema skips them
        const prepared = prepareForPartialValidation(rawData);

        const result = productUpdateSchema.safeParse(prepared);
        if (!result.success) {
          console.log('[AutoSave] Validation FAILED', {
            errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          });
          setSaveStatus('validation-error');
          const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
          setLastError(messages.join(', '));

          // Set errors on form fields so they appear under the inputs
          form.clearErrors();
          for (const issue of result.error.issues) {
            const fieldPath = issue.path.join('.') as keyof ProductUpdate;
            if (fieldPath) {
              form.setError(fieldPath, {
                type: 'validation',
                message: issue.message,
              });
            }
          }
          return;
        }

        console.log('[AutoSave] Validation passed');

        // Clear any previous validation errors from form
        form.clearErrors();

        // Filter out undefined fields — only send what's actually set
        const cleanData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(result.data)) {
          if (value !== undefined) {
            cleanData[key] = value;
          }
        }

        if (Object.keys(cleanData).length === 0) {
          console.log('[AutoSave] No clean data to save');
          return;
        }

        setSaveStatus('saving');
        setLastError(null);

        console.log('[AutoSave] Calling DB update', {
          productId,
          fieldCount: Object.keys(cleanData).length,
          fields: Object.keys(cleanData),
        });

        try {
          await updateProduct(productId, cleanData as ProductUpdate);
          console.log('[AutoSave] DB update SUCCESS');
          setSaveStatus('saved');
          lastSavedData.current = JSON.stringify(watchedValues);
          pendingData.current = null;
          onSavedRef.current?.();
        } catch (err) {
          console.error('[AutoSave] DB update FAILED', err);
          setSaveStatus('error');
          setLastError(err instanceof Error ? err.message : 'Unbekannter Fehler');
          pendingData.current = cleanData as ProductUpdate;
        }
      }

      save();
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer.current);
  }, [watchedValues, productId, enabled, form]);

  // Reset initialization when enabled transitions from false → true
  // (happens when product data loads and formReady becomes true)
  const prevEnabled = useRef(false);
  useEffect(() => {
    if (!prevEnabled.current && enabled) {
      // enabled just became true — fresh start
      hasInitialized.current = false;
      console.log('[AutoSave] Enabled transition: resetting initialization');
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  // Retry
  const retry = () => {
    if (pendingData.current) {
      const data = pendingData.current;
      setSaveStatus('saving');
      setLastError(null);
      console.log('[AutoSave] Retrying save...');
      updateProduct(productId, data)
        .then(() => {
          console.log('[AutoSave] Retry SUCCESS');
          setSaveStatus('saved');
          lastSavedData.current = JSON.stringify(data);
          pendingData.current = null;
          onSavedRef.current?.();
        })
        .catch((err) => {
          console.error('[AutoSave] Retry FAILED', err);
          setSaveStatus('error');
          setLastError(err instanceof Error ? err.message : 'Unbekannter Fehler');
        });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  return { saveStatus, lastError, retry };
}
