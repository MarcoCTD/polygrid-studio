# Modul 11: Settings

PolyGrid Studio Business OS
Anforderungsdokument | Version 2.0 | Mai 2026

---

## 1. Scope und Ziel

Dieses Modul implementiert die vollständige Settings-Seite. Viele Einstellungen wurden in früheren Modulen bereits gelesen (Filamentpreise, KI-API-Keys, Theme etc.), hier wird die konsolidierte UI zum Konfigurieren aller Parameter bereitgestellt.

### 1.1 Lieferergebnisse

- Settings-Seite mit 5 Tabs: Allgemein, Material & Plattformen, KI-Konfiguration, Markenstil, Daten & Sicherheit
- Vertikale Tab-Navigation (links) mit Content-Bereich (rechts)
- Persistierung aller Settings in `app_settings` Tabelle (Key-Value, JSON)
- API-Key-Verwaltung über OS-Keychain (Tauri Rust-Backend)
- Inline-Editoren für Materialien, Versandklassen, Farbvarianten
- KI-Log-Viewer (TanStack Table, read-only)
- Backup-Verwaltung (manuell + automatisch)
- Export-Funktionen (JSON, CSV, KI-Log)
- Reset mit doppelter Bestätigung
- Auto-Save mit 500ms Debounce auf allen Formularen

### 1.2 Abhängigkeiten

- Foundation (DB, Routing, Theme-Hook, App Shell)
- Alle bisherigen Module (lesen Settings, die hier konfiguriert werden)

### 1.3 Explizit NICHT im Scope

- Keine neuen DB-Tabellen (alles in bestehender `app_settings`)
- Keine Änderungen an bestehenden Hooks/Services (nur aufrufen)
- Keine Plattform-Sync-Settings (kommt in Modul 12)

---

## 2. Bestehende Infrastruktur

Folgende Komponenten existieren bereits und werden von der Settings-UI genutzt:

| Komponente | Modul | Verwendung in Settings |
|-----------|-------|----------------------|
| `useTheme` Hook | 01 | Theme- und Akzentfarben-Wechsel |
| `app_settings` Tabelle | 01 | Alle Settings lesen/schreiben |
| AI Provider Pattern | 06 | `isAvailable()` für Verbindungstest |
| Keychain Commands | 06 | API-Keys lesen/schreiben/löschen (falls vorhanden) |
| `ai_jobs` Tabelle | 06 | KI-Log-Viewer liest daraus |
| `DEFAULTS` Konstante | 01 | Fallback-Werte für alle Settings |

---

## 3. UI-Spezifikation

### 3.1 Layout

Route: `/settings` mit Nested Route `/settings/$tab`

Vertikale Tab-Navigation links (200px, fest) mit 5 Tabs. Content-Bereich rechts (flex, max-width 800px). Kein Detail-Panel auf der Settings-Seite. Default-Tab beim Öffnen: "Allgemein".

Tabs:

| Tab | Route-Param | Icon (Lucide) |
|-----|------------|--------------|
| Allgemein | `general` | Settings |
| Material & Plattformen | `materials` | Package |
| KI-Konfiguration | `ai` | Sparkles |
| Markenstil | `brand` | Palette |
| Daten & Sicherheit | `data` | Shield |

### 3.2 Tab: Allgemein

**Abschnitt "Grundeinstellungen":**
- Firmenname / Shopname: Freitext (Default: "PolyGrid Studio")
- Sprache: Dropdown DE/EN (Default: DE). Hinweis: "Ändert die App-Sprache (Neustart erforderlich)"
- Datumsformat: Dropdown TT.MM.JJJJ / JJJJ-MM-TT (Default: TT.MM.JJJJ)

**Abschnitt "Erscheinungsbild":**
- Theme: Radio-Group Hell / Dunkel / System (Default: System)
- Akzentfarbe: 6 Preset-Buttons (SAP-Blau, Indigo, Petrol, Orange, Violett, Graphit) mit Farbvorschau. Aktiver Preset hat Rahmen in der jeweiligen Farbe.
- Vorschau: Live-Update beim Klick (bereits über `useTheme` Hook implementiert)

**Abschnitt "OneDrive-Ordner":**
- Aktueller Pfad anzeigen (read-only Textfeld)
- "Ordner ändern" Button (öffnet nativen Verzeichnis-Dialog via Tauri)
- Status-Anzeige: Grüner Punkt wenn Ordner existiert, Roter Punkt wenn nicht erreichbar

