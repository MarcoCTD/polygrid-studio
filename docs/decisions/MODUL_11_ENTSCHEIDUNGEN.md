# Modul 11: Settings — Entscheidungsdokument

PolyGrid Studio Business OS | Mai 2026

Dieses Dokument klärt alle offenen Architektur- und Design-Fragen vor der Implementierung von Modul 11.

---

## E01: Tab-Struktur und Navigation

**Frage:** Wie wird die Settings-Seite strukturiert?

**Entscheidung:** 5 Tabs als vertikale Sidebar-Navigation (links, 200px) mit Content-Bereich rechts. Tabs sind:

| Tab | Icon (Lucide) | Inhalt |
|-----|--------------|--------|
| Allgemein | Settings | Firmenname, Theme, Akzentfarbe, Sprache, Datumsformat, OneDrive-Pfad |
| Material & Plattformen | Package | Materialpreise, Plattformgebühren, Versandklassen, Farbvarianten-Bibliothek, Drucker-Setup, Strompreis |
| KI-Konfiguration | Sparkles | Provider-Auswahl, API-Keys, Modellwahl, Verbindungstest, Kostenlimit, Logging, KI-Log-Viewer |
| Markenstil | Palette | Schreibstil, Brand-Wörter, No-Go-Formulierungen, Beispieltext |
| Daten & Sicherheit | Shield | Backup, Export, Archiv-Aufbewahrung, Zurücksetzen |

**Begründung:** Vertikale Tabs statt horizontaler Tabs, weil die Settings-Seite viel Platz braucht und vertikale Navigation besser skaliert. Konsistent mit der App-Sidebar-Logik. Die Aufteilung nach Themenbereichen statt nach technischen Aspekten ist nutzerfreundlicher. "Plattformen" und "Material" zusammen, weil beides zur Kostenberechnung gehört.

**Implementierung:** TanStack Router Nested Route `/settings/$tab` mit Default auf `general`. Tab-State wird NICHT persistiert (immer auf "Allgemein" beim Öffnen).

---

## E02: OS-Keychain-Strategie für API-Keys

**Frage:** Wie werden API-Keys sicher gespeichert und gelesen?

**Entscheidung:** Tauri Rust-Backend mit `keyring` Crate. Drei dedizierte Tauri-Commands:

```
set_api_key(provider: string, key: string) → Result<(), String>
get_api_key(provider: string) → Result<Option<String>, String>
delete_api_key(provider: string) → Result<(), String>
```

Keychain-Service-Name: `polygrid-studio`. Account-Name pro Provider: `ai_claude`, `ai_openai`.

**UI-Verhalten:**
- API-Key-Feld zeigt maskiert (`••••••••`) wenn ein Key existiert
- "Ändern" Button zum Editieren, "Löschen" Button zum Entfernen
- Kein Klartext-Anzeigen des Keys nach dem Speichern
- Verbindungstest-Button prüft ob der Key gültig ist (nutzt bestehende AI-Provider `isAvailable()` Methode)

**Begründung:** Keychain-Commands existieren möglicherweise schon aus Modul 06. Falls ja, wiederverwenden. Falls nicht, neu implementieren. Keys werden NIE in `app_settings` oder einer Datei gespeichert.

**Hinweis für Codex:** Vor der Implementierung prüfen ob `src-tauri/src/` bereits Keychain-Commands enthält.

---

## E03: Backup-Mechanismus

**Frage:** Wie funktioniert das Datenbank-Backup?

**Entscheidung:** SQLite-Datei wird per Tauri Rust-Command kopiert. Kein SQL-Dump, sondern Dateikopie der `polygrid.db`.

**Mechanik:**
- Backup-Verzeichnis: Tauri App-Datenverzeichnis + `/backups/` (konfigurierbar über `backup_directory` Setting)
- Dateiname: `polygrid_backup_YYYY-MM-DD_HH-mm-ss.db`
- Manueller Button "Jetzt sichern" erstellt sofort ein Backup
- Automatisches Backup: Bei jedem App-Start wird geprüft ob seit `last_backup_at` mehr als `backup_interval_hours` vergangen sind. Falls ja, Backup erstellen.
- Max. Backups: Älteste werden gelöscht wenn `backup_max_count` überschritten

