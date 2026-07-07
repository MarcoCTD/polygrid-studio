import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PlaybookRunListItem } from '../services/playbookService';
import { ACTION_TYPE_LABELS, RunStatusBadge, formatDateTime } from './shared';

export function RunLogTable({ runs }: { runs: PlaybookRunListItem[] }) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-subtle p-4 text-sm text-text-muted">
        Noch keine Ausführungen. Sobald ein Auftrag einen Trigger-Status erreicht oder ein
        Dry-Run läuft, erscheint hier der Eintrag.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" data-testid="playbook-run-log">
        <thead>
          <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="w-8 px-2 py-2" aria-label="Details" />
            <th className="px-3 py-2 font-medium">Zeit</th>
            <th className="px-3 py-2 font-medium">Playbook</th>
            <th className="px-3 py-2 font-medium">Auftrag</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id;
            return (
              <Fragment key={run.id}>
                <tr
                  className="cursor-pointer border-b border-border-subtle transition-colors hover:bg-bg-hover"
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                >
                  <td className="px-2 py-2 text-text-muted">
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {formatDateTime(run.executed_at)}
                  </td>
                  <td className="px-3 py-2 text-text-primary">
                    {run.playbook_name ?? 'Gelöschtes Playbook'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {run.order_receipt_number ?? run.order_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <RunStatusBadge status={run.status} />
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-border-subtle bg-bg-secondary">
                    <td />
                    <td colSpan={4} className="px-3 py-3">
                      <ul className="space-y-1.5">
                        {run.results.length === 0 ? (
                          <li className="text-sm text-text-muted">Keine Aktions-Details.</li>
                        ) : (
                          run.results.map((result, index) => (
                            <li key={index} className="text-sm">
                              <span className="font-medium text-text-primary">
                                {ACTION_TYPE_LABELS[result.action_type]}
                              </span>
                              <span className="mx-1.5 text-text-muted">·</span>
                              <span
                                className={
                                  result.status === 'success'
                                    ? 'text-emerald-700'
                                    : result.status === 'skipped'
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                }
                              >
                                {result.status === 'success'
                                  ? 'erfolgreich'
                                  : result.status === 'skipped'
                                    ? 'übersprungen'
                                    : 'fehlgeschlagen'}
                              </span>
                              {result.preview ? (
                                <p className="mt-0.5 text-text-secondary">{result.preview}</p>
                              ) : null}
                              {result.message ? (
                                <p className="mt-0.5 text-xs text-text-muted">{result.message}</p>
                              ) : null}
                            </li>
                          ))
                        )}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