**Abschnitt "Dashboard":**
- Auto-Snapshot: Toggle (Default: an)
- Schwache-Marge-Schwellwert: Eingabefeld mit % Suffix (Default: 30)

### 3.3 Tab: Material & Plattformen

**Abschnitt "Materialien":**
- Inline-editierbare Tabelle:
  - Spalten: Material (Text), Preis pro kg (EUR, Zahl)
  - Standard-Einträge: PLA (22.00), PETG (25.00), TPU (28.00), ABS (24.00), Resin (45.00)
  - Aktionen pro Zeile: Bearbeiten (Inline), Löschen (mit Bestätigung)
  - "Material hinzufügen" Button unter der Tabelle
- Gespeichert als `filament_prices` JSON

**Abschnitt "Drucker-Setup":**
- Druckerleistung: Eingabefeld mit "Watt" Suffix (Default: 200)
- Strompreis: Eingabefeld mit "EUR/kWh" Suffix (Default: 0.35)
- Versand-Default: Toggle "Versand wird standardmäßig vom Käufer bezahlt" (Default: an)

**Abschnitt "Plattformgebühren":**
- Pro Plattform eine Karte mit Icon:
  - Etsy: Transaktionsgebühr (%, Default: 6.5), Fixbetrag (EUR, Default: 0.20)
  - eBay: Verkäufergebühr (%, Default: 11), Fixbetrag (EUR, Default: 0)
  - Kleinanzeigen: Gebühr (%, Default: 0), Fixbetrag (EUR, Default: 0)
- Gespeichert als `platform_fees` JSON

**Abschnitt "Versandklassen":**
- Inline-editierbare Tabelle:
  - Spalten: Name (Text), Preis (EUR)
  - Standard-Einträge: Brief (1.60), Warensendung (2.25), Päckchen S (3.99), Paket (6.99)
  - Aktionen: Bearbeiten (Inline), Löschen
  - "Versandklasse hinzufügen" Button
- Gespeichert als `shipping_classes` JSON

**Abschnitt "Farbvarianten-Bibliothek":**
- Inline-editierbare Tabelle:
  - Spalten: Farbvorschau (Kreis 20px), Name (Text), Hex-Code (Text)
  - Color-Picker beim Hinzufügen/Bearbeiten (nativer HTML `input[type=color]`)
  - Aktionen: Bearbeiten, Löschen
  - "Farbe hinzufügen" Button
- Gespeichert als `color_variants_library` JSON

### 3.4 Tab: KI-Konfiguration

