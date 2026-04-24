# Modul 01: Foundation

PolyGrid Studio Business OS | Anforderungsdokument | Version 1.1 | April 2026

> **HINWEIS**: Diese Version 1.1 ersetzt Abschnitt 4 (Theme-System) durch ein vollständiges Design-System. Alle anderen Abschnitte bleiben unverändert gegenüber Version 1.0.

## 1. Scope und Ziel

Dieses Modul erstellt das technische Fundament der Anwendung. Nach Abschluss steht eine lauffähige Tauri-App mit Navigation, Theme-System, Datenbank und einer leeren aber navigierbaren Modulstruktur. Kein Modul enthält Business-Logik. Alle Module zeigen Platzhalter-Seiten.

### 1.1 Lieferergebnisse

- Tauri 2 Projekt mit React 18, TypeScript (strict), Vite
- shadcn/ui und Tailwind CSS konfiguriert
- App Shell: Sidebar (240px, collapsible auf 64px) + Main Content Area + optionales Detail Panel (400px)
- TanStack Router mit allen Routen als Platzhalter-Seiten
- Vollständiges Design-System (siehe Abschnitt 4): kühl-technische Hellmodus-Palette, eigenständig gestalteter Dark Mode mit Elevation-System, anpassbare Akzentfarbe
- Hell-/Dunkel-Modus (System-Default, manuell umschaltbar)
- Command Palette (Cmd/Ctrl+K) mit Navigation und Schnellaktionen
- SQLite-Datenbank via Tauri SQL Plugin + Drizzle ORM mit initialem Schema
- Zustand Store für UI-State (Sidebar, Theme, Akzentfarbe, aktives Modul)
- Globale Shortcuts (siehe Abschnitt 6)
- Feature-basierte Ordnerstruktur (alle Ordner angelegt, mit Index-Dateien)

### 1.2 Explizit NICHT im Scope

- Keine Business-Logik (Produkte, Ausgaben, Listings etc.)
- Keine KI-Integration
- Keine OneDrive-Integration
- Keine Daten-CRUD-Operationen (nur Schema anlegen)
- Keine vollständige Settings-Seite (nur Theme-Toggle und Akzentfarben-Auswahl)

## 2. Projektinitialisierung

### 2.1 Projekt erstellen

```bash
npm create tauri-app@latest polygrid-studio -- --template react-ts
```

### 2.2 Abhängigkeiten installieren

**Frontend:**
`@tanstack/react-router`, `@tanstack/react-table`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `cmdk` (für Command Palette), `clsx`, `tailwind-merge`

**Fonts (lokal, kein CDN):**
`@fontsource/inter`, `@fontsource/jetbrains-mono`

**shadcn/ui Setup:**
shadcn/ui initialisieren (`npx shadcn@latest init`). Basis-Komponenten installieren: `button`, `input`, `dialog`, `dropdown-menu`, `tooltip`, `badge`, `separator`, `scroll-area`, `sheet`.

**Datenbank:**
`drizzle-orm`, `drizzle-kit`, `@tauri-apps/plugin-sql`

**Dev-Tools:**
`eslint`, `prettier`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `tailwindcss`, `autoprefixer`, `postcss`

### 2.3 Ordnerstruktur

Die folgende Struktur muss exakt angelegt werden. Jeder Ordner erhält eine `index.ts` mit benannten Exporten (auch wenn initial leer).

