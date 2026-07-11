/**
 * Klickbarer Status-Badge mit Dropdown für den Inline-Statuswechsel in
 * Tabellen-/Listenansichten (Produkte, Aufträge, Website-Projekte, Aufgaben,
 * Listings). Bewusst NICHT für Dokumente (Angebote/Rechnungen): deren
 * Statusübergänge sind kontrollierte Aktionen mit Nebenwirkungen
 * (Ausstellen, Nummernvergabe, Snapshot) und bleiben in den Detail-Aktionen.
 *
 * Die Komponente rendert nur; der eigentliche Wechsel läuft beim Aufrufer
 * über denselben zentralen Service-Pfad wie bisher (updateOrder → Playbooks,
 * updateTask → Wiederkehr, updateProduct nach Lizenz-Gate, …).
 */
import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface InlineStatusOption<T extends string> {
  value: T;
  label: string;
}

export interface InlineStatusBadgeProps<T extends string> {
  value: T;
  /** Status-Optionen in der üblichen Reihenfolge des jeweiligen Moduls. */
  options: ReadonlyArray<InlineStatusOption<T>>;
  /** Rendert den bestehenden Badge des Moduls für einen Statuswert. */
  renderBadge: (value: T) => ReactNode;
  /** Persistiert den Wechsel (zentraler Service-Pfad) – Fehler dort toasten. */
  onSelect: (value: T) => Promise<void> | void;
  disabled?: boolean;
  /** Tooltip, wenn disabled (z.B. Tax-Lock-Hinweis). */
  disabledTitle?: string;
  /** Zugänglicher Name des Triggers, z.B. "Status von 2026-9001 ändern". */
  ariaLabel: string;
}

export function InlineStatusBadge<T extends string>({
  value,
  options,
  renderBadge,
  onSelect,
  disabled,
  disabledTitle,
  ariaLabel,
}: InlineStatusBadgeProps<T>) {
  const [isBusy, setIsBusy] = useState(false);
  const isDisabled = disabled || isBusy;

  async function handleSelect(next: T) {
    if (next === value) return;
    setIsBusy(true);
    try {
      await onSelect(next);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isDisabled}
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            title={disabled ? disabledTitle : undefined}
            data-testid="inline-status-trigger"
            className={cn(
              'inline-flex max-w-full cursor-pointer items-center gap-0.5 rounded-full outline-none',
              'focus-visible:ring-2 focus-visible:ring-pg-accent',
              isDisabled && 'cursor-default',
            )}
            // Zeilenklick (Detail-Panel öffnen) darf nicht mitfeuern.
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        {renderBadge(value)}
        {!disabled ? <ChevronDown className="size-3 shrink-0 text-text-muted" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            data-testid={`inline-status-option-${option.value}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleSelect(option.value);
            }}
          >
            <span className="flex-1">{option.label}</span>
            {option.value === value ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
