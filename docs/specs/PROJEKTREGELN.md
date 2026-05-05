# PolyGrid Studio Business OS

Projektregeln und Entwicklungsleitfaden
Version 1.3 | April 2026 | Verbindlich für alle Entwicklungs-KIs

> **Änderungen in v1.3 gegenüber v1.2:**
>
> - Modul 05 (Listing-Verwaltung) als abgeschlossen markiert
> - Modul 08 (Auftragsverwaltung) auf Modul 06 vorgezogen wegen EÜR-Bedarf
> - Modul 08 Spec um EÜR-Export, N26-CSV-Bankimport und Tax-Lock erweitert
> - Geschäftliche Eckdaten ergänzt (Kleinunternehmer §19 UStG)
> - Tooling-Workflow präzisiert (Codex-Prompts pro Sub-Session)

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
| Drag-and-Drop             | dnd-kit                                   | Für Listing-Editor und Kanban    |
| CSV-Parsing               | papaparse                                 | Für Modul 04 und 08              |
| Excel-Export              | exceljs                                   | Für Modul 08 (EÜR-Export)        |
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
- Echte API-Calls an Etsy oder eBay implementieren außerhalb von Modul 12.
- Tax-Lock-Mechanismus umgehen (locked Datensätze dürfen nicht editiert oder hard-gelöscht werden).

---

## 6. Modulreihenfolge (aktualisiert v1.3)

Die ursprüngliche Reihenfolge wurde geändert: Modul 08 wird vor Modul 06 implementiert, weil das EÜR-Tracking dringend für die Steuererklärung benötigt wird. Modul 08 hängt nur von Foundation und Modul 02 ab — beide sind abgeschlossen.

| #   | Modul              | Inhalt                                                        | Abhängigkeiten                            | Reihenfolge |
| --- | ------------------ | ------------------------------------------------------------- | ----------------------------------------- | ----------- |
| 1   | Foundation         | App Shell, Sidebar, Routing, Theme, DB-Setup, Command Palette | Keine                                     | ✅ 1        |
| 2   | Produktverwaltung  | CRUD, Tabelle, Detail-Panel, Margenrechner                    | Foundation                                | ✅ 2        |
| 3   | Dateimanager       | OneDrive-Integration, Ordnerstruktur, Tauri-Commands          | Foundation                                | ✅ 3        |
| 4   | Ausgabenverwaltung | CRUD, Kategorisierung, Belegverknüpfung, CSV-Export/Import    | Foundation, (Produkte optional)           | ✅ 4        |
| 5   | Listing-Verwaltung | Master+Overrides, Editor, Bilder, Sync-Stubs                  | Foundation, Produkte, Dateimanager        | ✅ 5        |
| **8** | **Auftragsverwaltung + EÜR** | **CRUD, Kanban, EÜR-Export, N26-Bankimport**       | **Foundation, Produkte, Ausgaben**        | **🔄 6**    |
| 6   | KI-Architektur     | Provider-Pattern, Listing Assistant, Expense Assistant        | Foundation, Listings, Ausgaben            | ⏳ 7        |
| 9   | Aufgaben-Modul     | CRUD, Wochenansicht, Verknüpfungen                            | Foundation, (Produkte, Aufträge optional) | ⏳ 8        |
| 7   | Vorlagenbibliothek | CRUD, Platzhaltervariablen, Kategorien                        | Foundation, KI                            | ⏳ 9        |
| 10  | Analysen/Dashboard | KPI-Karten, Charts, Widgets                                   | Alle vorherigen Module                    | ⏳ 10       |
| 11  | Settings           | Wächst mit jedem Modul, eigenes Dokument                      | Parallel                                  | ⏳ 11       |
| 12  | Platform Sync      | Etsy + eBay API-Anbindung, OAuth, Push/Pull                   | Listings, Aufträge, Settings              | 📋 Post-MVP |

---

## 7. Aktueller Entwicklungsstand

| Modul              | Status                 | Bemerkung                                                              |
| ------------------ | ---------------------- | ---------------------------------------------------------------------- |
| Foundation         | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Produktverwaltung  | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Dateimanager       | ✅ Abgeschlossen       | Auf main gemergt                                                       |
| Ausgabenverwaltung | ✅ Abgeschlossen       | Auf main gemergt, inkl. CSV-Import/Export und wiederkehrende Ausgaben  |
| Listing-Verwaltung | ✅ Abgeschlossen       | Auf main gemergt, Master+Overrides-Konzept                             |
| Auftragsverwaltung | ✅ Abgeschlossen | Auf main gemergt, inkl. EÜR-Export und N26-Bankimport                        |
| KI-Architektur     | ⏳ Nicht begonnen      |                                                                        |
| Aufgaben-Modul     | ⏳ Nicht begonnen      |                                                                        |
| Vorlagenbibliothek | ⏳ Nicht begonnen      |                                                                        |
| Analysen/Dashboard | ⏳ Nicht begonnen      |                                                                        |
| Settings           | ⏳ Wächst mit Modulen  |                                                                        |
| Platform Sync      | 📋 Stub-Spec vorhanden | Implementierung nach Modul 11                                          |

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

- **Modul 12 (Platform Sync)**: Etsy- und eBay-API-Anbindung mit Push/Pull
- **Modul 13 (Banking-API)**: PSD2/FinTS-Integration für Live-Banking statt CSV-Import
- **Versanddienstleister-APIs**: DHL, Hermes etc. für automatische Etikettenerstellung
- **Einkaufs-Tracking**: AliExpress oder ähnliche APIs für automatische Ausgabenerfassung
- **Lokale KI via Ollama** für kostenlose Klassifikation und einfache Textgenerierung
- **Web-Version und Mobile Companion App**
- **Multi-User mit Rollenkonzept**
- **DATEV-Export** falls später ein Steuerberater hinzukommt

---

**Dieses Dokument ist die zentrale Referenz. Bei Widersprüchen zwischen diesem Dokument und modulspezifischen Anforderungen gilt das modulspezifische Dokument für den Modulscope, dieses Dokument für alles Übergreifende.**
