-- Bug-Fix nach der Status/Zahlungs-Trennung (Migration 0017).
--
-- 0017 hat playbooks.trigger_status 'paid' -> 'confirmed' umgezogen, das
-- Ausführungs-Log playbook_runs aber bewusst als Historie ausgelassen
-- (ENTSCHEIDUNGEN_STATUS_TRENNUNG E-03). Das hatte zwei übersehene Folgen:
--
-- 1. playbookRunSchema validiert trigger_status streng gegen das neue Enum.
--    Ein einziger Alt-Run mit 'paid' ließ das komplette Playbook-Log (und
--    damit den ganzen Automatisierungs-Tab) mit einem Zod-Fehler scheitern.
-- 2. Die Idempotenz-Prüfung (hasExistingRun) sucht nach dem NEUEN Status.
--    Ein Alt-Run mit trigger_status='paid' zählt für 'confirmed' nicht mehr;
--    erreicht der Auftrag erneut 'confirmed', feuert das Playbook doppelt.
--
-- Deshalb werden jetzt auch die Runs umgezogen ('paid' war fachlich der
-- heutige Status 'confirmed'). playbooks wird als Sicherheitsnetz erneut
-- mitgenommen (idempotent, trifft nur Reste, die 0017 nicht gesehen hat).
--
-- Kollisionsschutz: Der partielle Unique-Index idx_playbook_runs_idempotency
-- (playbook_id, order_id, trigger_status) WHERE status != 'dry_run' verbietet
-- das Umziehen, wenn für dasselbe Paar bereits ein echter 'confirmed'-Run
-- existiert. Solche Rest-Zeilen behalten 'paid' und werden vom toleranten
-- Log-Parser (playbookRunSchema, trigger_status als Text) weiter angezeigt.
-- Idempotent: Ein zweiter Lauf findet keine umziehbaren Zeilen mehr und
-- verändert nichts. Append-only; das Pre-Migration-Backup greift automatisch.

UPDATE playbooks
SET trigger_status = 'confirmed'
WHERE trigger_status = 'paid';
--> statement-breakpoint
UPDATE playbook_runs
SET trigger_status = 'confirmed'
WHERE trigger_status = 'paid'
  AND (
    status = 'dry_run'
    OR NOT EXISTS (
      SELECT 1
      FROM playbook_runs existing
      WHERE existing.playbook_id = playbook_runs.playbook_id
        AND existing.order_id = playbook_runs.order_id
        AND existing.trigger_status = 'confirmed'
        AND existing.status != 'dry_run'
    )
  );
