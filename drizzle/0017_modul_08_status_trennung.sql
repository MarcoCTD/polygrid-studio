-- Modul 08 – Trennung von Auftragsstatus und Zahlungsstatus.
--
-- Der Auftragsstatus 'paid' wird abgeschafft (Ablauf-Status beschreibt nur noch
-- den Fortschritt). Bestehende Aufträge mit status='paid' werden auf 'confirmed'
-- (Label "Angenommen") umgesetzt. Vorher wird ihr Geldeingang abgesichert:
-- status='paid' bedeutete faktisch, dass Geld da war, also payment_status='paid'
-- setzen und ein Zahlungsdatum sicherstellen (vorhandenes Datum, sonst
-- order_date). So fällt keine Einnahme aus der EÜR.
--
-- Reihenfolge ist wichtig: erst Geldeingang absichern (Filter status='paid'),
-- danach den Status umsetzen. Idempotent – nach dem Umsetzen existiert kein
-- status='paid' mehr, ein zweiter Lauf verändert nichts. Append-only; das
-- Pre-Migration-Backup greift automatisch über den bestehenden Mechanismus.

UPDATE orders
SET payment_status = 'paid',
    payment_received_date = COALESCE(NULLIF(payment_received_date, ''), order_date)
WHERE status = 'paid';
--> statement-breakpoint
UPDATE orders
SET status = 'confirmed'
WHERE status = 'paid';
--> statement-breakpoint
-- Playbook-Trigger folgen dem Auftrags-status-Enum (Feld trigger_status, "Enum
-- aus Modul 08"). Auf 'paid' triggernde Playbooks (inkl. Beispiel-Seed aus
-- Migration 0013) auf 'confirmed' umziehen, damit sie weiter feuern. Das
-- Ausführungs-Log playbook_runs bleibt als Historie unangetastet.
UPDATE playbooks
SET trigger_status = 'confirmed'
WHERE trigger_status = 'paid';
