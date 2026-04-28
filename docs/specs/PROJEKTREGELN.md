# PolyGrid Studio Business OS

Projektregeln und Entwicklungsleitfaden
Version 1.2 | April 2026 | Verbindlich für alle Entwicklungs-KIs

> **Änderungen in v1.2 gegenüber v1.0:**
> - Modul 12 (Platform Sync) hinzugefügt
> - Aktueller Entwicklungsstand auf Module 01–04 abgeschlossen aktualisiert
> - Tooling-Workflow um Codex-Integration ergänzt

---

## 1. Projektziel

PolyGrid Studio Business OS ist eine plattformübergreifende Desktop-Anwendung (macOS + Windows) für ein deutsches 3D-Druck-Einzelunternehmen. Die App verwaltet Produkte, Ausgaben, Listings, Aufträge, Dateien und Aufgaben in einem minimalistischen Interface. Zielarchitektur: Offline-First mit optionaler Cloud-KI, lokaler OneDrive-Dateiintegration und späterer Plattform-Synchronisation (Etsy, eBay).

---

## 2. Tech-Stack (verbindlich)

| Schicht | Technologie | Hinweis |
|---------|-------------|---------|
| Runtime | Tauri 2.x (Rust) | Kein Electron |
| Frontend | React 19 / TypeScript | Strict Mode |
| UI | shadcn/ui + Tailwind CSS | Keine externen Themes |
| State | Zustand | Kein Redux, kein Context-Overuse |
| Tabellen | TanStack Table v8 | Mit Virtualisierung |
| Formulare | React Hook Form + Zod | Zod als Single Source of Truth |
| Routing | TanStack Router | Type-safe |
| Datenbank | SQLite via Tauri SQL Plugin | Drizzle ORM |
| Build | Vite | |
| Charts | Recharts | Für Modul 04, 10 |
| KI (optional) | Ollama / Claude API / OpenAI | Provider-Pattern |
| Plattform-Sync (Modul 12) | Etsy Open API v3, eBay Sell Inventory API | OAuth 2.0, Provider-Pattern |

---

## 3. Architekturprinzipien

- **Offline-First**: Alle Kernfeatures funktionieren ohne Internet. KI-Buttons und Sync-Buttons werden bei fehlender Verbindung deaktiviert.
- **Datenportabilität**: Kein Vendor Lock-in. SQLite ermöglicht einfache Backups. Alle Daten exportierbar als CSV/JSON.
- **Sicherheit by Default**: Kein Löschen ohne Bestätigung. Soft-Delete mit 30-Tage-Papierkorb. API-Keys und OAuth-Tokens im OS-Keychain.
- **Progressive Enhancement**: Jedes Modul funktioniert eigenständig. Abhängigkeiten zwischen Modulen sind optional.
- **Single Source of Truth**: PolyGrid ist die zentrale Datenhaltung. Plattformen (Etsy, eBay) sind nachgeschaltete Ziele, nicht parallele Datenquellen.
- **Erweiterbarkeit**: Architektur muss spätere API-Integrationen ermöglichen (Versanddienstleister, Einkaufs-APIs, weitere Plattformen).

---

## 4. Entwicklungsregeln für KI-Assistenten

### 4.1 Modulare Entwicklung

- Immer nur EIN Modul pro Entwicklungssession bearbeiten.
- Jedes Modul hat ein eigenes Anforderungsdokument. Nur dieses Dokument ist relevant für die aktuelle Session.
- Vor dem Start eines neuen Moduls muss das vorherige Modul lauffähig und getestet sein.
- Keine Vorgriffe auf spätere Module. Wenn ein Feature noch nicht spezifiziert ist, Stub mit Tooltip einbauen.

### 4.2 Code-Qualität

- TypeScript strict mode ist Pflicht.
- Alle Datenmodelle als Zod-Schemas definieren (Single Source of Truth, Drizzle leitet daraus ab).
- Keine `any`-Types ohne begründeten Kommentar.
- Feature-basierte Ordnerstruktur (`src/features/{modul}/`) statt Sortierung nach Dateityp.
- Jede Dateioperation, KI-Anfrage und Plattform-API-Anfrage muss try/catch haben.
- ESLint + Prettier müssen konfiguriert sein und ohne Fehler durchlaufen.

### 4.3 Was eine KI NICHT tun darf

- Bibliotheken austauschen (z.B. Zustand gegen Redux ersetzen) ohne explizite Freigabe.
- Die Ordnerstruktur verändern.
- Abhängigkeiten hinzufügen, die nicht im Tech-Stack stehen, ohne Rückfrage.
- Datenbank-Schema ändern, das in einem anderen Modul definiert wurde.
- Platzhalter-Code schreiben, der nicht kompiliert (`// TODO` reicht nicht, es muss zumindest ein leeres Interface/Stub sein).
- Echte API-Calls an Etsy oder eBay implementieren außerhalb von Modul 12.

---

