# AGENTS.md — PolyGrid Studio Business OS

Dieses Dokument ist verbindlich für alle Codex-Sessions. Vor jeder Session komplett lesen.

---

## Projekt-Kontext

Desktop-App (macOS + Windows) für ein deutsches 3D-Druck-Einzelunternehmen. Gebaut mit Tauri 2 + React 18 + TypeScript. Alle Kern-Features funktionieren offline.

Repo-Root: `polygrid-studio/`
Specs: `docs/specs/` — vor jeder Modul-Session das zugehörige Spec-Dokument lesen.

---

## Verbindlicher Tech-Stack

Nichts außerhalb dieser Liste ohne explizite Freigabe hinzufügen.

| Schicht | Technologie |
|---|---|
| Runtime | Tauri 2.x (Rust) — kein Electron |
| Frontend | React 18 / TypeScript strict mode |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Tabellen | TanStack Table v8 mit Virtualisierung |
| Formulare | React Hook Form + Zod |
| Routing | TanStack Router (type-safe) |
| Datenbank | SQLite via Tauri SQL Plugin + Drizzle ORM |
| Build | Vite |
| KI (optional) | Provider-Pattern: Claude API / OpenAI / Ollama |

---

## Ordnerstruktur (unveränderlich)

```
polygrid-studio/
  src/
    main.tsx
    App.tsx
    components/
      ui/           # shadcn/ui Komponenten
      layout/       # AppShell, Sidebar, CommandPalette, DetailPanel
      shared/       # Wiederverwendbare Komponenten
    features/
      dashboard/
      products/
      expenses/
      orders/
      listings/
      templates/
      files/
      tasks/
      analytics/
      ai-assistant/
      settings/
    services/
      database/     # schema.ts, migrations/, index.ts
      ai/
      filesystem/
      export/
    hooks/
    stores/
    types/
    utils/
    styles/
  src-tauri/
  drizzle/
  docs/
    specs/          # Modul-Spec-Dokumente
```

Ordnerstruktur nicht verändern. Neue Dateien immer in den passenden bestehenden Ordner.

---

## Entwicklungsregeln

### Was Codex tun muss

- Immer nur EIN Modul pro Session bearbeiten.
- Vor Beginn das Spec-Dokument in `docs/specs/` für das aktuelle Modul lesen.
- TypeScript strict mode ist Pflicht — kein `any` ohne Kommentar mit Begründung.
- Alle Datenmodelle als Zod-Schema definieren (Single Source of Truth). Drizzle leitet davon ab.
- Feature-basierte Ordnerstruktur: `src/features/{modul}/`.
- Jede Datei-Operation und KI-Anfrage braucht try/catch.
- ESLint + Prettier müssen ohne Fehler durchlaufen.
- Jede Session endet mit `npm run tauri dev` (muss fehlerfrei starten) + Git Commit.
- Kein Partial-Progress in Git committen — nur funktionierenden Stand.

### Was Codex NICHT tun darf

- Bibliotheken gegen andere austauschen (z.B. Zustand gegen Redux).
- Die Ordnerstruktur verändern.
- Abhängigkeiten hinzufügen, die nicht im Tech-Stack stehen — erst fragen.
- Das Datenbank-Schema eines anderen Moduls verändern.
- Platzhalter-Code schreiben, der nicht kompiliert (`// TODO` reicht nicht — Stub oder leeres Interface minimum).
- Mehrere Module gleichzeitig implementieren.

---

## Modulreihenfolge (verbindlich)

Jedes Modul muss abgeschlossen und committed sein, bevor das nächste beginnt.

| # | Modul | Status |
|---|---|---|
| 01 | Foundation | Nicht begonnen |
| 02 | Produktverwaltung | Wartet auf 01 |
| 03 | Dateimanager | Wartet auf 02 |
| 04 | Ausgabenverwaltung | Wartet auf 01 |
| 05 | Listing-Verwaltung | Wartet auf 02 |
| 06 | KI-Architektur | Wartet auf 05 |
| 07 | Vorlagenbibliothek | Wartet auf 01 |
| 08 | Auftragsverwaltung | Wartet auf 02 |
| 09 | Aufgaben-Modul | Wartet auf 01 |
| 10 | Analysen/Dashboard | Wartet auf alle |
| 11 | Settings | Parallel zu allen |

---

## Sub-Session-Struktur

Jede Modul-Session wird in Sub-Sessions aufgeteilt. Jede Sub-Session hat einen klar definierten Endpunkt. Codex stoppt nach jedem Endpunkt und wartet auf Freigabe.

**Sub-Session A (Modul 01 — Beispiel):**
1. Scaffold-Validierung + Git-Setup
2. Dependencies + Tailwind/shadcn-Konfiguration
3. Theme-System
4. SQLite-Backend isoliert (Test-Tabelle + Rust-Command, keine UI-Verbindung)
5. Vollständiges Drizzle-Schema
6. App Shell + Routing
7. Command Palette

Endpunkt jeder Sub-Session: `npm run tauri dev` läuft fehlerfrei + Git Commit.

---

## Architektur-Prinzipien

- **Offline-First:** Alle Kern-Features ohne Internet. KI-Buttons werden deaktiviert wenn kein Provider erreichbar.
- **Soft-Delete:** Kein hartes Löschen ohne explizite Anforderung. `deleted_at` Timestamp, 30-Tage-Papierkorb.
- **Keine API-Keys in DB oder Config-Dateien** — immer OS-Keychain via Tauri.
- **Progressive Enhancement:** Jedes Modul funktioniert eigenständig. Modul-übergreifende Abhängigkeiten sind optional, nicht hart verdrahtet.
- **Erweiterbarkeit:** Architektur muss spätere API-Integrationen ermöglichen (Versanddienstleister, Etsy API, eBay API) ohne Umbau der Kernstruktur.

---

## Bei Unklarheiten

Wenn eine Anforderung unklar ist oder zwei Spec-Dokumente sich widersprechen: Stoppen und fragen, nicht raten. Das modulspezifische Spec-Dokument hat Vorrang gegenüber diesem Dokument für den Modul-Scope. Dieses Dokument gilt für alles Übergreifende.
