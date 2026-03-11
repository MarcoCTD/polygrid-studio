# PolyGrid Studio Business OS

## Projektübersicht
Desktop-App (macOS + Windows) für ein kleines 3D-Druck-Gewerbe. Verwaltet Produkte, Ausgaben, Aufträge, Listings, Dateien, Aufgaben und Vorlagen. KI-gestützte Textgenerierung für Plattform-Listings. OneDrive-Ordner als Dateiablage. SQLite als lokale Datenbank.

## Tech-Stack (verbindlich)
- **Runtime:** Tauri 2.x (Rust Backend)
- **Frontend:** React 18+ mit TypeScript (strict mode)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** Zustand
- **Tabellen:** TanStack Table v8
- **Formulare:** React Hook Form + Zod
- **Routing:** TanStack Router
- **Datenbank:** SQLite via Tauri SQL Plugin + Drizzle ORM
- **Build:** Vite
- **Icons:** Lucide React

## Projektstruktur
```
src/
  main.tsx
  App.tsx
  components/
    ui/                    # shadcn/ui Komponenten
    layout/                # Shell, Sidebar, CommandPalette
    shared/                # Wiederverwendbare Business-Komponenten
  features/                # Feature-Module (jedes Modul hat eigene components/, hooks/, utils/)
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
    ai/
      providers/           # ClaudeProvider, OpenAIProvider, OllamaProvider
      agents/              # ListingAssistant, ExpenseAssistant, ProductAnalyst, FileOrganizer, OperationsCOO
      ai-service.ts        # Generische Abstraktionsschicht
    database/
      schema.ts            # Drizzle Schema (alle Entitäten)
      migrations/
    filesystem/            # OneDrive-Integration über Tauri Commands
    export/                # CSV/JSON Export
  hooks/                   # Globale Custom Hooks
  stores/                  # Zustand Stores
  types/                   # Globale TypeScript-Typen
  utils/
  lib/                     # shadcn/ui utils (cn function etc.)
  i18n/                    # Sprachdateien (de.json, en.json)
src-tauri/
  src/
    main.rs
    commands/              # Tauri Commands (Dateisystem, DB)
```

## Coding-Regeln
- Alle Strings im UI über i18n-Keys (de.json), niemals hardcoded
- Alle Datenmodelle als Zod-Schemas definieren, daraus TypeScript-Typen ableiten
- Kein `any` ohne Kommentar warum
- Feature-Module sind eigenständig: eigene Komponenten, Hooks, Utils
- Fehlerbehandlung: try/catch für jede Datei-OP und KI-Anfrage
- Alle IDs sind UUIDs (crypto.randomUUID())
- Soft-Delete: deleted_at Timestamp statt echtem Löschen
- Datumsfelder als ISO-8601 Strings in SQLite

## Design-System
- **Stil:** Industrial-Minimal, technisch, ruhig. Referenz: Linear, Raycast, Vercel Dashboard
- **Theme:** Hell und Dunkel (System-Follow als Default)
- **Font:** Inter (UI), JetBrains Mono (Code/Mono)
- **Basis-Unit:** 4px. Alle Abstände in Vielfachen
- **Sidebar:** 240px, collapsible auf 64px
- **Border-Radius:** 8px für Buttons und Karten
- **Keine bunten Farben:** Neutral/Zinc-Palette, Accent nur für Aktionen

### Farben
- bg-primary: hsl(0 0% 98%) / hsl(240 20% 4%)
- bg-secondary: hsl(240 5% 96%) / hsl(240 15% 7%)
- bg-elevated: hsl(0 0% 100%) / hsl(240 12% 10%)
- accent-primary: hsl(217 91% 60%) / hsl(217 91% 65%)
- accent-success: hsl(142 76% 36%)
- accent-warning: hsl(38 92% 50%)
- accent-danger: hsl(0 84% 60%)

## Datenbank-Entitäten
Alle Tabellen haben: id (TEXT UUID PK), created_at (TEXT ISO), updated_at (TEXT ISO), deleted_at (TEXT ISO nullable)

### products
name TEXT NOT NULL, short_name TEXT, category TEXT NOT NULL, subcategory TEXT, description_internal TEXT, collection TEXT, status TEXT NOT NULL DEFAULT 'idea' (idea|review|print_ready|test_print|launch_ready|online|paused|discontinued), material_type TEXT NOT NULL DEFAULT 'PLA', color_variants TEXT (JSON array), print_time_minutes INTEGER, material_grams REAL, electricity_cost REAL, packaging_cost REAL, shipping_class TEXT, target_price REAL, min_price REAL, estimated_margin REAL, upsell_notes TEXT, license_source TEXT, license_type TEXT (own|cc_by|cc_by_sa|cc_by_nc|commercial|unclear), license_url TEXT, license_risk TEXT (safe|review_needed|risky), platforms TEXT (JSON array), notes TEXT

### expenses
date TEXT NOT NULL, amount_gross REAL NOT NULL, amount_net REAL, tax_amount REAL, vendor TEXT NOT NULL, category TEXT NOT NULL, subcategory TEXT, payment_method TEXT, purpose TEXT, product_id TEXT REFERENCES products(id), receipt_attached BOOLEAN DEFAULT 0, receipt_file_path TEXT, tax_relevant BOOLEAN DEFAULT 1, recurring BOOLEAN DEFAULT 0, notes TEXT