## 5. Modulreihenfolge (verbindlich)

| # | Modul | Inhalt | Abhängigkeiten |
|---|-------|--------|----------------|
| 1 | Foundation | App Shell, Sidebar, Routing, Theme, DB-Setup, Command Palette | Keine |
| 2 | Produktverwaltung | CRUD, Tabelle, Detail-Panel, Margenrechner | Foundation |
| 3 | Dateimanager | OneDrive-Integration, Ordnerstruktur, Tauri-Commands | Foundation |
| 4 | Ausgabenverwaltung | CRUD, Kategorisierung, Belegverknüpfung, CSV-Export/Import | Foundation, (Produkte optional) |
| 5 | Listing-Verwaltung | Master+Overrides, Editor, Bilder, Sync-Stubs | Foundation, Produkte, Dateimanager |
| 6 | KI-Architektur | Provider-Pattern, Listing Assistant, Expense Assistant | Foundation, Listings, Ausgaben |
| 7 | Vorlagenbibliothek | CRUD, Platzhaltervariablen, Kategorien | Foundation |
| 8 | Auftragsverwaltung | CRUD, Kanban-Board, Status-Workflow | Foundation, Produkte |
| 9 | Aufgaben-Modul | CRUD, Wochenansicht, Verknüpfungen | Foundation, (Produkte, Aufträge optional) |
| 10 | Analysen/Dashboard | KPI-Karten, Charts, Widgets | Alle vorherigen Module |
| 11 | Settings | Wächst mit jedem Modul, eigenes Dokument | Parallel |
| 12 | Platform Sync | Etsy + eBay API-Anbindung, OAuth, Push/Pull | Listings, Aufträge, Settings |

---

## 6. Aktueller Entwicklungsstand

| Modul | Status | Bemerkung |
|-------|--------|-----------|
| Foundation | ✅ Abgeschlossen | Auf main gemergt |
| Produktverwaltung | ✅ Abgeschlossen | Auf main gemergt |
| Dateimanager | ✅ Abgeschlossen | Auf main gemergt |
| Ausgabenverwaltung | ✅ Abgeschlossen | Auf main gemergt, inkl. CSV-Import/Export und wiederkehrende Ausgaben |
| Listing-Verwaltung | 🔧 In Arbeit | Branch: `feat/modul-05-listing-verwaltung` |
| KI-Architektur | ⏳ Nicht begonnen | |
| Vorlagenbibliothek | ⏳ Nicht begonnen | |
| Auftragsverwaltung | ⏳ Nicht begonnen | |
| Aufgaben-Modul | ⏳ Nicht begonnen | |
| Analysen/Dashboard | ⏳ Nicht begonnen | |
| Settings | ⏳ Wächst mit Modulen | |
| Platform Sync | 📋 Stub-Spec vorhanden | Implementierung nach Modul 11 |

*Dieses Dokument wird nach Abschluss jedes Moduls aktualisiert.*

---

## 7. Tooling-Workflow

- **Claude.ai Project**: Strategie, Spec-Review, Architektur-Entscheidungen, Codex-Prompt-Erstellung
- **Codex (OpenAI) im VS Code Terminal**: Implementierung mit direktem Repo-Zugriff
- **AGENTS.md im Repo-Root**: Konfiguration für Codex (Modul-Constraints, Tech-Stack-Regeln)
- **Pro Modul**:
  1. Spec-Review in Claude.ai → offene Fragen klären
  2. Entscheidungsdokument erstellen (`docs/decisions/MODUL_XX_DECISIONS.md`)
  3. Sub-Sessions aufteilen (jede endet mit `npm run tauri dev` + Git Commit)
  4. Pro Sub-Session: Codex-Prompt → Codex liefert Dateiliste → Review in Claude.ai → Go → Codex implementiert
- **Branching**: Feature-Branch pro Modul (`feat/modul-XX-name`), nach Abschluss in main mergen
- **Gate-Regel**: Jede Sub-Session muss mit grünem Build und Git-Commit enden, bevor die nächste startet

---

## 8. Zukunftsvision (Post-MVP)

Die Architektur muss folgende spätere Erweiterungen ermöglichen, ohne Umbau der Kernstruktur:

- Modul 12 (Platform Sync): Etsy- und eBay-API-Anbindung mit Push/Pull
- Versanddienstleister-APIs: DHL, Hermes, etc. für automatische Etikettenerstellung
- Einkaufs-Tracking: AliExpress oder ähnliche APIs für automatische Ausgabenerfassung
- Lokale KI via Ollama für kostenlose Klassifikation und einfache Textgenerierung
- Web-Version und Mobile Companion App
- Multi-User mit Rollenkonzept

---

**Dieses Dokument ist die zentrale Referenz. Bei Widersprüchen zwischen diesem Dokument und modulspezifischen Anforderungen gilt das modulspezifische Dokument für den Modulscope, dieses Dokument für alles Übergreifende.**
