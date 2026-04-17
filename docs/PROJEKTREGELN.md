# PolyGrid Studio Business OS – Projektregeln

Version 1.0 | April 2026 | Verbindlich für alle Entwicklungs-KIs

## 1. Projektziel

PolyGrid Studio Business OS ist eine plattformübergreifende Desktop-Anwendung (macOS + Windows) für ein deutsches 3D-Druck-Einzelunternehmen. Die App verwaltet Produkte, Ausgaben, Listings, Aufträge, Dateien und Aufgaben in einem minimalistischen Interface. Zielarchitektur: Offline-First mit optionaler Cloud-KI und lokaler OneDrive-Dateiintegration.

## 2. Tech-Stack (verbindlich)

| Schicht | Technologie | Hinweis |
|---|---|---|
| Runtime | Tauri 2.x (Rust) | Kein Electron |
| Frontend | React 18+ / TypeScript | Strict Mode |
| UI | shadcn/ui + Tailwind CSS | Keine externen Themes |
| State | Zustand | Kein Redux, kein Context-Overuse |
| Tabellen | TanStack Table v8 | Mit Virtualisierung |
| Formulare | React Hook Form + Zod | Zod als Single Source of Truth |
| Routing | TanStack Router | Type-safe |
| Datenbank | SQLite via Tauri SQL Plugin | Drizzle ORM |
| Build | Vite | |
| KI (optional) | Ollama / Claude API / OpenAI | Provider-Pattern |

## 3. Architekturprinzipien

- **Offline-First**: Alle Kernfeatures funktionieren ohne Internet. KI-Buttons werden bei fehlender Verbindung deaktiviert.
- **Datenportabilität**: Kein Vendor Lock-in. SQLite ermöglicht einfache Backups. Alle Daten exportierbar als CSV/JSON.
- **Sicherheit by Default**: Kein Löschen ohne Bestätigung. Soft-Delete mit 30-Tage-Papierkorb. API-Keys im OS-Keychain.
- **Progressive Enhancement**: Jedes Modul funktioniert eigenständig. Abhängigkeiten zwischen Modulen sind optional.
- **Erweiterbarkeit**: Architektur muss spätere API-Integrationen ermöglichen (Versanddienstleister, Einkaufs-APIs, Plattform-APIs).

## 4. Entwicklungsregeln für KI-Assistenten

### 4.1 Modulare Entwicklung

- Immer nur EIN Modul pro Entwicklungssession bearbeiten.
- Jedes Modul hat ein eigenes Anforderungsdokument. Nur dieses Dokument ist relevant für die aktuelle Session.
- Vor dem Start eines neuen Moduls muss das vorherige Modul lauffähig und getestet sein.
- Keine Vorgriffe auf spätere Module. Wenn ein Feature noch nicht spezifiziert ist, Platzhalter einbauen.

### 4.2 Code-Qualität

- TypeScript strict mode ist Pflicht.
- Alle Datenmodelle als Zod-Schemas definieren (Single Source of Truth, Drizzle leitet daraus ab).
- Keine `any`-Types ohne begründeten Kommentar.
- Feature-basierte Ordnerstruktur (`src/features/{modul}/`) statt Sortierung nach Dateityp.
- Jede Dateioperation und KI-Anfrage muss try/catch haben.
- ESLint + Prettier müssen konfiguriert sein und ohne Fehler durchlaufen.

### 4.3 Was eine KI NICHT tun darf

- Bibliotheken austauschen (z.B. Zustand gegen Redux ersetzen) ohne explizite Freigabe.
- Die Ordnerstruktur verändern.
- Abhängigkeiten hinzufügen, die nicht im Tech-Stack stehen, ohne Rückfrage.
- Datenbank-Schema ändern, das in einem anderen Modul definiert wurde.
- Platzhalter-Code schreiben, der nicht kompiliert (`// TODO` reicht nicht, es muss zumindest ein leeres Interface/Stub sein).

## 5. Modulreihenfolge (verbindlich)

Die folgende Reihenfolge ist einzuhalten. Jedes Modul baut auf den vorherigen auf.

| # | Modul | Inhalt | Abhängigkeiten |
|---|---|---|---|
| 1 | Foundation | App Shell, Sidebar, Routing, Theme, DB-Setup, Command Palette | Keine |
| 2 | Produktverwaltung | CRUD, Tabelle, Detail-Panel, Margenrechner | Foundation |
| 3 | Dateimanager | OneDrive-Integration, Ordnerstruktur, Tauri-Commands | Foundation |
| 4 | Ausgabenverwaltung | CRUD, Kategorisierung, Belegverknüpfung | Foundation, (Produkte optional) |
| 5 | Listing-Verwaltung | CRUD, Editor, Zeichenzähler, Plattformlogik | Foundation, Produkte |
| 6 | KI-Architektur | Provider-Pattern, Listing Assistant, Expense Assistant | Foundation, Listings, Ausgaben |
| 7 | Vorlagenbibliothek | CRUD, Platzhaltervariablen, Kategorien | Foundation |
| 8 | Auftragsverwaltung | CRUD, Kanban-Board, Status-Workflow | Foundation, Produkte |
| 9 | Aufgaben-Modul | CRUD, Wochenansicht, Verknüpfungen | Foundation, (Produkte, Aufträge optional) |
| 10 | Analysen/Dashboard | KPI-Karten, Charts, Widgets | Alle vorherigen Module |
| 11 | Settings | Wächst mit jedem Modul, eigenes Dokument | Parallel |

## 6. Aktueller Entwicklungsstand

Der aktuelle Status aller Module wird in `CLAUDE.md` im Repo-Root gepflegt. Dieses Dokument wird nach Abschluss jedes Moduls aktualisiert.

## 7. Zukunftsvision (Post-MVP)

Die Architektur muss folgende spätere Erweiterungen ermöglichen, ohne Umbau der Kernstruktur:

- API-Integrationen: Etsy API, eBay API, Kleinanzeigen (sobald verfügbar).
- Versanddienstleister-APIs: DHL, Hermes, etc. für automatische Etikettenerstellung.
- Einkaufs-Tracking: AliExpress oder ähnliche APIs für automatische Ausgabenerfassung.
- Lokale KI via Ollama für kostenlose Klassifikation und einfache Textgenerierung.
- Web-Version und Mobile Companion App.
- Multi-User mit Rollenkonzept.

---

**Dieses Dokument ist die zentrale Referenz. Bei Widersprüchen zwischen diesem Dokument und modulspezifischen Anforderungen gilt das modulspezifische Dokument für den Modulscope, dieses Dokument für alles Übergreifende.**