**Tauri-Commands:**
```
create_backup() → Result<String, String>  // Gibt Backup-Pfad zurück
list_backups() → Result<Vec<BackupInfo>, String>  // Name, Größe, Datum
delete_backup(filename: string) → Result<(), String>
get_backup_directory() → Result<String, String>
```

**UI:**
- "Jetzt sichern" Button mit Erfolgsmeldung (Toast)
- Backup-Liste mit den letzten N Backups (Name, Datum, Größe)
- Backup-Verzeichnis anzeigen + "Im Finder öffnen" Button
- Intervall-Dropdown: 6h, 12h, 24h (Default), 48h, 7 Tage
- Max. Backups: Eingabefeld (Default: 30)

**Begründung:** Dateikopie ist die einfachste und sicherste Methode für SQLite. Kein Risiko durch laufende Transaktionen, wenn vor der Kopie ein WAL-Checkpoint erzwungen wird.

---

## E04: Export-Funktionen

**Frage:** Welche Export-Funktionen bietet die Settings-Seite?

**Entscheidung:** 4 Export-Buttons:

| Export | Format | Inhalt |
|--------|--------|--------|
| Alle Daten | JSON | Kompletter DB-Dump aller Tabellen als JSON-Objekt |
| Ausgaben | CSV | Alle Ausgaben (oder Jahresfilter) als CSV |
| KI-Protokoll | JSON | ai_jobs Tabelle als JSON-Array |
| EÜR-Daten | Excel | Verweis auf bestehenden EÜR-Export in Modul 08 (kein Duplikat) |

**Mechanik:**
- Alle Exporte nutzen den nativen Tauri-Speichern-Dialog
- JSON-Export: Alle Tabellen einzeln als Objekt in einem JSON-Root `{ products: [...], expenses: [...], ... }`
- CSV-Export: Nutzt papaparse (bereits installiert)
- JSON/CSV Exporte laufen im Frontend (Query + Format + Download)
- Kein separater Tauri-Command nötig, da Tauri die `save` Dialog-API bereitstellt

**EÜR-Hinweis:** Der EÜR-Excel-Export existiert bereits im Auftragsverwaltungs-Modul. In Settings wird ein Link/Button eingefügt, der dorthin navigiert: "EÜR-Export → Zu Aufträge/EÜR".

---

## E05: KI-Log-Viewer

**Frage:** Wie wird der KI-Log-Viewer in Settings umgesetzt?

**Entscheidung:** TanStack Table innerhalb des KI-Tabs, zeigt die letzten 100 ai_jobs-Einträge.

**Spalten:**
| Spalte | Inhalt |
|--------|--------|
| Datum | created_at, formatiert |
| Agent | listing_assistant, expense_assistant etc. als Badge |
| Aktion | action Feld |
| Provider | claude/openai/ollama als Icon |
| Modell | model Feld |
| Tokens | tokens_used |
| Kosten | estimated_cost in EUR |
| Status | success/error als Badge (grün/rot) |
| Dauer | duration_ms formatiert (z.B. "1.2s") |

**Features:**
- Sortierung nach Datum (neueste zuerst)
- Filter: Provider, Agent, Status
- Klick auf Zeile zeigt ein Detail-Popover mit Input/Output (gekürzt)
- Summen-Header: Gesamtkosten dieses Monats, Anzahl Aufrufe dieses Monats
- Pagination (25 pro Seite) statt Virtualisierung (max. 100 Einträge sichtbar)

**Begründung:** Die ai_jobs-Tabelle existiert bereits und wird von allen KI-Modulen befüllt. Der Viewer ist read-only.

---

## E06: Material- und Farbvarianten-Editor

**Frage:** Wie wird der Material- und Farbvarianten-Editor umgesetzt?

**Entscheidung:** Zwei separate Editoren im Tab "Material & Plattformen":

**Materialien-Editor:**
- Tabelle mit: Materialname (Text), Preis pro kg (Zahl, EUR)
- Standard-Materialien vordefiniert: PLA (22), PETG (25), TPU (28), ABS (24), Resin (45)
- Zeilen hinzufügen, bearbeiten, löschen
- Inline-Editing direkt in der Tabelle (kein Modal)
- Speichern als `filament_prices` JSON in app_settings

