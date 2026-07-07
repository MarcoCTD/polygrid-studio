import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { dismissSmartAction, getSmartActions } from '../smartActionsService';
import type { SmartAction } from '../types';
import { SmartActionCard } from './SmartActionCard';

/**
 * Dashboard-Bereich "Empfohlene Aktionen" (Modul 15).
 * Wird komplett ausgeblendet, wenn keine Aktionen anstehen.
 */
export function SmartActionsSection() {
  const navigate = useNavigate();
  const [actions, setActions] = useState<SmartAction[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      getSmartActions()
        .then((result) => {
          if (!cancelled) setActions(result);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Empfohlene Aktionen konnten nicht geladen werden',
            );
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const handleOpen = useCallback(
    (action: SmartAction) => {
      void navigate({
        to: action.targetRoute,
        params: action.targetParams,
        search: action.targetSearchParams,
        // Zielrouten und Params kommen aus der Regel-Registry und sind dort
        // als gültige Routen gepflegt – der Router kann das statisch nicht wissen.
      } as Parameters<typeof navigate>[0]);
    },
    [navigate],
  );

  const handleDismiss = useCallback(async (action: SmartAction) => {
    try {
      await dismissSmartAction(action);
      setActions((current) => current.filter((item) => item.ruleId !== action.ruleId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hinweis konnte nicht verworfen werden');
    }
  }, []);

  // Kein leerer Platzhalter: Bereich verschwindet komplett, wenn nichts ansteht
  if (actions.length === 0) return null;

  return (
    <section data-testid="smart-actions-section" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-text-primary">Empfohlene Aktionen</h2>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {actions.map((action) => (
          <SmartActionCard
            key={action.ruleId}
            action={action}
            onOpen={handleOpen}
            onDismiss={(item) => void handleDismiss(item)}
          />
        ))}
      </div>
    </section>
  );
}
