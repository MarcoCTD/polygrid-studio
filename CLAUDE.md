# PolyGrid Studio Business OS

## Projekt-Identität

Plattformübergreifende Desktop-ERP-Anwendung (macOS + Windows) für ein 3D-Druck-Einzelunternehmen. Verwaltet Produkte, Ausgaben, Listings, Aufträge, Dateien und Aufgaben. Offline-First mit optionaler Cloud-KI und lokaler OneDrive-Dateiintegration.

## Aktueller Stand

**Aktives Modul: Modul 03 – Dateimanager**
Spec lesen: `docs/modules/MODUL_03_DATEIMANAGER.md`
Design-System: `docs/DESIGN_SYSTEM.md`

| # | Modul | Status |
|---|---|---|
| 1 | Foundation | ✅ Abgeschlossen |
| 2 | Produktverwaltung | ✅ Abgeschlossen |
| 3 | Dateimanager | 🟡 Nächster Schritt |
| 4 | Ausgabenverwaltung | ⚪ Nicht begonnen |
| 5 | Listing-Verwaltung | ⚪ Nicht begonnen |
| 6 | KI-Architektur | ⚪ Nicht begonnen |
| 7 | Vorlagenbibliothek | ⚪ Nicht begonnen |
| 8 | Auftragsverwaltung | ⚪ Nicht begonnen |
| 9 | Aufgaben-Modul | ⚪ Nicht begonnen |
| 10 | Analysen/Dashboard | ⚪ Nicht begonnen |
| 11 | Settings | ⚪ Nicht begonnen |

## Tech-Stack (verbindlich, nicht austauschen)

| Schicht | Technologie |
|---|---|
| Runtime | Tauri 2.x (Rust) |
| Frontend | React 18 + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Tabellen | TanStack Table v8 (mit Virtualisierung) |
| Formulare | React Hook Form + Zod |
| Routing | TanStack Router (type-safe) |
| Datenbank | SQLite (Tauri SQL Plugin) + Drizzle ORM |
| Build | Vite |
| Fonts | @fontsource/inter, @fontsource/jetbrains-mono (lokal, kein CDN) |

## Kernregeln

### Was du tun sollst
- **Ein Modul pro Session.** Nur die aktive Modul-Spec ist relevant.
- **Zod als Single Source of Truth** für alle Datenmodelle. Drizzle-Schemas daraus ableiten.
- **Feature-basierte Ordnerstruktur**: `src/features/{modul}/`, nicht nach Dateityp sortieren.
- **Try/catch** um jede Dateioperation und jeden KI-Call.
- **Soft-Delete** mit `deleted_at`-Feld, niemals hartes DELETE.
- **Platzhalter-Code muss kompilieren.** Leeres Interface/Stub statt `// TODO`.
- **`docs/DATABASE_SCHEMA.md` aktuell halten.** Nach jedem Modul, das Felder ergänzt oder Tabellen ändert, die Datei updaten.

### Kommunikation
- **Bei Unklarheit: nachfragen, nicht raten.** Der Nutzer ist kein Entwickler. Eine Rückfrage ist immer besser als eine falsche Annahme.
- **Keine stillen Nebenaktionen.** Keine `npm audit fix`, keine Version-Bumps, keine Formatierungs-Runs über Dateien außerhalb des aktuellen Moduls, kein "ich habe nebenbei noch X verbessert".
- **Destruktive Operationen nur mit Bestätigung.** Git reset, Force-Push, File-Löschungen außerhalb des Modul-Scopes, DB-Wipes.
- **Wenn ein Test/Lint fehlschlägt: Ursache suchen, nicht den Test anpassen.**

### Was du NICHT tun sollst
- Bibliotheken austauschen (kein Redux statt Zustand etc.) ohne explizite Freigabe.
- Ordnerstruktur ändern.
- Abhängigkeiten hinzufügen, die nicht im Tech-Stack stehen, ohne Rückfrage.
- DB-Schema ändern, das in einem anderen Modul definiert wurde.
- Vorgriffe auf spätere Module. Wenn ein Feature noch nicht spezifiziert ist: Platzhalter.
- `any`-Types ohne begründeten Kommentar.
- Direkt auf `main` committen oder pushen. Immer auf dem aktuellen Feature-Branch arbeiten.

## Git-Workflow