**Farbvarianten-Bibliothek:**
- Tabelle mit: Name (Text), Hex-Code (Text + Farbvorschau-Kreis)
- Hinzufügen über Inline-Row mit Color-Picker (nativer HTML `input[type=color]`)
- Löschen per Row-Action
- Speichern als `color_variants_library` JSON in app_settings
- Wird in Modul 02 (Produktverwaltung) als Vorschlags-Liste verwendet

**Begründung:** Inline-Editing statt Modals, weil es für tabellarische Key-Value-Daten schneller ist. Kein separates DB-Schema nötig, alles in app_settings als JSON.

---

## E07: Plattformgebühren-Konfiguration

**Frage:** Wie werden Plattformgebühren konfiguriert?

**Entscheidung:** Pro Plattform ein Formular-Block mit:

| Plattform | Felder |
|-----------|--------|
| Etsy | Transaktionsgebühr (%, Default 6.5), Fixbetrag pro Transaktion (EUR, Default 0.20) |
| eBay | Verkäufergebühr (%, Default 11), Fixbetrag (EUR, Default 0) |
| Kleinanzeigen | Gebühr (%, Default 0), Fixbetrag (EUR, Default 0) |

Jede Plattform wird als Karte dargestellt mit dem Plattform-Logo/-Icon oben.

Gespeichert als `platform_fees` JSON in app_settings. Wird vom Margenrechner (Modul 02) und der Auftragserfassung (Modul 08) gelesen.

---

## E08: Versandklassen-Editor

**Frage:** Wie werden Versandklassen verwaltet?

**Entscheidung:** Tabelle mit Inline-Editing:
- Spalten: Name (Text), Preis (EUR)
- Standard-Einträge: Brief (1.60), Warensendung (2.25), Päckchen S (3.99), Paket (6.99)
- Hinzufügen, Bearbeiten, Löschen per Inline-Actions
- Speichern als `shipping_classes` JSON in app_settings

**Begründung:** Gleiche UX-Pattern wie der Material-Editor. Konsistent.

---

## E09: Reset-Flow

**Frage:** Wie funktioniert "Einstellungen zurücksetzen"?

**Entscheidung:** Doppelte Bestätigung:

1. Button "Einstellungen zurücksetzen" im Tab "Daten & Sicherheit"
2. Erster Dialog: "Bist du sicher? Alle Einstellungen werden auf die Standardwerte zurückgesetzt. Deine Daten (Produkte, Ausgaben, Aufträge etc.) bleiben erhalten."
3. Zweiter Dialog: "Letzte Warnung: Eingabefeld mit Texteingabe 'ZURÜCKSETZEN' zur Bestätigung"
4. Nach Bestätigung: Alle Zeilen in `app_settings` löschen, API-Keys aus Keychain entfernen, App neu laden

**Was NICHT zurückgesetzt wird:**
- Fachliche Daten (products, expenses, orders, listings, tasks, templates)
- Datenbank-Struktur
- KI-Log (ai_jobs)
- Bankimport-Daten

**Begründung:** Doppelte Bestätigung mit Texteingabe verhindert versehentliches Zurücksetzen. Nur Settings werden gelöscht, keine Geschäftsdaten.

---

## E10: Drucker-Setup und Stromkosten

**Frage:** Wie wird das Drucker-Setup konfiguriert?

**Entscheidung:** Im Tab "Material & Plattformen" als eigener Abschnitt:

- Druckerleistung in Watt: Eingabefeld (Default: 200)
- Strompreis in EUR/kWh: Eingabefeld (Default: 0.35)
- Versand-Default: Toggle "Versand wird standardmäßig vom Käufer bezahlt" (Default: an)

Diese Werte fließen in den Margenrechner (Modul 02) ein. Die Berechnung: `Stromkosten = (print_time_min / 60) * (printer_power_watts / 1000) * electricity_price_per_kwh`

---

## E11: Aufträge & Finanzen Settings

**Frage:** Wo werden die Finanz-Settings konfiguriert?

**Entscheidung:** Im Tab "Daten & Sicherheit" als eigener Abschnitt "Finanzen & Steuer":

- Steuerstatus: Dropdown (Kleinunternehmer §19, Regelbesteuert). Nur lesbar mit Hinweis "Kontaktiere deinen Steuerberater vor einer Änderung"
- Belegnummern-Format: Eingabefeld (Default: YYYY-NNNN)
- Tax-Lock-Defaults: Zwei Toggles (Monatlicher Export: Default aus, Jährlicher Export: Default an)
- Bank-CSV-Format: Dropdown (N26, Custom)
- Bank-Matching-Toleranzen: Betragsdifferenz (EUR), Zeitfenster Aufträge (Tage), Zeitfenster Ausgaben (Tage)
- Payout-Keywords: Etsy Keywords (Kommasepariert), eBay Keywords (Kommasepariert)

