# PolyGrid Studio Business OS

Projektregeln und Entwicklungsleitfaden
Version 1.8 | Mai 2026 | Verbindlich für alle Entwicklungs-KIs

> **Änderungen in v1.8 gegenüber v1.7:**
>
> - Modul 11 (Settings) als abgeschlossen markiert (auf main gemergt)
> - Bekannte offene Bugs Modul 11: Gemini-Provider Keychain speichert nicht, Verbindungstest schlägt fehl (werden separat gefixt, blockieren Modul 12 nicht)
> - Modul 12 (Platform Sync) als aktives Modul festgelegt (Branch: `feat/modul-12-platform-sync`)
> - Aktueller Entwicklungsstand aktualisiert
> - Tech-Stack um `tauri-plugin-oauth` ergänzt (OAuth-Redirect für Desktop-App)

---

## 1. Projektziel

PolyGrid Studio Business OS ist eine plattformübergreifende Desktop-Anwendung (macOS + Windows) für ein deutsches 3D-Druck-Einzelunternehmen. Die App verwaltet Produkte, Ausgaben, Listings, Aufträge, Dateien und Aufgaben in einem minimalistischen Interface. Zielarchitektur: Offline-First mit optionaler Cloud-KI, lokaler OneDrive-Dateiintegration und späterer Plattform-Synchronisation (Etsy, eBay).

---

## 2. Geschäftliche Eckdaten

| Punkt                       | Wert                                                |
| --------------------------- | --------------------------------------------------- |
| Unternehmensform            | Einzelunternehmen                                   |
| Steuerstatus                | Kleinunternehmer nach §19 UStG                      |
| USt.-Verarbeitung           | Keine (brutto = netto)                              |
| Buchführung                 | Einnahmen-Überschuss-Rechnung (EÜR)                 |
| Steuerberater-Software      | Keine (selbst gemacht)                              |
| Bestandsbewertung Material  | Sofortaufwand im Kaufmonat (Standard EÜR)           |
| Bankkonto                   | N26 (privat)                                        |
| Plattformen                 | Etsy, eBay (Kleinanzeigen optional)                 |
| Aufbewahrungspflicht        | 10 Jahre für steuerrelevante Daten                  |

Diese Eckdaten beeinflussen das Datenmodell (kein USt.-Tracking, Tax-Lock-Mechanismus) und die EÜR-Export-Logik.

---

## 3. Tech-Stack (verbindlich)

| Schicht                   | Technologie                               | Hinweis                          |
| ------------------------- | ----------------------------------------- | -------------------------------- |
| Runtime                   | Tauri 2.x (Rust)                          | Kein Electron                    |
| Frontend                  | React 19 / TypeScript                     | Strict Mode                      |
| UI                        | shadcn/ui + Tailwind CSS                  | Keine externen Themes            |
| State                     | Zustand                                   | Kein Redux, kein Context-Overuse |
| Tabellen                  | TanStack Table v8                         | Mit Virtualisierung              |
| Formulare                 | React Hook Form + Zod                     | Zod als Single Source of Truth   |
| Routing                   | TanStack Router                           | Type-safe                        |
| Datenbank                 | SQLite via Tauri SQL Plugin               | Drizzle ORM                      |
| Build                     | Vite                                      |                                  |
| Charts                    | Recharts                                  | Für Modul 04, 10                 |
| Drag-and-Drop             | dnd-kit                                   | Für Listing-Editor, Kanban, Wochenansicht |
| CSV-Parsing               | papaparse                                 | Für Modul 04 und 08              |
| Excel-Export              | exceljs                                   | Für Modul 08 (EÜR-Export)        |
| OAuth (Desktop)           | tauri-plugin-oauth                        | Localhost-Redirect für OAuth-Flow |
| KI (optional)             | Ollama / Claude API / OpenAI              | Provider-Pattern                 |
| Plattform-Sync (Modul 12) | Etsy Open API v3, eBay Sell Inventory API | OAuth 2.0, Provider-Pattern      |

---

## 4. Architekturprinzipien

- **Offline-First**: Alle Kernfeatures funktionieren ohne Internet. KI-Buttons und Sync-Buttons werden bei fehlender Verbindung deaktiviert.
- **Datenportabilität**: Kein Vendor Lock-in. SQLite ermöglicht einfache Backups. Alle Daten exportierbar als CSV/JSON/Excel.
- **Sicherheit by Default**: Kein Löschen ohne Bestätigung. Soft-Delete mit 30-Tage-Papierkorb. API-Keys und OAuth-Tokens im OS-Keychain.
- **Steuerliche Integrität**: Steuerrelevante Datensätze (Aufträge, Ausgaben) können nach EÜR-Export gesperrt werden (Tax-Lock). Belegnummern sind lückenlos und werden nie wiederverwendet.
- **Progressive Enhancement**: Jedes Modul funktioniert eigenständig. Abhängigkeiten zwischen Modulen sind optional.
- **Single Source of Truth**: PolyGrid ist die zentrale Datenhaltung. Plattformen (Etsy, eBay) sind nachgeschaltete Ziele, nicht parallele Datenquellen.
- **Erweiterbarkeit**: Architektur muss spätere API-Integrationen ermöglichen (Versanddienstleister, Banking-API, weitere Plattformen).