### orders
external_order_id TEXT, customer_name TEXT, platform TEXT NOT NULL, product_id TEXT REFERENCES products(id), variant TEXT, quantity INTEGER DEFAULT 1, sale_price REAL NOT NULL, shipping_cost REAL, material_cost REAL, platform_fee REAL, status TEXT NOT NULL DEFAULT 'ordered' (inquiry|quoted|ordered|paid|in_production|ready|shipped|completed|issue|cancelled), payment_status TEXT NOT NULL DEFAULT 'pending' (pending|paid|refunded|disputed), shipping_status TEXT (not_shipped|shipped|delivered|returned), tracking_number TEXT, order_date TEXT NOT NULL, notes TEXT

### listings
product_id TEXT NOT NULL REFERENCES products(id), platform TEXT NOT NULL, title TEXT NOT NULL, short_description TEXT, long_description TEXT, bullet_points TEXT (JSON), tags TEXT (JSON), price REAL NOT NULL, variants TEXT (JSON), shipping_info TEXT, processing_time_days INTEGER, status TEXT DEFAULT 'draft' (draft|online|paused|archived), language TEXT DEFAULT 'de', seo_notes TEXT, platform_specific_notes TEXT

### templates
name TEXT NOT NULL, category TEXT NOT NULL (impressum|widerruf|versand|faq|antwort|kundenservice|beilage|reklamation|sonstiges), content TEXT NOT NULL, platforms TEXT (JSON), variables TEXT (JSON), version INTEGER DEFAULT 1, is_legal BOOLEAN DEFAULT 0, notes TEXT

### tasks
title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'medium' (low|medium|high|urgent), status TEXT DEFAULT 'todo' (todo|in_progress|done|cancelled), due_date TEXT, product_id TEXT REFERENCES products(id), order_id TEXT REFERENCES orders(id), listing_id TEXT REFERENCES listings(id), recurring_rule TEXT (JSON), completed_at TEXT

### file_links
entity_type TEXT NOT NULL (product|expense|order|listing|template), entity_id TEXT NOT NULL, file_type TEXT NOT NULL (stl|slicer|image|mockup|listing_text|packaging|manual|license|receipt|other), file_path TEXT NOT NULL, file_name TEXT NOT NULL, file_size_bytes INTEGER, notes TEXT

### ai_jobs
provider TEXT NOT NULL, model TEXT NOT NULL, agent TEXT NOT NULL, action TEXT NOT NULL, input_data TEXT (JSON), output_data TEXT (JSON), status TEXT DEFAULT 'pending' (pending|running|completed|failed|cancelled), tokens_used INTEGER, cost_estimate REAL, duration_ms INTEGER, error_message TEXT

## KI-Architektur
Generisches AIProvider Interface. Kein Provider direkt in Business-Logik.

```typescript
interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateText(prompt: string, options?: AIOptions): Promise<AIResponse>;
  generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;
}
```

Provider: ClaudeProvider, OpenAIProvider, OllamaProvider
Agenten: ListingAssistant, ExpenseAssistant, ProductAnalyst, FileOrganizer, OperationsCOO

### KI-Textgenerierung Stilregeln (WICHTIG)
- Präzise, clean, sachlich-hochwertig
- KEINE Emojis
- KEINE Gedankenstriche als Stilmittel
- KEINE KI-Floskeln: "Entdecke", "Erlebe", "Perfekt für", "Must-have", "Eyecatcher"
- KEINE Superlative ohne Substanz
- KEINE Fragen im Beschreibungstext
- BEVORZUGT: Konkrete Maße, Materialangaben, Funktionsbeschreibung

## Sidebar-Navigation
Dashboard (LayoutDashboard), Produkte (Package), Ausgaben (Receipt), Aufträge (ShoppingCart), Listings (FileText), Vorlagen (FileStack), Dateien (FolderOpen), Aufgaben (CheckSquare), Analysen (BarChart3) | Unten: KI-Assistent (Sparkles), Einstellungen (Settings)

## Margenrechner-Formel
Materialkosten = material_grams × (filament_price_per_kg / 1000)
Stromkosten = (print_time_minutes / 60) × (printer_wattage / 1000) × electricity_price_per_kwh
Gesamtkosten = Material + Strom + packaging_cost + shipping_cost + (sale_price × platform_fee_percent)
Marge = ((sale_price - Gesamtkosten) / sale_price) × 100

## Sicherheitsregeln
- Keine Datei-Löschung ohne Bestätigung, Soft-Delete bevorzugt
- API-Keys im OS-Keychain speichern, nie im Klartext
- KI-Aktionen werden in ai_jobs geloggt
- Rechtstexte im UI mit Warnhinweis markieren
- Produkte mit license_risk "risky" warnen wenn auf "online" gesetzt
- Steuermodul-Disclaimer: "Ersetzt keine steuerliche Buchführung"

## Shortcuts
Cmd+K: Command Palette, Cmd+N: Neues Element, Cmd+S: Speichern, Cmd+/: KI-Assistent, Cmd+B: Sidebar toggle, Cmd+1-9: Module navigieren, Escape: Modal schließen