**Begründung:** Steuer-Settings gehören logisch zu "Daten & Sicherheit" weil sie die Datenintegrität betreffen.

---

## E12: Dashboard-Settings

**Frage:** Wo werden Dashboard-Settings konfiguriert?

**Entscheidung:** Im Tab "Allgemein" als kleiner Abschnitt "Dashboard":

- Auto-Snapshot: Toggle (Default: an)
- Schwache-Marge-Schwellwert: Eingabefeld (Default: 30%)

**Begründung:** Nur 2 Felder, rechtfertigt keinen eigenen Tab. Passt thematisch zu "Allgemein".

---

## E13: Speicher-Strategie für Settings

**Frage:** Wie und wann werden Settings gespeichert?

**Entscheidung:** Auto-Save mit Debounce.

- Jede Änderung wird nach 500ms Debounce automatisch in `app_settings` geschrieben
- Toast-Benachrichtigung "Gespeichert" nach erfolgreichem Schreiben
- Kein expliziter "Speichern" Button nötig
- Ausnahme: API-Key-Änderungen und Reset erfordern explizite Bestätigung
- Inline-Editoren (Materialien, Versandklassen, Farbvarianten) speichern beim Blur/Enter einer Zeile

**Begründung:** Auto-Save ist bei Settings-Seiten intuitiver als ein globaler Speichern-Button. Der Nutzer erwartet, dass Änderungen sofort wirksam werden. 500ms Debounce verhindert zu häufige DB-Writes.

---

## E14: Bestehende Settings-UI migrieren

**Frage:** Es gibt bereits minimale Settings-UIs (Theme-Toggle in Foundation, KI-Provider in Modul 06). Was passiert damit?

**Entscheidung:** Die bestehende Settings-Seite (`src/features/settings/`) wird komplett neu gebaut. Die minimalen Toggles, die in früheren Modulen als Provisorium erstellt wurden, werden durch die vollständige Settings-Seite ersetzt. Die bestehenden Hooks und Services (`useTheme`, KI-Provider-Config) bleiben erhalten und werden von der neuen Settings-UI angesteuert.

**Codex-Hinweis:** Bestehende Dateien in `src/features/settings/` vor dem Überschreiben sichten. Hooks und Services in `src/hooks/` und `src/services/` NICHT verändern, nur aus der neuen Settings-UI heraus aufrufen.

---

## E15: Ollama-Konfiguration

**Frage:** Wie wird Ollama konfiguriert?

**Entscheidung:** Im KI-Tab als eigener Abschnitt:

- Endpoint-URL: Eingabefeld (Default: `http://localhost:11434`)
- Modellauswahl: Dropdown mit manueller Eingabe (weil verfügbare Modelle abhängig von der lokalen Ollama-Installation sind)
- Verbindungstest-Button: Prüft ob Ollama unter der URL erreichbar ist
- Status-Anzeige: Grüner Punkt = verbunden, Roter Punkt = nicht erreichbar

**Kein API-Key nötig** da Ollama lokal läuft.

---

## Zusammenfassung der Sub-Session-Aufteilung

| Sub-Session | Scope |
|-------------|-------|
| A | Settings-Route, Tab-Navigation, Tab "Allgemein" (Theme, Akzentfarbe, Sprache, Datumsformat, OneDrive-Pfad, Dashboard-Settings) |
| B | Tab "Material & Plattformen" (Materialien-Editor, Plattformgebühren, Versandklassen, Farbvarianten-Bibliothek, Drucker-Setup) |
| C | Tab "KI-Konfiguration" (Provider-Auswahl, API-Key-Management via Keychain, Modellwahl, Verbindungstest, Ollama, Kostenlimit, KI-Log-Viewer) |
| D | Tab "Markenstil" (Schreibstil, Brand-Wörter, No-Go-Formulierungen, Beispieltext) + Tab "Daten & Sicherheit" (Backup, Export, Finanzen, Reset) |

Jede Sub-Session endet mit grünem Build und Git-Commit.
