import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Playbook } from '../schemas';
import {
  getLastRunPerPlaybook,
  getRecentRuns,
  listPlaybooks,
  softDeletePlaybook,
  updatePlaybook,
  type PlaybookRunListItem,
} from '../services/playbookService';
import { DryRunDialog } from './DryRunDialog';
import { PlaybookFormDialog } from './PlaybookFormDialog';
import { RunLogTable } from './RunLogTable';
import { PLATFORM_LABELS, Section, TriggerStatusBadge, formatDateTime } from './shared';

function EnabledToggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className="flex items-center"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-pg-accent' : 'bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function AutomationSettingsTab() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<PlaybookRunListItem[]>([]);
  const [lastRuns, setLastRuns] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<{ open: boolean; playbook: Playbook | null }>({
    open: false,
    playbook: null,
  });
  const [dryRunPlaybook, setDryRunPlaybook] = useState<Playbook | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Playbook | null>(null);

  const load = useCallback(async () => {
    try {
      const [playbookRows, runRows, lastRunMap] = await Promise.all([
        listPlaybooks(),
        getRecentRuns(50),
        getLastRunPerPlaybook(),
      ]);
      setPlaybooks(playbookRows);
      setRuns(runRows);
      setLastRuns(lastRunMap);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Automatisierung konnte nicht geladen werden',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Laden aus der lokalen SQLite ist der externe Sync-Punkt dieses Tabs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleToggleEnabled(playbook: Playbook, enabled: boolean) {
    try {
      await updatePlaybook(playbook.id, { enabled });
      toast.success(enabled ? `„${playbook.name}“ aktiviert` : `„${playbook.name}“ deaktiviert`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Änderung fehlgeschlagen');
    }
  }

  async function handleDelete() {
    if (!deleteCandidate) return;
    try {
      await softDeletePlaybook(deleteCandidate.id);
      toast.success(`Playbook „${deleteCandidate.name}“ gelöscht`);
      setDeleteCandidate(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Löschen fehlgeschlagen');
    }
  }

  return (
    <div className="space-y-6">
      <Section
        title="Playbooks"
        description="Regelbasierte Automatisierung: Erreicht ein Auftrag den Trigger-Status, laufen die Aktionen automatisch."
        actions={
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => setFormState({ open: true, playbook: null })}
          >
            <Plus className="size-4" />
            Neues Playbook
          </Button>
        }
      >
        {isLoading ? (
          <p className="text-sm text-text-secondary">Wird geladen…</p>
        ) : playbooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">
            <Zap className="mx-auto mb-2 size-6" />
            Keine Playbooks vorhanden. Lege das erste an, um Aufgaben, Ausgaben oder
            Vorlagen-Vorschläge zu automatisieren.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-lg border border-border" data-testid="playbook-list">
            {playbooks.map((playbook) => {
              const lastRun = lastRuns.get(playbook.id);
              return (
                <li
                  key={playbook.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                  data-testid="playbook-list-item"
                >
                  <EnabledToggle
                    checked={playbook.enabled}
                    label={`Playbook ${playbook.name} aktivieren`}
                    onCheckedChange={(checked) => void handleToggleEnabled(playbook, checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{playbook.name}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {playbook.actions.length}{' '}
                      {playbook.actions.length === 1 ? 'Aktion' : 'Aktionen'}
                      {lastRun
                        ? ` · Zuletzt ausgeführt ${formatDateTime(lastRun)}`
                        : ' · Noch nie ausgeführt'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TriggerStatusBadge status={playbook.trigger_status} />
                    {(playbook.platform_filter ?? []).map((platform) => (
                      <Badge
                        key={platform}
                        variant="outline"
                        className="whitespace-nowrap border-slate-300 bg-slate-100 text-slate-600"
                      >
                        {PLATFORM_LABELS[platform]}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setDryRunPlaybook(playbook)}
                    >
                      <FlaskConical className="size-4" />
                      Testen
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setFormState({ open: true, playbook })}
                    >
                      <Pencil className="size-4" />
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Playbook ${playbook.name} löschen`}
                      className="text-text-muted hover:text-red-600"
                      onClick={() => setDeleteCandidate(playbook)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        title="Ausführungs-Log"
        description="Die letzten 50 Läufe – mit aufklappbaren Details pro Aktion."
      >
        <RunLogTable runs={runs} />
      </Section>

      <PlaybookFormDialog
        open={formState.open}
        onOpenChange={(open) => setFormState((current) => ({ ...current, open }))}
        playbook={formState.playbook}
        onSaved={() => void load()}
      />

      <DryRunDialog
        open={dryRunPlaybook !== null}
        onOpenChange={(open) => {
          if (!open) setDryRunPlaybook(null);
        }}
        playbook={dryRunPlaybook}
        onFinished={() => void load()}
      />

      <AlertDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Playbook löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteCandidate?.name}“ wird gelöscht und feuert nicht mehr. Bereits erstellte
              Aufgaben und Ausgaben bleiben erhalten, ebenso das Ausführungs-Log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void handleDelete()}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
