# Modul 08 Überarbeitung: Trennung von Auftragsstatus und Zahlungsstatus

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026 | Überarbeitet Teile von MODUL_08_AUFTRAGSVERWALTUNG.md

## 1. Problem und Ziel

status und payment_status sind zwei getrennte Dimensionen (Auftragsfortschritt vs. Geldeingang), tragen aber beide einen Wert "paid" mit Label "Bezahlt" und identischer grüner Badge-Farbe. Das erzeugt Verwirrung und drei Folgefehler: Inline-/Kanban-Wechsel auf status=paid lässt payment_status auf pending stehen; Create koppelt beide, Update nicht; nach "Rechnung als bezahlt markieren" ist payment_status frei rückstellbar, wodurch ein stiller Widerspruch (Rechnung bezahlt, Auftrag pending, Einnahme fällt aus EÜR) entsteht.

Ziel: "Bezahlt" existiert nur noch beim payment_status. Der Auftragsstatus beschreibt ausschließlich den Ablauf. payment_status ist überall sichtbar und schnell änderbar. Rechnung und Auftrag können nicht mehr still auseinanderlaufen.

Der Nutzer hat keine produktiven Daten, dennoch wird eine saubere Migration mit Pre-Migration-Backup gebaut (Standard des Projekts).

## 2. Änderung 1: status-Enum bereinigen

- Der Wert "paid" wird aus dem Auftrags-status-Enum entfernt.
- Ersetzung: neuer Wert "confirmed" mit Label "Angenommen" (Bedeutung: Auftrag bestätigt, Produktion kann starten). Die bisherige Kanban-Spalte "Bestellt/Bezahlt" (ordered, paid) wird zu "Bestellt/Angenommen" (ordered, confirmed).
- Neue status-Reihenfolge: inquiry, quoted, ordered, confirmed, in_production, ready, shipped, completed, issue, cancelled.
- Alle Stellen anpassen: Zod-Enum, Labels, Kanban-Spaltenzuordnung, Badge-Mapping, EÜR-Einnahmenlogik (isIncomeStatus), Filter, Smart-Action-Regeln, Playbook-Trigger-Optionen.
- WICHTIG EÜR: Die Einnahmenerkennung darf sich fachlich nicht verschlechtern. Bisher zählt EÜR completed sowie shipped mit payment_status=paid. Diese Logik bleibt, nur der entfernte status-Wert paid darf dort nicht mehr referenziert werden. Einnahme hängt weiter an payment_status=paid, nicht am Auftragsstatus.

## 3. Änderung 2: Migration

- Neue append-only Migration (nächste freie Nummer gegen migrations.ts und Verzeichnis verifizieren).
- Alle orders mit status='paid' auf status='confirmed' umsetzen.
- Für jeden dieser umgesetzten Aufträge: wenn payment_status noch nicht 'paid', auf 'paid' setzen und payment_received_date auf das vorhandene Datum bzw. order_date setzen. So geht keine Einnahme verloren (bisher bedeutete status=paid faktisch, dass Geld da war).
- Idempotent formulieren (mehrfaches Ausführen schadet nicht).
- Pre-Migration-Backup-Mechanismus greift automatisch (bestehend), nicht umgehen.

## 4. Änderung 3: payment_status überall sichtbar und editierbar

- Kanban-Karte (KanbanCard): kleines Zahlungs-Badge ergänzen (Offen amber, Bezahlt emerald, Erstattet blau, Klärung rot), damit der Geldstatus im Kanban sichtbar ist. Optisch klar vom Ablauf-Status abgesetzt (z.B. kleineres Badge mit Münz-/Euro-Icon, Label "Zahlung: ...").
- Auftragstabelle: die bestehende read-only Spalte "Zahlung" wird zu einem Inline-Dropdown (InlineStatusBadge-Muster wiederverwenden), das payment_status ändert. Damit hat die Tabelle zwei Inline-Dropdowns: Ablauf-Status und Zahlung, visuell unterscheidbar beschriftet.
- Detail-Panel: bleibt, beide Dropdowns wie gehabt.
- Farb-/Label-Disambiguierung: Ablauf-Status und Zahlung dürfen nicht mehr identisch aussehen. payment_status-Badges bekommen ein Zahlungs-Icon und das Präfix "Zahlung:" im Tabellen-/Kanban-Kontext, damit "Bezahlt" (Zahlung) nie mit einem Ablauf-Status verwechselt wird.

## 5. Änderung 4: Kopplung vereinheitlichen und absichern

- createOrder und updateOrder verhalten sich konsistent: das automatische Koppeln (status setzt payment_status) wird ENTFERNT. status und payment_status sind unabhängige Felder, die der Nutzer bzw. definierte Aktionen (Rechnung, Recurring) explizit setzen. Einzige Ausnahme bleibt der bewusste Fluss "Rechnung als bezahlt markieren".
- payment_received_date wird nur noch gesetzt/geleert, wenn sich payment_status auf/von paid ändert, nicht mehr an Ablauf-Status-Änderungen gekoppelt.
- Rechnungs-Kopplung absichern: Hat ein Auftrag eine verknüpfte Rechnung mit status=issued und paid (also über das Dokumentmodul als bezahlt markiert), ist payment_status des Auftrags gesperrt (Inline-Dropdown und Detail-Panel-Dropdown disabled, Tooltip "Über die verknüpfte Rechnung gesteuert, dort stornieren um zu ändern"). Entsperrung nur durch Storno der Rechnung.
- Konsistenz-Sichtbarkeit: Gibt es trotzdem einen Widerspruch (verknüpfte bezahlte Rechnung, aber Auftrag payment_status != paid, z.B. durch Altdaten), zeigt das Auftrags-Detail-Panel eine sichtbare Warnung mit Korrektur-Button "Auf bezahlt setzen". Zusätzlich neue Smart-Action-Regel order_invoice_mismatch (severity danger), die solche Fälle auflistet.

## 6. Akzeptanzkriterien

- status-Enum enthält kein paid mehr, sondern confirmed (Label "Angenommen")
- Migration setzt bestehende paid-Aufträge auf confirmed und sichert deren payment_status=paid + Datum, idempotent, mit Pre-Migration-Backup
- EÜR-Einnahmen bleiben fachlich unverändert (Test: Auftrag der vorher als Einnahme zählte, zählt nach Migration weiterhin; Summe identisch)
- payment_status ist im Kanban (Badge), in der Tabelle (Inline-Dropdown) und im Detail-Panel sichtbar/änderbar
- Ablauf-Status und Zahlung sind visuell klar unterscheidbar (Icon + Präfix), kein doppeltes identisches "Bezahlt"
- createOrder und updateOrder koppeln status und payment_status nicht mehr automatisch; beide unabhängig
- Bei verknüpfter bezahlter Rechnung ist payment_status des Auftrags gesperrt; Änderung nur über Rechnungs-Storno
- Widersprüche werden im Detail-Panel und per Smart-Action sichtbar, nie still
- Inline-payment_status-Wechsel läuft über den zentralen updateOrder-Pfad (kein Direktschreiben)
- Bestehende Seiteneffekte (Playbook-Engine bei Ablauf-Status) unverändert
- Regressionslauf aller Tests zweimal grün, TypeScript strict, ESLint, Prettier, cargo check grün