- **Feature-Branches pro Modul.** Namensschema: `feature/modul-NN-kurzname`, z.B. `feature/modul-03-dateimanager`, `feature/modul-04-ausgabenverwaltung`.
- Alle Phasen-Commits (A/B/C/D/E) und Fix-Commits eines Moduls landen auf dem Feature-Branch, nicht auf `main`.
- Nach Abschluss der letzten Phase wird ein Pull Request auf GitHub erstellt und gemergt. Danach wird der Feature-Branch gelöscht.
- Claude Code committet und pusht NIEMALS auf `main` direkt. Bei Unsicherheit über den aktiven Branch: `git branch --show-current` prüfen und nachfragen.
- Historische Ausnahme: Modul 02 wurde direkt auf `main` entwickelt. Ab Modul 03 gilt der Feature-Branch-Workflow konsequent.

## Architekturprinzipien

- **Offline-First**: Alle Kernfeatures funktionieren ohne Internet. KI-Buttons bei fehlender Verbindung deaktivieren.
- **Datenportabilität**: Kein Vendor Lock-in. Alles als CSV/JSON exportierbar.
- **Sicherheit by Default**: Kein Löschen ohne Bestätigung. 30-Tage-Papierkorb. API-Keys im OS-Keychain, niemals in DB oder Config.
- **Progressive Enhancement**: Jedes Modul funktioniert eigenständig. Abhängigkeiten sind optional.
- **Erweiterbarkeit**: Spätere API-Integrationen (Versand, Plattformen) müssen möglich sein ohne Umbau.

## Repo-Struktur

```
polygrid-studio/
├── CLAUDE.md                    # Diese Datei
├── docs/
│   ├── PROJEKTREGELN.md         # Übergreifende Regeln (Langfassung)
│   ├── DESIGN_SYSTEM.md         # Vollständiges Design-System
│   ├── DATABASE_SCHEMA.md       # Konsolidiertes DB-Schema
│   └── modules/
│       ├── MODUL_01_FOUNDATION.md
│       ├── MODUL_02_PRODUKTVERWALTUNG.md
│       └── MODUL_03_DATEIMANAGER.md
├── src/
│   ├── components/{ui,layout,shared}/
│   ├── features/{dashboard,products,expenses,orders,listings,templates,files,tasks,analytics,ai-assistant,settings}/
│   ├── services/{database,ai,filesystem,export}/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   └── styles/globals.css
├── src-tauri/
└── drizzle/
```

## Entwicklungs-Commands

```bash
# Dev-Server starten
npm run tauri dev

# Build
npm run tauri build

# Lint + Format (muss ohne Fehler durchlaufen)
npm run lint
npm run format

# TypeScript-Check
npm run typecheck

# Drizzle: Migrations generieren
npx drizzle-kit generate

# Drizzle: Migrations anwenden (geschieht automatisch beim App-Start)
npx drizzle-kit push

# Aktuellen Branch prüfen
git branch --show-current

# Feature-Branch für neues Modul anlegen (Beispiel)
git checkout main
git pull
git checkout -b feature/modul-XX-kurzname
git push -u origin feature/modul-XX-kurzname
```

## Session-Ablauf

1. Diese `CLAUDE.md` lesen (immer)
2. Aktiven Branch prüfen (`git branch --show-current`) und auf dem Feature-Branch bleiben
3. Aktuelle Modul-Spec aus `docs/modules/` lesen
4. Implementieren – nur Scope des aktiven Moduls
5. Lint + TypeScript-Check müssen grün sein
6. Manuell testen
7. Commit mit aussagekräftiger Message auf dem Feature-Branch

## Wichtige Referenzen

- **Übergreifende Regeln**: `docs/PROJEKTREGELN.md`
- **Design-System**: `docs/DESIGN_SYSTEM.md` (verbindlich, bei Widersprüchen mit Modul-Spec gewinnt Design-System für Styling)
- **DB-Schema**: `docs/DATABASE_SCHEMA.md` (Überblick über alle Tabellen)
- **Aktive Modul-Spec**: Siehe "Aktueller Stand" oben

Bei Widersprüchen zwischen Dokumenten:
- Modul-Spec gewinnt für Modulscope
- PROJEKTREGELN gewinnt für Übergreifendes
- DESIGN_SYSTEM gewinnt für Styling
