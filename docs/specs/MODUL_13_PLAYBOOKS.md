# Modul 13: Playbooks (Automatisierung)

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026

## 1. Scope und Ziel

Dieses Modul implementiert regelbasierte Automatisierung: Wenn ein Auftrag einen bestimmten Status erreicht, führt die App automatisch definierte Aktionen aus (Aufgabe erstellen, Ausgabe anlegen, Vorlage vorschlagen). Keine KI, keine externen Trigger, keine Zeitsteuerung im MVP. Der einzige Trigger in v1 ist die Statusänderung eines Auftrags.

### 1.1 Lieferergebnisse

- playbooks und playbook_runs Tabellen (neue Migration)
- Playbook-Engine: wird bei jeder Auftrags-Statusänderung aufgerufen
- Drei Aktionstypen: Aufgabe erstellen, Ausgabe anlegen, Vorlage vorschlagen
- Verwaltungs-UI als neuer Settings-Tab "Automatisierung"
- Ausführungs-Log mit Viewer (analog KI-Log)
- Idempotenz: kein Playbook feuert doppelt für denselben Auftrag und Status
- Test-Ausführung pro Playbook (Dry-Run gegen einen wählbaren Auftrag)

### 1.2 Abhängigkeiten

- Foundation, Auftragsverwaltung (Modul 08), Aufgaben (Modul 09), Ausgaben (Modul 04), Vorlagen (Modul 07) inkl. Variablen-Registry aus der Fix-Session Juli 2026

### 1.3 Explizit NICHT im Scope

- Keine zeitgesteuerten Trigger (z.B. "3 Tage nach Versand")
- Keine Trigger auf Produkt-, Listing- oder Aufgaben-Änderungen
- Keine KI-Aktionen
- Keine Verkettung von Playbooks (ein Playbook kann kein anderes auslösen)
- Kein Bearbeiten der Aktion nach Ausführung (erstellte Aufgaben/Ausgaben sind normale Entitäten)

## 2. Datenmodell

### 2.1 playbooks

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| name | TEXT | Ja | Anzeigename |
| enabled | BOOLEAN | Ja | Default: true |
| trigger_status | TEXT | Ja | Auftragsstatus, der auslöst (Enum aus Modul 08) |
| platform_filter | TEXT (JSON) | Nein | Array von Plattformen; null = alle |
| actions | TEXT (JSON) | Ja | Array von Aktionen (siehe 2.3), Reihenfolge = Ausführungsreihenfolge |
| created_at / updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

### 2.2 playbook_runs

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| playbook_id | TEXT (FK) | Ja | |
| order_id | TEXT (FK) | Ja | Auslösender Auftrag |
| trigger_status | TEXT | Ja | Status zum Zeitpunkt der Ausführung |
| status | TEXT | Ja | success, partial, error, dry_run |
| results | TEXT (JSON) | Ja | Pro Aktion: Typ, erstellte Entity-ID oder Fehlermeldung |
| executed_at | TEXT (ISO) | Ja | |

Unique-Index auf (playbook_id, order_id, trigger_status) WHERE status != 'dry_run'. Das erzwingt die Idempotenz auf DB-Ebene: schiebt der Nutzer einen Auftrag zurück und wieder vor, feuert das Playbook nicht erneut.

### 2.3 Aktions-Schema (Zod, discriminated union auf "type")

**create_task:**
- title_template: TEXT mit Variablen aus der Vorlagen-Registry ({{produktname}}, {{bestellnummer}}, {{kundenname}}, {{plattform}})
- priority: low/medium/high/urgent (Default: medium)
- due_offset_days: INTEGER, Fälligkeit = heute + Offset (0 = heute, null = kein Datum)
- link_order: BOOLEAN, Default true (setzt order_id an der Aufgabe)

**create_expense:**
- amount_gross: REAL (fest) ODER amount_source: 'shipping_cost' | 'platform_fee' (liest den Wert aus dem auslösenden Auftrag; ist der Wert dort leer, wird die Aktion mit Hinweis übersprungen, kein Fehler)
- category / subcategory: aus bestehendem Kategorien-Enum (Modul 04)
- vendor: TEXT
- purpose_template: TEXT mit Variablen
- Datum = Ausführungstag, product_id wird vom Auftrag übernommen falls vorhanden

**suggest_template:**
- template_id: FK auf Vorlage
- Verhalten: erstellt KEINE Entität, sondern einen Eintrag in einer Vorschlagsliste. Beim nächsten Öffnen des betroffenen Auftrags-Detail-Panels erscheint ein Banner "Vorlage {name} bereit" mit Button, der den Kopieren-Dialog öffnet, vorbefüllt mit den Auftragsvariablen über die bestehende Registry. Banner ist verwerfbar. Speicherung der offenen Vorschläge in results des runs (kein eigenes Schema).