---

## 5. Entwicklungsregeln für KI-Assistenten

### 5.1 Modulare Entwicklung

- Immer nur EIN Modul pro Entwicklungssession bearbeiten.
- Jedes Modul hat ein eigenes Anforderungsdokument. Nur dieses Dokument ist relevant für die aktuelle Session.
- Vor dem Start eines neuen Moduls muss das vorherige Modul lauffähig und getestet sein.
- Keine Vorgriffe auf spätere Module. Wenn ein Feature noch nicht spezifiziert ist, Stub mit Tooltip einbauen.

### 5.2 Code-Qualität

- TypeScript strict mode ist Pflicht.
- Alle Datenmodelle als Zod-Schemas definieren (Single Source of Truth, Drizzle leitet daraus ab).
- Keine `any`-Types ohne begründeten Kommentar.
- Feature-basierte Ordnerstruktur (`src/features/{modul}/`) statt Sortierung nach Dateityp.
- Jede Dateioperation, KI-Anfrage und Plattform-API-Anfrage muss try/catch haben.
- ESLint + Prettier müssen konfiguriert sein und ohne Fehler durchlaufen.

### 5.3 Was eine KI NICHT tun darf

- Bibliotheken austauschen (z.B. Zustand gegen Redux ersetzen) ohne explizite Freigabe.
- Die Ordnerstruktur verändern.
- Abhängigkeiten hinzufügen, die nicht im Tech-Stack stehen, ohne Rückfrage.
- Datenbank-Schema ändern, das in einem anderen Modul definiert wurde.
- Platzhalter-Code schreiben, der nicht kompiliert (`// TODO` reicht nicht, es muss zumindest ein leeres Interface/Stub sein).
- Tax-Lock-Mechanismus umgehen (locked Datensätze dürfen nicht editiert oder hard-gelöscht werden).

---

## 6. Modulreihenfolge (aktualisiert v1.8)

Die ursprüngliche Reihenfolge wurde mehrfach geändert: Modul 08 wurde vor Modul 06 implementiert (EÜR-Bedarf). Modul 09 wurde vor Modul 07 implementiert (Abhängigkeiten bereits erfüllt). Module 01 bis 11 sind abgeschlossen. Modul 12 (Platform Sync) ist das aktive Modul.

| #   | Modul              | Inhalt                                                        | Abhängigkeiten                            | Reihenfolge |
| --- | ------------------ | ------------------------------------------------------------- | ----------------------------------------- | ----------- |
| 1   | Foundation         | App Shell, Sidebar, Routing, Theme, DB-Setup, Command Palette | Keine                                     | ✅ 1        |
| 2   | Produktverwaltung  | CRUD, Tabelle, Detail-Panel, Margenrechner                    | Foundation                                | ✅ 2        |
| 3   | Dateimanager       | OneDrive-Integration, Ordnerstruktur, Tauri-Commands          | Foundation                                | ✅ 3        |
| 4   | Ausgabenverwaltung | CRUD, Kategorisierung, Belegverknüpfung, CSV-Export/Import    | Foundation, (Produkte optional)           | ✅ 4        |
| 5   | Listing-Verwaltung | Master+Overrides, Editor, Bilder, Sync-Stubs                  | Foundation, Produkte, Dateimanager        | ✅ 5        |
| 8   | Auftragsverwaltung + EÜR | CRUD, Kanban, EÜR-Export, N26-Bankimport               | Foundation, Produkte, Ausgaben            | ✅ 6        |
| 6   | KI-Architektur     | Provider-Pattern, Listing Assistant, Expense Assistant        | Foundation, Listings, Ausgaben            | ✅ 7        |
| 9   | Aufgaben-Modul     | CRUD, Wochenansicht, Verknüpfungen, KI Task Extractor        | Foundation, Produkte, Listings, Aufträge, KI | ✅ 8     |
| 7   | Vorlagenbibliothek | CRUD, Platzhaltervariablen, Kategorien, KI-Aktionen           | Foundation, KI                            | ✅ 9        |
| 10  | Analysen/Dashboard | KPI-Karten, Charts, Widgets, KPI-Snapshots                    | Alle vorherigen Module                    | ✅ 10       |
| 11  | Settings           | Vollständige Settings-UI mit 5 Tabs, Backup, Export           | Parallel (konsolidiert alle Module)       | ✅ 11       |
| **12** | **Platform Sync** | **Etsy + eBay API-Anbindung, OAuth, Push/Pull, Sync-UI**    | **Listings, Aufträge, Settings**          | **🔄 12**  |

