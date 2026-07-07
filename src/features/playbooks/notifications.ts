/**
 * Nutzer-Feedback nach Playbook-Ausführungen (Spec 4.3).
 * Wird direkt nach der Engine im zentralen Statusänderungs-Pfad aufgerufen
 * und darf – wie die Engine – niemals werfen.
 */
import { toast } from 'sonner';
import type { PlaybookRunSummary } from './services/playbookEngine';

function openAutomationLog(): void {
  // Lazy-Import bricht den Import-Zyklus ordersService → notifications → router → Routen.
  void import('@/router')
    .then(({ router }) =>
      router.navigate({ to: '/settings/$tab', params: { tab: 'automation' } }),
    )
    .catch((error: unknown) => console.error('[Playbooks] Navigation zum Log fehlgeschlagen', error));
}

export function notifyPlaybookRunSummaries(summaries: PlaybookRunSummary[]): void {
  try {
    for (const summary of summaries) {
      const actionCount = summary.results.length;
      const executed = summary.results.filter((result) => result.status === 'success').length;
      const label = `Playbook „${summary.playbook_name}“: ${executed} von ${actionCount} Aktion${
        actionCount === 1 ? '' : 'en'
      } ausgeführt`;
      const options = {
        action: { label: 'Log öffnen', onClick: openAutomationLog },
      };

      if (summary.status === 'success') {
        toast.success(label, options);
      } else if (summary.status === 'partial') {
        toast.warning(`${label} – Details im Log`, options);
      } else {
        toast.error(`Playbook „${summary.playbook_name}“ fehlgeschlagen – Details im Log`, options);
      }
    }
  } catch (error) {
    console.error('[Playbooks] Toast-Benachrichtigung fehlgeschlagen', error);
  }
}
