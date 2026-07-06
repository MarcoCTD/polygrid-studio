import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumberFieldProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Einheit rechts im Feld, z.B. "%", "EUR", "Tage" */
  unit?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  'aria-label'?: string;
  /** Wird nach Blur/Enter aufgerufen, z.B. um Tabellenzeilen zu committen */
  onCommit?: () => void;
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Zahleneingabe mit Entwurfszustand: Waehrend des Tippens haelt das Feld den
 * rohen Text (leeren/Teileingaben moeglich, kein Springen auf 0). Gueltige
 * Werte werden sofort geklemmt uebernommen; beim Verlassen wird der Text auf
 * den uebernommenen Wert normalisiert.
 */
export function NumberField({
  value,
  onValueChange,
  min,
  max,
  step,
  unit,
  disabled,
  className,
  inputClassName,
  'aria-label': ariaLabel,
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleChange(raw: string) {
    setDraft(raw);
    const parsed = parseNumber(raw);
    if (parsed !== null) {
      onValueChange(clamp(parsed, min, max));
    }
  }

  function handleBlur() {
    if (draft !== null) {
      const parsed = parseNumber(draft);
      if (parsed !== null) {
        onValueChange(clamp(parsed, min, max));
      }
    }
    setDraft(null);
    onCommit?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        value={draft ?? String(value)}
        className={inputClassName}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {unit ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