---

## 7. Aktueller Entwicklungsstand

| Modul              | Status                 | Bemerkung                                                              |
| ------------------ | ---------------------- | ---------------------------------------------------------------------- |
| Foundation         | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Produktverwaltung  | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Dateimanager       | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Ausgabenverwaltung | ✅ Abgeschlossen       | Auf main gemergt, inkl. CSV-Import/Export und wiederkehrende Ausgaben  |
| Listing-Verwaltung | ✅ Abgeschlossen       | Auf main gemergt, Master+Overrides-Konzept                             |
| Auftragsverwaltung | ✅ Abgeschlossen       | Auf main gemergt, inkl. EÜR-Export und N26-Bankimport                  |
| KI-Architektur     | ✅ Abgeschlossen       | Auf main gemergt, Provider-Pattern, Listing/Expense/Product Agents, DiffView, Kosten-Tracking |
| Aufgaben-Modul     | ✅ Abgeschlossen       | Auf main gemergt, Wochenansicht, Listenansicht, Recurring Tasks, KI Task Extractor |
| Vorlagenbibliothek | ✅ Abgeschlossen       | Auf main gemergt, Kategorien, {{variablen}}-System, KI-Aktionen, CopyDialog |
| Analysen/Dashboard | ✅ Abgeschlossen       | Auf main gemergt, KPI-Karten, 5 Widgets, 4 Charts, KPI-Snapshots, KI-Zusammenfassung |
| Settings           | ✅ Abgeschlossen       | Auf main gemergt. Bekannte Bugs: Gemini-Provider Keychain + Verbindungstest (non-blocking) |
| Platform Sync      | 🔄 In Bearbeitung      | Aktives Modul, Branch: `feat/modul-12-platform-sync`                   |

_Dieses Dokument wird nach Abschluss jedes Moduls aktualisiert._

---

## 8. Tooling-Workflow

- **Claude.ai Project**: Strategie, Spec-Review, Architektur-Entscheidungen, Codex-Prompt-Erstellung
- **Codex (OpenAI) im VS Code Terminal**: Implementierung mit direktem Repo-Zugriff
- **AGENTS.md im Repo-Root**: Konfiguration für Codex (Modul-Constraints, Tech-Stack-Regeln)

### 8.1 Pro-Modul-Workflow

1. **Spec-Review** in Claude.ai → offene Fragen klären
2. **Entscheidungsdokument** erstellen (`docs/specs/MODUL_XX_ENTSCHEIDUNGEN.md`)
3. **Sub-Sessions** aufteilen (jede endet mit `npm run tauri dev` + Git Commit)
4. **Pro Sub-Session**:
   - Codex-Prompt in Claude.ai erstellt
   - Pflichtlektüre definiert (Spec + Entscheidungsdokument + DATABASE_SCHEMA + relevante Module)
   - Codex liefert Dateiliste der geplanten Änderungen
   - Review in Claude.ai → Go/No-Go
   - Codex implementiert
   - Build-Check: `npm run tauri dev` muss grün sein
   - Git Commit mit konventioneller Message

### 8.2 Branching

- Feature-Branch pro Modul: `feat/modul-XX-name`
- Sub-Session-Commits direkt auf Feature-Branch
- Nach Abschluss aller Sub-Sessions: PR-Review und Merge auf main
- Tag bei Merge: `module-XX-complete`

### 8.3 Gate-Regel

Jede Sub-Session muss mit grünem Build und Git-Commit enden, bevor die nächste startet. Halbfertiger Code wird nicht in den nächsten Schritt mitgenommen.

---

## 9. Zukunftsvision (Post-MVP)

Die Architektur muss folgende spätere Erweiterungen ermöglichen, ohne Umbau der Kernstruktur:

- **Modul 13 (Banking-API)**: PSD2/FinTS-Integration für Live-Banking statt CSV-Import
- **Versanddienstleister-APIs**: DHL, Hermes etc. für automatische Etikettenerstellung
- **Einkaufs-Tracking**: AliExpress oder ähnliche APIs für automatische Ausgabenerfassung
- **Lokale KI via Ollama** für kostenlose Klassifikation und einfache Textgenerierung
- **Web-Version und Mobile Companion App**
- **Multi-User mit Rollenkonzept**
- **DATEV-Export** falls später ein Steuerberater hinzukommt

---

**Dieses Dokument ist die zentrale Referenz. Bei Widersprüchen zwischen diesem Dokument und modulspezifischen Anforderungen gilt das modulspezifische Dokument für den Modulscope, dieses Dokument für alles Übergreifende.**