```
polygrid-studio/
  src/
    main.tsx
    App.tsx
    components/
      ui/                    # shadcn/ui Komponenten
      layout/
        AppShell.tsx         # Hauptlayout
        Sidebar.tsx          # Navigation
        CommandPalette.tsx   # Cmd+K Dialog
        DetailPanel.tsx      # Rechtes Panel (Platzhalter)
      shared/                # Wiederverwendbare Komponenten
    features/
      dashboard/             # Platzhalter-Seite
      products/              # Platzhalter-Seite
      expenses/              # Platzhalter-Seite
      orders/                # Platzhalter-Seite
      listings/              # Platzhalter-Seite
      templates/             # Platzhalter-Seite
      files/                 # Platzhalter-Seite
      tasks/                 # Platzhalter-Seite
      analytics/             # Platzhalter-Seite
      ai-assistant/          # Platzhalter-Seite
      settings/              # Theme + Akzentfarben-Toggle
    services/
      database/
        schema.ts            # Drizzle Schema (alle Tabellen)
        migrations/          # SQL Migrations
        index.ts             # DB-Initialisierung
      ai/                    # Leer (späteres Modul)
      filesystem/            # Leer (späteres Modul)
      export/                # Leer (späteres Modul)
    hooks/
      useTheme.ts            # Hell/Dunkel + Akzentfarbe
      useShortcuts.ts
    stores/
      uiStore.ts             # Sidebar, Theme, Akzent, aktives Modul
    types/
      index.ts               # Globale Typen
    utils/
      cn.ts                  # clsx + tailwind-merge Helper
      colors.ts              # HSL-Helpers für Akzent-Berechnung
    styles/
      globals.css            # Tailwind + Custom Properties (Hell + Dark)
  src-tauri/
    tauri.conf.json
    src/main.rs
  drizzle/
  docs/
    DESIGN_SYSTEM.md         # Verbindliches Design-System
  tests/
```

## 3. App Shell

### 3.1 Layout

Die App Shell besteht aus drei Bereichen: Sidebar (links, 240px, collapsible auf 64px), Main Content (Mitte, flexibel, max-width 1200px), Detail Panel (rechts, 400px, optional, initial nicht sichtbar). Das Layout nutzt CSS Grid oder Flexbox. Die Sidebar hat eine feste Breite und ist per Shortcut (Cmd/Ctrl+B) oder Button ein-/ausklappbar.

### 3.2 Sidebar

**Oberer Bereich (Hauptnavigation):**

| Menüpunkt | Icon (Lucide) | Route |
|---|---|---|
| Dashboard | LayoutDashboard | / |
| Produkte | Package | /products |
| Ausgaben | Receipt | /expenses |
| Aufträge | ShoppingCart | /orders |
| Listings | FileText | /listings |
| Vorlagen | FileStack | /templates |
| Dateien | FolderOpen | /files |
| Aufgaben | CheckSquare | /tasks |
| Analysen | BarChart3 | /analytics |

**Unterer Bereich (fixiert am unteren Rand):**

| Menüpunkt | Icon (Lucide) | Route/Aktion |
|---|---|---|
| KI-Assistent | Sparkles | /ai |
| Einstellungen | Settings | /settings |
| Sidebar toggle | PanelLeftClose | Toggle Sidebar |

**Verhalten:**

Aktiver Menüpunkt erhält gemäß Design-System (Abschnitt 7.1) den Hintergrund `--accent-primary-subtle` plus einen 3px linken Strich in `--accent-primary`. Hover zeigt `--bg-hover`. Im eingeklappten Zustand nur Icons sichtbar (64px Breite). Smooth Transition beim Ein-/Ausklappen (200ms ease). Badge-Counter sind vorbereitet (als optionaler prop), werden aber erst in späteren Modulen befüllt.

## 4. Design-System

> **WICHTIG**: Dieser Abschnitt wurde gegenüber Version 1.0 vollständig neu gestaltet. Die vollständige Spezifikation liegt im separaten Dokument `docs/DESIGN_SYSTEM.md` (Markdown). Dieses Dokument muss zwingend zusammen mit der Foundation-Spec gelesen werden. Bei Widersprüchen gilt das Design-System-Dokument.

### 4.1 Designphilosophie

PolyGrid Studio orientiert sich visuell an SAP Sales Cloud v2 und Salesforce Trailhead: ruhige, neutrale Grundfläche mit gezielter Farbsetzung für Aktionen, aktive Zustände und Status. Maximal aufgeräumt, niemals bunt.

