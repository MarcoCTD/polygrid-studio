# Entscheidungen: Trennung von Auftragsstatus und Zahlungsstatus (Modul 08)

Spec: `docs/specs/MODUL_08_STATUS_TRENNUNG.md`. Dieses Dokument hält die
Umsetzungsentscheidungen fest, die nicht 1:1 in der Spec stehen.

## E-01: Nur `paid → confirmed`, kein `quoted`/`ready`

Die Spec nennt in Abschnitt 2 eine "neue status-Reihenfolge: inquiry, quoted,
ordered, confirmed, in_production, ready, shipped, completed, issue, cancelled".
Der reale Enum kennt weder `quoted` noch `ready` (historische Migration 0008 hat
`quoted → inquiry` und `ready → shipped` bereits kollabiert). Die konkrete,
unstrittige Anforderung der Spec ist ausschließlich: `paid` entfernen,
`confirmed` (Label "Angenommen") einführen.

**Entscheidung:** Nur `paid → confirmed`. `quoted`/`ready` werden NICHT
eingeführt (Vorgriff auf nicht spezifizierte Features, würde Kanban/Filter/
Analytics aufblähen). Neue Reihenfolge: `inquiry, ordered, confirmed,
in_production, shipped, completed, issue, cancelled`. Deckt sich mit der Memory
"Repo-Docs veraltet, Code als Wahrheit".

## E-02: EÜR-Einnahmen – zwei Implementierungen, beide abgesichert

Es gibt zwei EÜR-Pfade mit unterschiedlicher Einnahmen-Logik:

- `euerYear.ts` (`buildEuerYearReport`, Jahresreport): Einnahme = status ∈
  {completed, shipped} UND `payment_status='paid'`. `paid` war hier NIE ein
  income-Status → das Entfernen des Enum-Werts ändert diese Logik nicht.
- `euerExportService.ts` (CSV/XLSX-Export + Vorschau): Einnahme = status ∈
  {paid, shipped, completed}, OHNE payment_status-Prüfung.

Der Export-Pfad referenzierte `status='paid'` direkt und ist damit der kritische
Punkt für die harte Regel "EÜR darf sich fachlich nicht verschlechtern".

**Entscheidung:** Der Export-Filter wird faithful übersetzt zu
`status IN ('shipped','completed') OR (status='confirmed' AND payment_status='paid')`
(zentral in `euerIncome.ts`: SQL-Fragment + TS-Spiegel). Begründung:

- Migration 0017 macht aus jedem früheren `status='paid'` einen
  `confirmed`-Auftrag mit `payment_status='paid'` → er zählt weiter.
- `shipped`/`completed` bleiben unverändert (auch ohne Zahlung, wie bisher).
- Ein `ordered`-Auftrag mit `payment_status='paid'` zählt WEDER vorher NOCH
  nachher → keine versehentliche Verbreiterung.

Damit ist die gezählte Auftragsmenge vor/nach der Umstellung identisch (Unit-Test
`euerStatusTrennung.test.ts`: Summe 227 identisch, kein Auftrag fällt heraus).

## E-03: `order_events`/`playbook_runs`-Historie bleibt unangetastet

`euerYearService.ts` nutzt ein `order_events`-Subquery mit `to_value IN ('paid',
'completed')` als Fallback-Zuflussdatum. `order_events` ist ein Audit-Log;
historische `paid`-Einträge bleiben gültige Zahlungs-Signale. Neue Aufträge
erreichen stattdessen `completed`, das die Subquery ebenfalls erfasst → kein
Datenverlust. Analog bleibt `playbook_runs.trigger_status` (Ausführungs-Log)
unverändert; nur `playbooks.trigger_status` (aktive Konfiguration) wird migriert.

## E-04: Migration 0017 auch für `playbooks.trigger_status`

`playbooks.trigger_status` referenziert laut Schema "Enum aus Modul 08". Der
Beispiel-Seed (Migration 0013) triggert auf `paid`. Migration 0017 zieht alle
`playbooks` mit `trigger_status='paid'` auf `confirmed` um, damit sie weiter
feuern. Bestehende Migrationen bleiben unangetastet (append-only).

## E-05: Bank-Match-Fluss – "auf bezahlt" ist ein Zahlungssignal

`confirmMatch` (Bankabgleich) schreibt bereits direkt `payment_status='paid'` +
`payment_received_date`. Das ist ein bewusster Zahlungs-Fluss (kein Inline-
Dropdown), bleibt als Direktschreiben bestehen. Die frühere Zusatz-Empfehlung
"Auftrag auf Status paid setzen" (StatusUpdateSuggestionDialog) ist damit
obsolet und wird in Etappe C entfernt; für Etappe A zeigen die Dialoge auf
`payment_status='paid'` statt auf den entfernten Status.

## E-06: Analytics-Open-Order-Zähler folgen dem Rename

`kpiService.ts`/`snapshotService.ts` zählen offene Aufträge über
`status IN ('ordered','paid','in_production','ready')`. `paid → confirmed`, damit
angenommene Aufträge weiter als "offen" gezählt werden (sonst Unterzählung).
`ready` bleibt unangetastet (vorbestehender toter Wert, außerhalb des Scopes).