## 3. Engine

- Einziger Einstiegspunkt: eine Funktion runPlaybooksForStatusChange(orderId, newStatus), aufgerufen an ZENTRALER Stelle im Order-Service, wo der Status persistiert wird (nicht in den UI-Komponenten, damit Kanban-Drag, Detail-Panel und jede künftige Quelle denselben Pfad nutzen).
- Ablauf: aktive Playbooks laden (enabled, nicht gelöscht, trigger_status passt, platform_filter passt) → Idempotenz-Check gegen playbook_runs → Aktionen sequenziell ausführen → Run protokollieren.
- Fehlerverhalten: Eine fehlgeschlagene Aktion bricht die restlichen Aktionen des Playbooks NICHT ab. Run-Status: success (alle ok), partial (mind. eine übersprungen/fehlgeschlagen), error (alle fehlgeschlagen). Die Statusänderung des Auftrags selbst darf durch Playbook-Fehler NIE blockiert oder zurückgerollt werden.
- Variablenersetzung nutzt die bestehende zentrale Registry aus Modul 07 (Fix-Session Juli 2026). Nicht auflösbare Variablen bleiben als Rohtext stehen und erzeugen einen Hinweis im Run-Result.
- Ausführung synchron im Frontend-Prozess (kein Rust-Anteil nötig, alles läuft über bestehende Services).

## 4. UI

### 4.1 Settings-Tab "Automatisierung"

- Liste aller Playbooks: Name, Trigger-Status-Badge, Plattform-Badges, Aktionen-Anzahl, Enabled-Toggle, letzte Ausführung
- Neues Playbook / Bearbeiten als Formular (Sheet oder Modal): Name, Trigger-Status (Dropdown), Plattform-Filter (Checkboxen, leer = alle), Aktionsliste (hinzufügen, entfernen, umsortieren per dnd-kit)
- Pro Aktionstyp ein eigenes Unterformular gemäß 2.3, mit Variablen-Einfügen-Buttons wie im Vorlagen-Editor
- Test-Button pro Playbook: Auftrag per Suchauswahl wählen, Dry-Run ausführen, Ergebnis-Vorschau anzeigen (was WÜRDE erstellt), nichts wird geschrieben, Run wird mit status=dry_run geloggt
- Löschen: Soft-Delete mit Bestätigung

### 4.2 Ausführungs-Log

- Im selben Tab unterhalb der Liste: Tabelle der letzten 50 Runs (Zeit, Playbook, Auftrag, Status-Badge, aufklappbare Details aus results)

### 4.3 Feedback bei Ausführung

- Nach einer Statusänderung, die Playbooks ausgelöst hat: Toast "Playbook {name}: 2 Aktionen ausgeführt" mit Klick zum Log. Bei partial/error: Warn-Toast.

## 5. Vordefinierte Beispiel-Playbooks (Seed, deaktiviert angelegt)

Beim ersten Start nach der Migration werden zwei deaktivierte Beispiele angelegt, damit die Konfiguration selbsterklärend ist:

1. "Versandaufgabe bei Zahlungseingang": Trigger paid → Aufgabe "{{produktname}} für {{kundenname}} drucken und verpacken", Priorität high, fällig +1 Tag, verknüpft
2. "Versandkosten buchen bei Versand": Trigger shipped → Ausgabe amount_source shipping_cost, Kategorie Versand, Vendor "Versanddienstleister", Zweck "Versand Bestellung {{bestellnummer}}"

## 6. Akzeptanzkriterien

- Playbook mit allen drei Aktionstypen kann angelegt, bearbeitet, deaktiviert und gelöscht werden
- Statusänderung im Kanban UND im Detail-Panel löst Playbooks aus (ein gemeinsamer Codepfad)
- Idempotenz: gleicher Auftrag, gleicher Status, kein zweiter Run (auch nach Zurück- und Wiedervorschieben)
- create_task erzeugt verknüpfte Aufgabe mit ersetzten Variablen und korrektem Fälligkeitsdatum
- create_expense mit amount_source liest den Wert aus dem Auftrag; leerer Wert überspringt mit Hinweis
- suggest_template zeigt Banner im Auftrags-Detail-Panel, Kopieren-Dialog ist vorbefüllt
- Playbook-Fehler blockiert die Statusänderung nicht
- Dry-Run schreibt keine Entitäten, loggt aber
- Log-Viewer zeigt Runs mit Details
- E2E-Tests decken die Akzeptanzkriterien ab (bestehende Playwright-Infrastruktur)
- TypeScript strict, ESLint, Prettier grün