- Kühl & technisch: Off-White mit leichtem Blaustich im Hellmodus, tiefes Marineblau-Anthrazit im Dark Mode
- Hierarchie durch Erhebung, nicht durch Sättigung
- Eine einzige anpassbare Akzentfarbe als Marken-Anker (Default: SAP-Blau #0070F2)
- Status-Farben sind semantisch (rot = Verlust, grün = Erfolg) und werden nie vom Nutzer überschrieben
- Hellmodus und Dark Mode sind eigenständig gestaltet, nicht invertiert
- Hover macht im Hellmodus dunkler, im Dark Mode heller

### 4.2 Farbpalette Hellmodus

Alle Farben werden als CSS Custom Properties in `globals.css` definiert.

**Hintergründe:**

| Token | Hex | Verwendung |
|---|---|---|
| `--bg-primary` | #F5F7FA | Haupthintergrund (Main Content) |
| `--bg-secondary` | #EDF1F6 | Sidebar, Panels |
| `--bg-elevated` | #FFFFFF | Karten, Modals, Detail-Panel |
| `--bg-hover` | #E4EAF2 | Hover-States |
| `--bg-active` | #DCE4EE | Aktive Sidebar-Items (ohne Akzent) |

**Text:**

| Token | Hex | Verwendung |
|---|---|---|
| `--text-primary` | #1A2332 | Haupttext (kühles Anthrazit) |
| `--text-secondary` | #5A6B7F | Labels, sekundärer Text |
| `--text-muted` | #8A99AC | Platzhalter |
| `--text-disabled` | #B8C2CF | Deaktivierte Elemente |

**Borders:**

| Token | Hex | Verwendung |
|---|---|---|
| `--border-subtle` | #E4EAF2 | Tabellen-Zeilentrenner |
| `--border-default` | #D8DEE7 | Standard-Rahmen, Inputs |
| `--border-strong` | #B8C2CF | Inputs im Fokus |

**Akzentfarbe (anpassbar, Default SAP-Blau):**

| Token | Hex | Verwendung |
|---|---|---|
| `--accent-primary` | #0070F2 | Primäre Aktionen, aktive Zustände |
| `--accent-primary-hover` | #0058C2 | Hover auf primären Buttons |
| `--accent-primary-subtle` | #E6F0FE | Hintergrund für aktive Tabs/Items |
| `--accent-primary-border` | #7FB4FF | Rahmen für Akzent-Container |

**Status-Farben (fix, nicht anpassbar):**

| Token | Hex | Subtle | Verwendung |
|---|---|---|---|
| `--accent-success` | #16A34A | #DCFCE7 | Gute Marge, Erfolg |
| `--accent-warning` | #D97706 | #FEF3C7 | Kritische Marge, Warnungen |
| `--accent-danger` | #DC2626 | #FEE2E2 | Verlust, Löschen, Fehler |
| `--accent-info` | #0891B2 | #CFFAFE | KI-Hinweise, Info |

### 4.3 Farbpalette Dark Mode

Der Dark Mode arbeitet mit einem Elevation-System: Je höher die Ebene, desto heller. Karten 'schweben' über dem Hintergrund. Dies ersetzt die simple Hell/Dunkel-Hierarchie des Light Modes.

**Hintergründe (Elevation-System):**

| Token | Hex | Verwendung |
|---|---|---|
| `--bg-base` | #0B0F1A | Tiefste Ebene |
| `--bg-primary` | #11172A | Standard-Arbeitsfläche |
| `--bg-secondary` | #161D33 | Sidebar |
| `--bg-elevated-1` | #1B233D | Karten, Tabellen-Header |
| `--bg-elevated-2` | #222B47 | Detail-Panel, Popovers |
| `--bg-elevated-3` | #2A3454 | Modals (höchste Ebene) |
| `--bg-hover` | #2D3756 | Hover über bg-elevated-1 |
| `--bg-active` | #36426A | Aktiver Sidebar-Eintrag |

**Text (WCAG-konform, kein reines Weiß):**

| Token | Hex | Kontrast / Verwendung |
|---|---|---|
| `--text-primary` | #E6EAF2 | 14.2:1 Haupttext |
| `--text-secondary` | #A8B3C7 | 7.8:1 Labels |
| `--text-muted` | #6E7A92 | 4.6:1 Platzhalter |
| `--text-disabled` | #4A5468 | 2.8:1 Deaktiviert |

**Akzentfarbe Dark Mode (entsättigt, heller):**

| Token | Hex | Verwendung |
|---|---|---|
| `--accent-primary` | #5B9DFF | Primäre Aktionen |
| `--accent-primary-hover` | #7AB1FF | Hover (heller, nicht dunkler!) |
| `--accent-primary-subtle` | #1A2A4A | Aktive Tabs/Items |
| `--accent-primary-border` | #2D4A7C | Akzent-Container |

**Status-Farben Dark Mode (entsättigt):**

| Token | Hex | Subtle | Verwendung |
|---|---|---|---|
| `--accent-success` | #4ADE80 | #0F2A1B | Erfolg |
| `--accent-warning` | #FBBF24 | #2A1F0A | Warnung |
| `--accent-danger` | #F87171 | #2A1212 | Fehler |
| `--accent-info` | #22D3EE | #0E2A30 | Info |

### 4.4 Anpassbare Akzentfarbe

Nur die vier `--accent-primary-*` Tokens werden vom Nutzer geändert. Alles andere bleibt fix. Die Auswahl erfolgt in den Settings (in dieser Foundation als minimaler Toggle vorbereitet, vollständige UI in Modul 11).

**Vordefinierte Presets:**

| Name | Hellmodus | Dark Mode |
|---|---|---|
| SAP-Blau (Default) | #0070F2 | #5B9DFF |
| Indigo | #4F46E5 | #818CF8 |
| Petrol | #0D9488 | #2DD4BF |
| Orange | #EA580C | #FB923C |
| Violett | #7C3AED | #A78BFA |
| Graphit | #475569 | #94A3B8 |

Pro Preset werden Hover- und Subtle-Varianten programmatisch berechnet (Helper in `src/utils/colors.ts`):

- Hover (Hell): ~20% dunkler in HSL
- Hover (Dark): ~15% heller in HSL
- Subtle (Hell): Sättigung -20%, Helligkeit auf ~95%
- Subtle (Dark): Sättigung -30%, Helligkeit auf ~15%

### 4.5 Typografie

| Element | Font | Größe | Gewicht | Tailwind |
|---|---|---|---|---|
| Display | Inter | 24px | 600 | `text-2xl font-semibold` |
| H1 | Inter | 20px | 600 | `text-xl font-semibold` |
| H2 | Inter | 16px | 600 | `text-base font-semibold` |
| Body | Inter | 14px | 400 | `text-sm` |
| Small | Inter | 12px | 500 | `text-xs font-medium` |
| Mono | JetBrains Mono | 13px | 400 | `font-mono text-[13px]` |

Line-Heights: Display/H1/H2 = 1.3, Body = 1.5, Small = 1.4, Mono = 1.5.

Font-Loading: Inter und JetBrains Mono via `@fontsource` Pakete (npm), nicht via Google Fonts CDN (Datenschutz, Offline-First).

### 4.6 Spacing

- Basis-Unit: 4px. Alle Abstände als Vielfache
- Standard-Padding Karten: 16px (`p-4`)
- Standard-Gap: 8px (`gap-2`)
- Tabellenzeilen: 44px Höhe
- Content-Max-Width: 1200px (`max-w-7xl`)
- Border-Radius: 8px Standard (`rounded-lg`), 6px für kleine Elemente, 12px für Modals

### 4.7 Implementierung

Die vollständige `globals.css` und `tailwind.config.js` sind in `docs/DESIGN_SYSTEM.md` Abschnitt 8 definiert und müssen 1:1 übernommen werden.

**Anforderungen an `useTheme` Hook (`src/hooks/useTheme.ts`):**

- Beim Start die Theme-Wahl aus `app_settings` lesen (Key: `theme` mit Werten `light`/`dark`/`system`)
- Bei `system` den OS-Modus via `matchMedia('(prefers-color-scheme: dark)')` ermitteln
- Das Ergebnis als `data-theme` Attribut auf `<html>` setzen
- Bei OS-Änderung (System-Modus) automatisch reagieren
- Die Akzentfarbe analog aus `app_settings` (Key: `accent_color`) lesen und die vier Akzent-Properties setzen
- Smooth Transition zwischen Themes (200ms ease)

## 5. Command Palette

Implementierung mit `cmdk` (pacocoursey/cmdk). Öffnet sich mit Cmd/Ctrl+K als zentriertes Dialog-Overlay. Durchsuchbare Liste mit Kategorien.

**Initiale Einträge (Foundation):**

- Navigation: Zu Dashboard, Zu Produkte, Zu Ausgaben, Zu Aufträge, Zu Listings, Zu Vorlagen, Zu Dateien, Zu Aufgaben, Zu Analysen, Zu KI-Assistent, Zu Einstellungen
- System: Theme wechseln (Hell/Dunkel/System), Akzentfarbe wechseln, Sidebar ein-/ausklappen

**Spätere Module ergänzen Einträge:**

- Aktionen: Neues Produkt, Neue Ausgabe, Neuer Auftrag, Neues Listing
- KI: KI fragen, Listing generieren, Marge analysieren

**Wichtig**: Die Command Palette muss erweiterbar sein. Jedes Feature-Modul soll eigene Commands registrieren können, ohne die Command Palette selbst zu ändern. Dafür einen Zustand Store oder Registry-Pattern verwenden.

## 6. Globale Shortcuts

| Shortcut | Aktion |
|---|---|
| Cmd/Ctrl + K | Command Palette öffnen |
| Cmd/Ctrl + B | Sidebar ein-/ausklappen |
| Cmd/Ctrl + / | KI-Assistent öffnen/schließen (Platzhalter) |
| Cmd/Ctrl + 1–9 | Zu Modul 1–9 navigieren |
| Escape | Modal/Panel schließen |

Hinweis: Shortcuts für Cmd/Ctrl+N (Neues Element), Cmd/Ctrl+S (Speichern), Cmd/Ctrl+Z/Shift+Z (Undo/Redo) werden von den jeweiligen Modulen implementiert. Der `useShortcuts` Hook soll eine zentrale Registrierung ermöglichen.

## 7. Datenbank-Setup

### 7.1 Konfiguration

- SQLite via `@tauri-apps/plugin-sql`
- Datenbankdatei: `polygrid.db` im Tauri App-Datenverzeichnis (nicht im OneDrive-Ordner)
- Drizzle ORM für Schema-Definition und Queries
- Migrations via drizzle-kit

### 7.2 Schema (initial)

Das gesamte Datenbankschema wird in diesem Modul angelegt, auch wenn die Tabellen erst in späteren Modulen befüllt werden. Das stellt sicher, dass FK-Beziehungen von Anfang an korrekt sind.

**Tabellen (alle mit `id` UUID, `created_at`, `updated_at`):**

- `products`: Vollständiges Schema gemäß Modul 02
- `expenses`: Gemäß Modul 04
- `orders`: Gemäß Modul 08
- `listings`: Gemäß Modul 05
- `templates`: Gemäß Modul 07
- `tasks`: Gemäß Modul 09
- `file_links`: Gemäß Modul 03
- `ai_jobs`: Gemäß Modul 06
- `kpi_records`: Gemäß Modul 10
- `app_settings`: `key` (TEXT PK), `value` (TEXT JSON), `updated_at`

> Vollständige Felddefinitionen siehe `docs/DATABASE_SCHEMA.md`.

**Wichtige Settings-Keys, die bereits in Foundation gelesen/geschrieben werden:**

- `theme`: 'light' | 'dark' | 'system' (Default: 'system')
- `accent_color`: 'sap_blue' | 'indigo' | 'petrol' | 'orange' | 'violet' | 'graphite' | custom hex (Default: 'sap_blue')
- `sidebar_collapsed`: boolean (Default: false)

**Indizes:**

- `products`: status, category, created_at
- `expenses`: date, category, vendor
- `orders`: status, platform, order_date
- `listings`: platform, status, product_id
- `tasks`: status, priority, due_date

### 7.3 Initialisierung

Beim App-Start: Prüfen ob Datenbank existiert. Falls nicht, erstellen und Migrations ausführen. Falls ja, prüfen ob Migrations ausstehen und ausführen. Fehler bei DB-Init muss dem Nutzer angezeigt werden (kein stilles Scheitern).

## 8. Platzhalter-Seiten

Jedes Feature-Modul (dashboard, products, expenses, orders, listings, templates, files, tasks, analytics, ai-assistant, settings) bekommt eine eigene Seite mit: Modulname als H1, Kurzbeschreibung was hier später kommt, und ein Icon aus Lucide. Die Settings-Seite hat zusätzlich einen funktionierenden Theme-Toggle (Hell/Dunkel/System) sowie eine Akzentfarben-Auswahl (6 Presets als farbige Buttons). Alle Seiten werden über den TanStack Router erreichbar gemacht.

## 9. Akzeptanzkriterien

Das Modul gilt als abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

- `tauri dev` startet die App ohne Fehler auf macOS
- Sidebar zeigt alle Menüpunkte und navigiert korrekt
- Sidebar lässt sich ein-/ausklappen (Button und Shortcut)
- Alle 11 Routen sind erreichbar und zeigen Platzhalter-Seiten
- Command Palette öffnet sich mit Cmd+K und ermöglicht Navigation
- Theme-Toggle funktioniert (Hell/Dunkel/System) und persistiert in `app_settings`
- Alle CSS Custom Properties aus dem Design-System sind in `globals.css` definiert
- Hellmodus und Dark Mode haben eigenständige Werte (keine algorithmische Inversion)
- Theme-Wechsel erfolgt smooth (200ms Transition)
- Sidebar-Aktiv-State nutzt `--accent-primary-subtle` Hintergrund + 3px linken Strich in `--accent-primary`
- Im Dark Mode wirken Karten als 'schwebend' durch Elevation, nicht durch Border
- Hover wird im Hellmodus dunkler, im Dark Mode heller
- Akzentfarbe lässt sich in Settings über 6 Presets ändern und persistiert
- Akzentfarben-Wechsel aktualisiert die UI sofort ohne Reload
- SQLite-Datenbank wird beim Start erstellt mit allen Tabellen
- Globale Shortcuts (Cmd+1–9, Cmd+B, Cmd+K, Escape) funktionieren
- TypeScript kompiliert ohne Fehler im strict mode
- ESLint und Prettier laufen ohne Fehler
- Inter und JetBrains Mono werden lokal geladen (kein CDN-Aufruf)
- Die App ist visuell sauber: Farben stimmen, Fonts geladen, Spacing konsistent

## 10. Bekannte Abhängigkeiten für spätere Module

Die folgenden Interfaces/Hooks müssen in der Foundation so gebaut werden, dass spätere Module sie erweitern können, ohne die Foundation zu ändern:

- **Command Registry**: Ein Zustand Store oder Modul, bei dem Features Commands für die Command Palette registrieren können
- **Shortcut Registry**: Ähnlich wie Command Registry, aber für Tastaturkürzel
- **Sidebar Badge Counter**: Die Sidebar-Navigation akzeptiert optionale Badge-Counts (z.B. offene Aufträge), die spätere Module setzen können
- **Detail Panel**: Das rechte Panel ist vorbereitet aber initial nicht sichtbar. Spätere Module können es öffnen und Inhalt setzen
- **DB Service**: Ein zentraler Service, der die Drizzle-Instanz bereitstellt. Module importieren diesen Service statt direkt auf SQLite zuzugreifen
- **Theme/Akzent-Hook**: Module können die aktuelle Akzentfarbe lesen, falls sie spezielle Visualisierungen brauchen (z.B. Charts in Modul 10)