**Abschnitt "KI-Provider":**
- Bevorzugter Provider: Radio-Group (Claude, OpenAI, Ollama)
- Pro Provider ein aufklappbarer Abschnitt (Accordion):

  **Claude:**
  - API-Key: Maskiertes Feld mit "Ändern" und "Löschen" Buttons
  - Bevorzugtes Modell: Dropdown (claude-sonnet-4-20250514, claude-opus-4-20250514)
  - Verbindungstest: Button mit Status-Anzeige (Erfolg/Fehler)

  **OpenAI:**
  - API-Key: Maskiertes Feld mit "Ändern" und "Löschen" Buttons
  - Bevorzugtes Modell: Dropdown (gpt-4o, gpt-4o-mini)
  - Verbindungstest: Button mit Status-Anzeige

  **Ollama:**
  - Endpoint-URL: Eingabefeld (Default: http://localhost:11434)
  - Modell: Freitext-Dropdown (llama3, mistral, phi3, custom)
  - Verbindungstest: Button mit Status-Anzeige
  - Kein API-Key (lokal)

**Abschnitt "KI-Einstellungen":**
- Monatliches Kostenlimit: Eingabefeld mit "EUR" Suffix (Default: 10)
- KI-Logging: Toggle (Default: an)
- Betriebsmodus: Radio-Group "Nur Vorschläge" / "Vorschlag + Bestätigung" (Default: Vorschlag + Bestätigung)

**Abschnitt "KI-Protokoll":**
- Summen-Header: Kosten dieses Monats (EUR), Anzahl Aufrufe dieses Monats
- TanStack Table mit Spalten: Datum, Agent (Badge), Aktion, Provider (Icon), Modell, Tokens, Kosten (EUR), Status (Badge), Dauer
- Filter: Provider, Agent, Status
- Sortierung: Datum (neueste zuerst, Default)
- Pagination: 25 pro Seite
- Klick auf Zeile: Detail-Popover mit Input/Output Text
- Max. 100 Einträge laden (performance)

### 3.5 Tab: Markenstil

**Abschnitt "Schreibstil":**
- Dropdown: sachlich-minimalistisch (Default), technisch-präzise, freundlich-professionell
- Vorschau-Text unter dem Dropdown, der den gewählten Stil illustriert

**Abschnitt "Markenvokabular":**
- Brand-Wörter: Tag-Input (Kommasepariert eingeben, als Tags anzeigen, X zum Entfernen)
- No-Go-Formulierungen: Tag-Input (gleiche UX)

**Abschnitt "Referenztext":**
- Textarea (6 Zeilen) für einen Beispieltext im gewünschten Stil
- Hinweis: "Dieser Text wird KI-Agenten als Stilreferenz übergeben"

### 3.6 Tab: Daten & Sicherheit

**Abschnitt "Backup":**
- "Jetzt sichern" Button (primär)
- Letztes Backup: Datum + Uhrzeit anzeigen
- Backup-Intervall: Dropdown (6h, 12h, 24h, 48h, 7 Tage)
- Max. Backups: Eingabefeld (Default: 30)
- Backup-Verzeichnis: Pfad anzeigen + "Im Finder öffnen" Button
- Backup-Liste: Die letzten 10 Backups mit Name, Datum, Größe. Löschen-Button pro Zeile.

**Abschnitt "Datenexport":**
- 4 Export-Buttons:
  - "Alle Daten als JSON" → kompletter DB-Dump
  - "Ausgaben als CSV" → expenses Tabelle
  - "KI-Protokoll als JSON" → ai_jobs Tabelle
  - "EÜR-Export" → Navigation zu `/orders` (bestehender Export)

**Abschnitt "Finanzen & Steuer":**
- Steuerstatus: Dropdown (Kleinunternehmer §19, Regelbesteuert). Read-only Badge mit Hinweis "Kontaktiere deinen Steuerberater vor einer Änderung"
- Belegnummern-Format: Eingabefeld (Default: YYYY-NNNN)
- Tax-Lock bei monatlichem Export: Toggle (Default: aus)
- Tax-Lock bei jährlichem Export: Toggle (Default: an)
- Bank-CSV-Format: Dropdown (N26, Custom)
- Bank-Matching Betragsdifferenz: Eingabefeld EUR (Default: 0.02)
- Bank-Matching Zeitfenster Aufträge: Eingabefeld Tage (Default: 14)
- Bank-Matching Zeitfenster Ausgaben: Eingabefeld Tage (Default: 7)
- Payout-Keywords Etsy: Tag-Input (Default: Etsy, Etsy Ireland, Etsy Inc)
- Payout-Keywords eBay: Tag-Input (Default: eBay, Ebay Marketplaces)

**Abschnitt "Archiv":**
- Aufbewahrungsdauer: Eingabefeld Tage (Default: 30). Hinweis: "Archivierte Dateien werden nach dieser Frist endgültig gelöscht"

**Abschnitt "Zurücksetzen":**
- Button "Einstellungen zurücksetzen" (destructive Variante)
- Erster Dialog: Warnung mit "Fortfahren" / "Abbrechen"
- Zweiter Dialog: Texteingabe "ZURÜCKSETZEN" + "Bestätigen" Button
- Aktion: Alle app_settings löschen, API-Keys aus Keychain entfernen, App neu laden
- Hinweis: "Deine Daten (Produkte, Ausgaben, Aufträge etc.) bleiben erhalten"

---

## 4. Technische Details

### 4.1 Auto-Save

Alle Formularfelder nutzen Auto-Save mit 500ms Debounce:
- Änderung am Feld → 500ms warten → `app_settings` UPDATE/INSERT → Toast "Gespeichert"
- Inline-Editoren (Tabellen) speichern beim Verlassen der Zeile (Blur/Enter)
- API-Key-Änderungen erfordern expliziten "Speichern" Button

### 4.2 Settings-Service

Zentraler Service `settingsService` (falls nicht schon vorhanden):
```typescript
getSetting<T>(key: string): Promise<T | null>
setSetting(key: string, value: unknown): Promise<void>
getSettingWithDefault<T>(key: string, defaultValue: T): Promise<T>
resetAllSettings(): Promise<void>
```

Liest/schreibt in `app_settings` Tabelle. Nutzt bestehende DB-Service-Instanz.

### 4.3 DEFAULTS Konstante

Zentrale Datei `src/services/settings/defaults.ts` mit allen Default-Werten. Von allen Modulen importierbar. Wird in Modul 11 vollständig befüllt (teilweise schon vorhanden).

### 4.4 Tauri-Commands (Rust-Backend)

Neue oder erweiterte Rust-Commands:

| Command | Beschreibung |
|---------|-------------|
| `set_api_key(provider, key)` | Key im OS-Keychain speichern |
| `get_api_key(provider)` | Key aus Keychain lesen (oder None) |
| `delete_api_key(provider)` | Key aus Keychain löschen |
| `create_backup()` | DB-Datei kopieren, gibt Pfad zurück |
| `list_backups()` | Backup-Verzeichnis auflisten |
| `delete_backup(filename)` | Einzelnes Backup löschen |
| `get_backup_directory()` | Backup-Pfad zurückgeben |
| `open_path_in_explorer(path)` | Im nativen Dateimanager öffnen |

**Hinweis:** Prüfen ob `set_api_key`/`get_api_key`/`delete_api_key` und `open_path_in_explorer` bereits aus Modul 06 bzw. Modul 03 existieren. Falls ja, wiederverwenden.

---

## 5. Sub-Session-Aufteilung

### Sub-Session A: Settings-Route + Tab "Allgemein"

- Nested Route `/settings/$tab` mit TanStack Router
- Vertikale Tab-Navigation (5 Tabs)
- Tab "Allgemein" vollständig implementieren:
  - Grundeinstellungen (Firmenname, Sprache, Datumsformat)
  - Erscheinungsbild (Theme, Akzentfarbe) via bestehenden `useTheme` Hook
  - OneDrive-Ordner (Pfad anzeigen, ändern)
  - Dashboard-Settings (Auto-Snapshot, Marge-Schwellwert)
- Auto-Save mit Debounce
- Restliche 4 Tabs als Platzhalter

### Sub-Session B: Tab "Material & Plattformen"

- Materialien-Editor (Inline-Tabelle)
- Drucker-Setup (Watt, Strompreis, Versand-Default)
- Plattformgebühren (3 Karten)
- Versandklassen-Editor (Inline-Tabelle)
- Farbvarianten-Bibliothek (Inline-Tabelle mit Color-Picker)
- Alle Werte in app_settings persistieren

### Sub-Session C: Tab "KI-Konfiguration"

- Provider-Auswahl (Radio-Group)
- API-Key-Management (Keychain-Commands, maskierte Felder)
- Modellwahl pro Provider
- Verbindungstest-Buttons
- Ollama-Konfiguration
- KI-Einstellungen (Kostenlimit, Logging, Betriebsmodus)
- KI-Log-Viewer (TanStack Table, Filter, Pagination, Detail-Popover)

### Sub-Session D: Tab "Markenstil" + Tab "Daten & Sicherheit"

- Markenstil: Schreibstil-Dropdown, Brand-Wörter, No-Go-Formulierungen, Referenztext
- Backup: Manuell + Automatisch, Backup-Liste, Backup-Verzeichnis
- Datenexport: JSON, CSV, KI-Log, EÜR-Link
- Finanzen & Steuer: Alle Finanz-Settings
- Archiv-Aufbewahrung
- Reset-Flow (doppelte Bestätigung)

---

## 6. Akzeptanzkriterien

- Alle 5 Tabs sind navigierbar und funktional
- Einstellungen persistieren nach App-Neustart
- Auto-Save funktioniert mit Toast-Feedback
- Theme-Wechsel und Akzentfarben-Wechsel funktionieren live
- API-Keys werden im OS-Keychain gespeichert, nicht in der DB
- Verbindungstest für KI-Provider funktioniert (mindestens Claude oder OpenAI)
- KI-Log-Viewer zeigt Einträge aus ai_jobs korrekt an
- Materialien-Editor: Hinzufügen, Bearbeiten, Löschen funktioniert
- Versandklassen-Editor: Hinzufügen, Bearbeiten, Löschen funktioniert
- Farbvarianten-Editor: Color-Picker und Inline-Editing funktioniert
- Plattformgebühren werden korrekt gespeichert
- Manuelles Backup erstellt eine Kopie der Datenbank
- Automatisches Backup wird bei App-Start geprüft
- CSV-Export der Ausgaben funktioniert
- JSON-Export aller Daten funktioniert
- KI-Log-Export funktioniert
- Finanzen-Settings werden korrekt gespeichert und gelesen
- Zurücksetzen erfordert doppelte Bestätigung und setzt nur Settings zurück
- Kein TypeScript-Fehler im strict mode
- `npm run tauri dev` startet ohne Fehler
