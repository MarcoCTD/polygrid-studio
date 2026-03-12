# PolyGrid Studio Business OS — Vollständige technische Spezifikation v2.0

> WICHTIG FÜR DIE ENTWICKLUNGS-KI: Dieses Dokument ist die verbindliche Spezifikation. Lies es vollständig bevor du mit der Implementierung beginnst. Die CLAUDE.md enthält die komprimierte Version für schnelle Referenz. Bei Widersprüchen gilt dieses Dokument.

---

# 1. Executive Summary

PolyGrid Studio Business OS ist eine plattformübergreifende
Desktop-Anwendung für macOS und Windows, die sämtliche operativen
Prozesse eines kleinen 3D-Druck-Unternehmens in einem einzigen,
minimalistischen Interface vereint. Die Anwendung setzt auf einen
lokalen OneDrive-Gewerbeordner als Datei-Backend und eine
SQLite-Datenbank für strukturierte Geschäftsdaten.

## 1.1 Geschäftlicher Kontext

Der Betreiber ist Einzelunternehmer in Deutschland (Kleingewerbe) mit
Fokus auf 3D-Druck-Produkte. Verkaufsplattformen sind Etsy, eBay und
eBay Kleinanzeigen. Der Versand erfolgt ausschließlich innerhalb
Deutschlands. Es werden sowohl frei verfügbare STL-Dateien als auch
eigene Designs verwendet. Der Drucker ist ein Elegoo Neptune 4 Pro
(PLA), ein zweiter Drucker mit Multicolor/Enclosure ist geplant.

## 1.2 Kernziele

-   Produktlaunches von der Idee bis zum Live-Listing in unter 30
    Minuten ermöglichen

-   Alle Betriebsdaten (Produkte, Ausgaben, Aufträge, Listings) zentral
    verwalten

-   KI-gestützte Textgenerierung für Listings, die nicht nach KI klingen

-   Transparente Margen- und Kostenanalyse pro Produkt

-   Dateichaos eliminieren durch strukturierte OneDrive-Integration

-   Wiederkehrende Aufgaben teilautomatisieren

-   Steuerliche Erfassung vereinfachen (ohne Buchhaltungssoftware zu
    ersetzen)

## 1.3 Was das System NICHT ist

-   Kein vollständiges ERP-System

-   Keine rechtskonforme Buchhaltungssoftware (Ersatz für DATEV, SevDesk
    etc.)

-   Kein E-Commerce-Shop oder Marktplatz-Connector mit API-Anbindung an
    Etsy/eBay (MVP)

-   Kein Multi-User-System (im MVP)

-   Kein CRM für Kundenmanagement

# 2. Architektur und technische Grundlagen

## 2.1 Architekturprinzipien

Die folgenden Prinzipien gelten als nicht verhandelbar und müssen in
jeder Architekturentscheidung berücksichtigt werden:

### 2.1.1 Offline-First

Die Anwendung muss vollständig ohne Internetverbindung funktionieren.
Alle Kern-Features (Produkte anlegen, Ausgaben erfassen, Dateien
verwalten) arbeiten lokal. KI-Features degradieren graceful: Ist keine
API erreichbar, werden KI-Buttons deaktiviert mit Tooltip-Hinweis.
Lokale KI via Ollama bleibt verfügbar, sofern eingerichtet.

### 2.1.2 Datenportabilität

Kein Vendor Lock-in. SQLite als Datenbank ermöglicht einfache Backups
und Migration. Alle Daten exportierbar als CSV und JSON. OneDrive bleibt
die primäre Dateiablage, die App ist nur die Oberfläche. Bei Wechsel des
Cloud-Anbieters muss lediglich der Basispfad geändert werden.

### 2.1.3 Sicherheit by Default

Keine Datei-Löschung ohne explizite Bestätigung. Soft-Delete mit
30-Tage-Papierkorb. KI-Aktionen werden geloggt. Sensible Daten
(API-Keys) werden verschlüsselt im OS-Keychain gespeichert. Keine
Kundendaten an Cloud-KI ohne explizite Freigabe.

### 2.1.4 Progressive Enhancement

Das System startet einfach und wird schrittweise komplexer. Jedes Modul
funktioniert eigenständig. Abhängigkeiten zwischen Modulen sind optional
(z.B. Produktverknüpfung in Ausgaben ist möglich, aber nicht Pflicht).

## 2.2 Tech-Stack im Detail

  ---
  **Schicht**          **Technologie**          **Begründung**
  --- --- ---
  Desktop-Runtime      Tauri 2.x (Rust)         Leichter als Electron, nativer
                                                Dateizugriff, Cross-Platform

  Frontend-Framework   React 18+ mit TypeScript Großes Ökosystem, Typing für
                                                komplexe Datenmodelle

  UI-Komponenten       shadcn/ui + Tailwind CSS Minimalistisch, anpassbar,
                                                keine Abhängigkeit von
                                                externem Theme

  State Management     Zustand                  Einfach, performant, kein
                                                Boilerplate

  Tabellen/Listen      TanStack Table v8        Virtualisierung, Sortierung,
                                                Filter out-of-the-box

  Formulare            React Hook Form + Zod    Validierung, Performance,
                                                TypeScript-Integration

  Routing              TanStack Router          Type-safe Routing, Nested
                                                Layouts

  Datenbank            SQLite via Tauri SQL     Offline, schnell, portabel
                       Plugin                   

  ORM / Query          Drizzle ORM              Type-safe, SQL-nah,
                                                leichtgewichtig

  Lokale KI            Ollama (optional)        Datensparsamkeit, keine
                                                API-Kosten

  Build-Tool           Vite                     Schnelle Dev-Experience mit
                                                Tauri
  ---

## 2.3 Ordnerstruktur des Projekts

Die folgende Struktur bildet die Grundlage für das Repository. Jede
Entwicklungs-KI muss sich daran halten:

```
polygrid-studio/

src/

main.tsx \# React Entry Point

App.tsx \# Root Component mit Router

components/

ui/ \# shadcn/ui Basis-Komponenten

layout/ \# Shell, Sidebar, CommandPalette

shared/ \# Wiederverwendbare Business-Komponenten

features/ \# Feature-basierte Module

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

services/ \# Business Logic Layer

ai/ \# KI-Abstraktionsschicht

providers/ \# Claude, OpenAI, Ollama

agents/ \# Listing, Expense, File Agents

database/ \# Drizzle Schema, Migrations

filesystem/ \# OneDrive-Integration

export/ \# CSV/JSON Export

hooks/ \# Custom React Hooks

stores/ \# Zustand Stores

types/ \# Globale TypeScript-Typen

utils/ \# Hilfsfunktionen

styles/ \# Globale Styles, Tailwind Config

src-tauri/ \# Rust Backend

src/

main.rs

commands/ \# Tauri Commands

filesystem.rs \# Dateioperationen

tauri.conf.json

drizzle/ \# DB Migrations

tests/

docs/
```

## 2.4 Datenmodell (Entity Relationship)

Das folgende Datenmodell bildet die Grundlage für die SQLite-Datenbank.
Alle Entitäten verwenden UUIDs als Primärschlüssel und besitzen
created_at sowie updated_at Timestamps.

### 2.4.1 Produkt (products)

  ---
  **Feld**               **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                     TEXT (UUID)   Ja            Primärschlüssel

  name                   TEXT          Ja            Vollständiger Produktname

  short_name             TEXT          Nein          Kurzname für Listen und Referenzen

  category               TEXT          Ja            Hauptkategorie (z.B. Deko,
                                                     Organizer, Gadget)

  subcategory            TEXT          Nein          Unterkategorie

  description_internal   TEXT          Nein          Interne Beschreibung und Notizen

  collection             TEXT          Nein          Stil oder Kollektion (z.B.
                                                     Minimal, Industrial)

  status                 TEXT          Ja            Enum: idea, review, print_ready,
                                                     test_print, launch_ready, online,
                                                     paused, discontinued

  material_type          TEXT          Ja            PLA, PETG, TPU etc.

  color_variants         TEXT (JSON)   Nein          Array von Farbvarianten als JSON

  print_time_minutes     INTEGER       Nein          Geschätzte Druckzeit in Minuten

  material_grams         REAL          Nein          Materialverbrauch in Gramm

  electricity_cost       REAL          Nein          Geschätzte Strom-/Maschinenkosten
                                                     in EUR

  packaging_cost         REAL          Nein          Verpackungskosten in EUR

  shipping_class         TEXT          Nein          Versandklasse (Brief, Paket,
                                                     Warensendung)

  target_price           REAL          Nein          Zielverkaufspreis in EUR

  min_price              REAL          Nein          Mindestverkaufspreis in EUR

  estimated_margin       REAL          Nein          Kalkulierte Marge in Prozent
                                                     (berechnet)

  upsell_notes           TEXT          Nein          Ideen für Upselling

  license_source         TEXT          Nein          Quelle der STL-Datei (Thingiverse,
                                                     Printables, Eigen)

  license_type           TEXT          Nein          Enum: own, cc_by, cc_by_sa,
                                                     cc_by_nc, commercial, unclear

  license_url            TEXT          Nein          Link zur Originaldatei oder Lizenz

  license_risk           TEXT          Nein          Enum: safe, review_needed, risky

  platforms              TEXT (JSON)   Nein          Array: etsy, ebay, kleinanzeigen

  notes                  TEXT          Nein          Freitextnotizen

  created_at             TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at             TEXT (ISO)    Ja            Letzte Änderung

  deleted_at             TEXT (ISO)    Nein          Soft-Delete Timestamp
  ---

### 2.4.2 Ausgabe (expenses)

  ---
  **Feld**            **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                  TEXT (UUID)   Ja            Primärschlüssel

  date                TEXT (ISO)    Ja            Datum der Ausgabe

  amount_gross        REAL          Ja            Bruttobetrag in EUR

  amount_net          REAL          Nein          Nettobetrag in EUR

  tax_amount          REAL          Nein          Steuerbetrag in EUR

  vendor              TEXT          Ja            Händler oder Verkäufer

  category            TEXT          Ja            Hauptkategorie

  subcategory         TEXT          Nein          Unterkategorie

  payment_method      TEXT          Nein          PayPal, Kreditkarte, Überweisung
                                                  etc.

  purpose             TEXT          Nein          Verwendungszweck

  product_id          TEXT (FK)     Nein          Referenz auf Produkt

  receipt_attached    BOOLEAN       Ja            Beleg vorhanden (Default: false)

  receipt_file_path   TEXT          Nein          Pfad zur Belegdatei in OneDrive

  tax_relevant        BOOLEAN       Ja            Steuerlich relevant (Default:
                                                  true)

  recurring           BOOLEAN       Ja            Wiederkehrend (Default: false)

  notes               TEXT          Nein          Freitext

  created_at          TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at          TEXT (ISO)    Ja            Letzte Änderung

  deleted_at          TEXT (ISO)    Nein          Soft-Delete Timestamp
  ---

### 2.4.3 Auftrag (orders)

  ---
  **Feld**            **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                  TEXT (UUID)   Ja            Primärschlüssel

  external_order_id   TEXT          Nein          Bestell-ID der Plattform

  customer_name       TEXT          Nein          Kundenname oder
                                                  Plattform-Username

  platform            TEXT          Ja            etsy, ebay, kleinanzeigen, direkt

  product_id          TEXT (FK)     Nein          Referenz auf Produkt

  variant             TEXT          Nein          Gewählte Variante (Farbe, Größe)

  quantity            INTEGER       Ja            Menge (Default: 1)

  sale_price          REAL          Ja            Verkaufspreis in EUR

  shipping_cost       REAL          Nein          Versandkosten in EUR

  material_cost       REAL          Nein          Materialkosten für diesen Auftrag

  platform_fee        REAL          Nein          Plattformgebühren in EUR

  status              TEXT          Ja            Enum: inquiry, quoted, ordered,
                                                  paid, in_production, ready,
                                                  shipped, completed, issue,
                                                  cancelled

  payment_status      TEXT          Ja            Enum: pending, paid, refunded,
                                                  disputed

  shipping_status     TEXT          Nein          Enum: not_shipped, shipped,
                                                  delivered, returned

  tracking_number     TEXT          Nein          Sendungsverfolgungsnummer

  order_date          TEXT (ISO)    Ja            Bestelldatum

  notes               TEXT          Nein          Freitext

  created_at          TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at          TEXT (ISO)    Ja            Letzte Änderung

  deleted_at          TEXT (ISO)    Nein          Soft-Delete Timestamp
  ---

### 2.4.4 Listing (listings)

  ---
  **Feld**                  **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                        TEXT (UUID)   Ja            Primärschlüssel

  product_id                TEXT (FK)     Ja            Referenz auf Produkt

  platform                  TEXT          Ja            etsy, ebay, kleinanzeigen

  title                     TEXT          Ja            Listing-Titel (max. 140 Zeichen
                                                        für Etsy)

  short_description         TEXT          Nein          Kurzbeschreibung (1--2 Sätze)

  long_description          TEXT          Nein          Ausführliche Beschreibung

  bullet_points             TEXT (JSON)   Nein          Array von Aufzählungspunkten

  tags                      TEXT (JSON)   Ja            Array von Tags/Suchbegriffen
                                                        (max. 13 bei Etsy)

  price                     REAL          Ja            Listenpreis in EUR

  variants                  TEXT (JSON)   Nein          Array von Varianten mit Name
                                                        und Preis

  shipping_info             TEXT          Nein          Versandinformationen als
                                                        Freitext

  processing_time_days      INTEGER       Nein          Bearbeitungszeit in Tagen

  status                    TEXT          Ja            Enum: draft, online, paused,
                                                        archived

  language                  TEXT          Ja            de oder en

  seo_notes                 TEXT          Nein          SEO-Hinweise und
                                                        Keyword-Recherche

  platform_specific_notes   TEXT          Nein          Plattformspezifische Hinweise

  created_at                TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at                TEXT (ISO)    Ja            Letzte Änderung

  deleted_at                TEXT (ISO)    Nein          Soft-Delete Timestamp
  ---

### 2.4.5 Vorlage (templates)

  ---
  **Feld**         **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id               TEXT (UUID)   Ja            Primärschlüssel

  name             TEXT          Ja            Name der Vorlage

  category         TEXT          Ja            Enum: impressum, widerruf,
                                               versand, faq, antwort,
                                               kundenservice, beilage,
                                               reklamation, sonstiges

  content          TEXT          Ja            Vorlagentext mit
                                               Platzhaltervariablen

  platforms        TEXT (JSON)   Nein          Für welche Plattformen geeignet

  variables        TEXT (JSON)   Nein          Liste der Platzhaltervariablen mit
                                               Beschreibung

  version          INTEGER       Ja            Versionsnummer (Default: 1)

  is_legal         BOOLEAN       Ja            Rechtstext ja/nein (für
                                               Warnhinweis)

  notes            TEXT          Nein          Interne Notizen

  created_at       TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at       TEXT (ISO)    Ja            Letzte Änderung
  ---

### 2.4.6 Aufgabe (tasks)

  ---
  **Feld**         **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id               TEXT (UUID)   Ja            Primärschlüssel

  title            TEXT          Ja            Aufgabentitel

  description      TEXT          Nein          Beschreibung

  priority         TEXT          Ja            Enum: low, medium, high, urgent

  status           TEXT          Ja            Enum: todo, in_progress, done,
                                               cancelled

  due_date         TEXT (ISO)    Nein          Fälligkeitsdatum

  product_id       TEXT (FK)     Nein          Referenz auf Produkt

  order_id         TEXT (FK)     Nein          Referenz auf Auftrag

  listing_id       TEXT (FK)     Nein          Referenz auf Listing

  recurring_rule   TEXT (JSON)   Nein          Wiederholungsregel (Interval,
                                               Wochentag etc.)

  completed_at     TEXT (ISO)    Nein          Abschlusszeitpunkt

  created_at       TEXT (ISO)    Ja            Erstellungszeitpunkt

  updated_at       TEXT (ISO)    Ja            Letzte Änderung
  ---

### 2.4.7 Dateiverknüpfung (file_links)

  ---
  **Feld**          **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                TEXT (UUID)   Ja            Primärschlüssel

  entity_type       TEXT          Ja            product, expense, order, listing,
                                                template

  entity_id         TEXT          Ja            ID der verknüpften Entität

  file_type         TEXT          Ja            Enum: stl, slicer, image, mockup,
                                                listing_text, packaging, manual,
                                                license, receipt, other

  file_path         TEXT          Ja            Relativer Pfad innerhalb des
                                                OneDrive-Ordners

  file_name         TEXT          Ja            Dateiname

  file_size_bytes   INTEGER       Nein          Dateigröße

  notes             TEXT          Nein          Beschreibung oder Hinweis

  created_at        TEXT (ISO)    Ja            Erstellungszeitpunkt
  ---

### 2.4.8 KI-Auftrag (ai_jobs)

  ---
  **Feld**         **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id               TEXT (UUID)   Ja            Primärschlüssel

  provider         TEXT          Ja            claude, openai, ollama

  model            TEXT          Ja            Modellbezeichnung (z.B.
                                               claude-sonnet-4-20250514)

  agent            TEXT          Ja            listing_assistant,
                                               expense_assistant, file_organizer,
                                               product_analyst, operations_coo

  action           TEXT          Ja            Ausgeführte Aktion (z.B.
                                               generate_title, classify_expense)

  input_data       TEXT (JSON)   Nein          Eingabedaten als JSON

  output_data      TEXT (JSON)   Nein          Ergebnis als JSON

  status           TEXT          Ja            pending, running, completed,
                                               failed, cancelled

  tokens_used      INTEGER       Nein          Verbrauchte Tokens

  cost_estimate    REAL          Nein          Geschätzte Kosten in EUR

  duration_ms      INTEGER       Nein          Dauer in Millisekunden

  error_message    TEXT          Nein          Fehlermeldung bei Failure

  created_at       TEXT (ISO)    Ja            Erstellungszeitpunkt
  ---

### 2.4.9 KPI-Snapshot (kpi_records)

  ---
  **Feld**               **Typ**       **Pflicht**   **Beschreibung**
  --- --- --- ---
  id                     TEXT (UUID)   Ja            Primärschlüssel

  period                 TEXT          Ja            Zeitraum (z.B. 2026-03,
                                                     2026-W11)

  period_type            TEXT          Ja            monthly, weekly

  revenue_total          REAL          Nein          Gesamtumsatz

  expenses_total         REAL          Nein          Gesamtausgaben

  orders_count           INTEGER       Nein          Anzahl Aufträge

  products_active        INTEGER       Nein          Aktive Produkte

  listings_active        INTEGER       Nein          Aktive Listings

  avg_margin             REAL          Nein          Durchschnittliche Marge in %

  print_time_total_min   INTEGER       Nein          Gesamtdruckzeit in Minuten

  material_used_grams    REAL          Nein          Materialverbrauch gesamt in
                                                     Gramm

  snapshot_data          TEXT (JSON)   Nein          Zusätzliche KPI-Daten als JSON

  created_at             TEXT (ISO)    Ja            Erstellungszeitpunkt
  ---

### 2.4.10 Beziehungen

Die folgenden Beziehungen definieren das relationale Modell:

-   Product 1:N Listing (ein Produkt hat mehrere Listings auf
    verschiedenen Plattformen)

-   Product 1:N FileLink (ein Produkt hat mehrere verknüpfte Dateien)

-   Product 1:N Order (ein Produkt kann in mehreren Aufträgen vorkommen)

-   Product 1:N Expense (optionale Zuordnung von Ausgaben zu Produkten)

-   Product 1:N Task (Aufgaben können einem Produkt zugeordnet sein)

-   Order 1:N Task (Aufgaben können einem Auftrag zugeordnet sein)

-   Listing 1:N Task (Aufgaben können einem Listing zugeordnet sein)

-   Expense 0:1 FileLink (optionaler Beleg)

-   Template M:N Platform (Vorlagen für mehrere Plattformen)

# 3. KI-Architektur

## 3.1 Abstraktionsschicht

Die KI-Integration folgt einem Provider-Pattern. Kein Provider ist
direkt in die Business-Logik eingebrannt. Stattdessen gibt es eine
generische Schnittstelle, die verschiedene Backends austauschbar macht.

### 3.1.1 Interface-Definition

```
interface AIProvider {

```
> name: string;
>
```
isAvailable(): Promise<boolean>;

generateText(prompt: string, options?: AIOptions):
```
> Promise<AIResponse>;
>
```
generateStructured<T>(prompt: string, schema: ZodSchema<T>):
```
> Promise<T>;
>
```
}

interface AIOptions {

```
> maxTokens?: number;
>
> temperature?: number;
>
> systemPrompt?: string;
>
> language?: 'de' | 'en';
>
```
}

interface AIResponse {

```
> text: string;
>
> tokensUsed: number;
>
> model: string;
>
> provider: string;
>
> durationMs: number;
>
```
}
```

### 3.1.2 Provider-Implementierungen

  ---
  **Provider**     **Modelle**                 **Einsatzbereich**    **Kosten**
  --- --- --- ---
  ClaudeProvider   claude-sonnet-4-20250514,   Hochwertige Texte,    API-basiert
                   claude-opus-4-20250514      Listings,             
                                               Business-Analysen,    
                                               komplexe              
                                               Umformulierungen      

  OpenAIProvider   gpt-4o, gpt-4o-mini         Fallback, Tool-Use,   API-basiert
                                               allgemeine Analyse    

  OllamaProvider   llama3, mistral, phi3       Lokale                Kostenlos
                                               Klassifikation,       (lokal)
                                               Dateibenennung,       
                                               einfache              
                                               Kategorisierung       
  ---

## 3.2 KI-Agenten

Jeder Agent kapselt eine Rolle mit spezifischen System-Prompts und
verfügbaren Aktionen:

### 3.2.1 Listing Assistant

Rolle: Erstellt und optimiert Listing-Texte für alle Plattformen.

Verfügbare Aktionen:

-   generateTitle(product, platform, language): Erstellt
    plattformkonformen Titel

-   generateDescription(product, platform, style, language): Kurz- oder
    Langbeschreibung

-   generateTags(product, platform, language): SEO-optimierte Tags

-   generateBulletPoints(product, language): Aufzählungspunkte für
    Produkteigenschaften

-   generateVariantNames(product): Variantenbezeichnungen

-   generateFAQ(product): Häufige Fragen aus Produktdaten

-   rewriteForPlatform(text, sourcePlatform, targetPlatform): Text für
    andere Plattform anpassen

System-Prompt-Anforderungen (KRITISCH):

-   Schreibstil: präzise, clean, sachlich-hochwertig

-   Keine Emojis, keine übertriebene Werbesprache, kein Gadget-Slang

-   Keine typischen KI-Formulierungen (Entdecke, Erlebe, Perfekt
    für...)

-   Keine Gedankenstriche als Stilmittel

-   Marke PolyGrid Studio: technisch, minimalistisch, vertrauenswürdig

-   Deutsche und englische Version auf Anfrage

-   Plattform-Limits beachten: Etsy Titel max. 140 Zeichen, Tags max. 13
    Stück

### 3.2.2 Expense Assistant

Rolle: Unterstützt bei der Erfassung und Kategorisierung von Ausgaben.

-   classifyExpense(vendor, amount, purpose): Kategorie und
    Unterkategorie vorschlagen

-   extractReceiptData(imageOrPdf): Belegdaten extrahieren (Betrag,
    Datum, Händler)

-   detectDuplicate(expense, existingExpenses): Doppelte Eingaben
    erkennen

-   suggestPurpose(vendor, category): Verwendungszweck vorschlagen

-   flagUnclearExpense(expense): Unklare Ausgaben markieren

### 3.2.3 Product Analyst

Rolle: Analysiert Preise, Margen und Produktpotenzial.

-   analyzeMargin(product): Detaillierte Margenanalyse

-   suggestPrice(product, competitors): Preisvorschlag basierend auf
    Kosten

-   suggestUpsells(product): Cross-Selling und Bundle-Ideen

-   analyzePortfolio(products): Stärken und Schwächen des Sortiments

-   identifyPriceProblems(products): Produkte mit zu niedriger Marge
    finden

### 3.2.4 File Organizer

Rolle: Hilft bei der Organisation von Dateien in der OneDrive-Struktur.

-   suggestFolder(fileName, context): Zielordner vorschlagen

-   suggestRename(fileName, product): Standardisierten Dateinamen
    vorschlagen

-   detectProductAssociation(fileName): Produktzugehörigkeit erkennen

-   flagUnclassified(files): Nicht zugeordnete Dateien markieren

### 3.2.5 Operations COO

Rolle: Gibt operative Übersichten und priorisiert Aufgaben.

-   generateWeeklyOverview(tasks, orders, products):
    Wochenzusammenfassung

-   prioritizeTasks(tasks): Aufgaben nach Dringlichkeit sortieren

-   identifyBottlenecks(orders, tasks): Engpässe erkennen

-   generateLaunchChecklist(product): Checkliste für Produktlaunch

-   suggestTasksFromNotes(notes): Aufgaben aus Freitext extrahieren

## 3.3 Betriebsmodi

Die KI arbeitet in konfigurierbaren Modi, die der Nutzer in den
Einstellungen festlegt:

  ---
  **Modus**         **Verhalten**                     **Empfehlung**
  --- --- ---
  Nur Vorschläge    KI gibt Output in einem           Für Einsteiger und
                    Vorschau-Panel. Keine Änderungen  Testphase
                    an Daten.                         

  Vorschlag +       KI zeigt Änderung an und wartet   Standard-Modus
  Bestätigung       auf explizite Bestätigung per     (empfohlen für MVP)
                    Button.                           

  Teilautomatisch   KI darf definierte ungefährliche  Für erfahrene Nutzer
                    Aktionen ausführen: Entwürfe      
                    anlegen, Dateien umbenennen,      
                    Ordner erstellen.                 

  Erweitert         KI darf komplexere Workflows      Post-MVP, nach
                    ausführen. Aktionslog immer       Vertrauensaufbau
                    sichtbar.                         
  ---

WICHTIG: Im MVP startet die App immer im Modus 'Vorschlag +
Bestätigung'. Jede KI-Aktion, die Daten verändert, muss vorher in einem
Diff-View angezeigt und vom Nutzer bestätigt werden. Der Diff-View
zeigt: Was wird geändert (vorher/nachher), welcher Agent die Änderung
vorschlägt, und welcher Provider verwendet wird.

# 4. UI/UX-Spezifikation

## 4.1 Design-System

### 4.1.1 Design-Philosophie

Das Interface folgt dem Industrial-Minimal-Prinzip: technisch, ruhig,
hochwertig. Es soll wirken wie ein professionelles Werkzeug und nicht
wie ein buntes SaaS-Dashboard. Referenzpunkte sind: Linear, Raycast,
Vercel Dashboard, Arc Browser.

### 4.1.2 Farbpalette

  ---
  **Token**        **Hell-Modus**   **Dunkel-Modus**   **Verwendung**
  --- --- --- ---
  bg-primary       #FAFAFA          #0A0A0F            Haupthintergrund

  bg-secondary     #F4F4F5          #111118            Sidebar, Panels

  bg-elevated      #FFFFFF          #1A1A24            Karten, Modals, Dropdowns

  bg-hover         #F0F0F2          #22222E            Hover-States

  text-primary     #18181B          #FAFAFA            Haupttext

  text-secondary   #71717A          #A1A1AA            Sekundärer Text, Labels

  text-muted       #A1A1AA          #52525B            Platzhalter, deaktiviert

  border-default   #E4E4E7          #27272A            Standard-Rahmen

  border-hover     #D4D4D8          #3F3F46            Hover-Rahmen

  accent-primary   #2563EB          #3B82F6            Primäre Aktionen, Links

  accent-success   #16A34A          #22C55E            Erfolg, Online, Bezahlt

  accent-warning   #D97706          #F59E0B            Warnungen, Review needed

  accent-danger    #DC2626          #EF4444            Fehler, Löschen, Risiko

  accent-info      #0891B2          #06B6D4            Info, KI-Vorschläge
  ---

### 4.1.3 Typografie

  ---
  **Element**        **Font**           **Größe**          **Gewicht**
  --- --- --- ---
  Display/Titel      Inter              24px / 1.5rem      600 (Semibold)

  Heading 1          Inter              20px / 1.25rem     600

  Heading 2          Inter              16px / 1rem        600

  Body               Inter              14px / 0.875rem    400 (Regular)

  Small / Label      Inter              12px / 0.75rem     500 (Medium)

  Mono / Code        JetBrains Mono     13px / 0.8125rem   400
  ---

### 4.1.4 Spacing und Grid

Basis-Unit: 4px. Alle Abstände in Vielfachen davon. Standard-Padding für
Karten: 16px. Standard-Gap zwischen Elementen: 8px. Sidebar-Breite:
240px (collapsible auf 64px). Content-Max-Width: 1200px.
Tabellenzeilen-Höhe: 44px.

### 4.1.5 Komponenten-Verhalten

Buttons: Primär mit accent-primary Hintergrund, Sekundär mit
transparentem Hintergrund und Border. Ghost-Buttons für
Toolbar-Aktionen. Alle Buttons mit 8px border-radius.

Eingabefelder: 36px Höhe, border-default Rahmen, focus-Ring in
accent-primary. Autofocus auf erstes Feld in Formularen.

Toasts/Notifications: Unten rechts, automatisch nach 4 Sekunden
ausblenden. Fehler bleiben bis zum manuellen Schließen.

Modals: Zentriert, max 560px breit, Overlay mit 50% Opacity. Escape zum
Schließen.

Shortcuts: Alle wichtigen Aktionen per Tastenkombination erreichbar.
Command Palette mit Cmd/Ctrl+K.

## 4.2 Navigation und Layout

### 4.2.1 App Shell

Die App Shell besteht aus drei Bereichen:

-   Sidebar (links, 240px): Navigation, Schnellaktionen, Nutzerprofil

-   Main Content (Mitte, flexibel): Der aktive Modulbereich

-   Detail Panel (rechts, optional, 400px): Kontextabhängige
    Detailansicht, KI-Chat

### 4.2.2 Sidebar-Aufbau

Die Sidebar ist zweigeteilt:

Oberer Bereich (Hauptnavigation):

-   Dashboard (Icon: LayoutDashboard)

-   Produkte (Icon: Package)

-   Ausgaben (Icon: Receipt)

-   Aufträge (Icon: ShoppingCart)

-   Listings (Icon: FileText)

-   Vorlagen (Icon: FileStack)

-   Dateien (Icon: FolderOpen)

-   Aufgaben (Icon: CheckSquare)

-   Analysen (Icon: BarChart3)

Unterer Bereich (fixiert am unteren Rand):

-   KI-Assistent (Icon: Sparkles)

-   Einstellungen (Icon: Settings)

-   Sidebar ein-/ausklappen (Icon: PanelLeftClose)

Verhalten: Aktiver Menupunkt wird mit accent-primary Hintergrund
hervorgehoben. Hover zeigt bg-hover. Badge-Counter für offene Aufträge
und überfällige Aufgaben. Sidebar ist collapsible: Im eingeklappten
Zustand werden nur Icons angezeigt (64px Breite).

## 4.3 Modulansichten im Detail

### 4.3.1 Dashboard

Layout: 2-Spalten-Grid oben (KPI-Karten), darunter 3-Spalten-Grid
(Widgets).

KPI-Karten (obere Reihe, volle Breite):

-   Umsatz (aktueller Monat, mit Vergleich zum Vormonat)

-   Ausgaben (aktueller Monat)

-   Offene Aufträge (Anzahl, mit ältestem Datum)

-   Offene Aufgaben (Anzahl, mit nächster Fälligkeit)

Widgets (darunter):

-   Zuletzt bearbeitete Produkte (5 Einträge, mit Status-Badge)

-   Produkte mit schwacher Marge (unter 30%, rot markiert)

-   Listings mit fehlenden Daten (fehlende Tags, Beschreibung etc.)

-   Neue Produkte in Pipeline (Status: idea, review, test_print)

-   Schnellaktionen-Leiste: Neue Ausgabe, Neues Produkt, Neues Listing,
    KI fragen

Nice-to-have Widgets (v1.5):

-   Druckzeit gesamt pro Monat (Fortschrittsbalken)

-   Materialverbrauch (Donut-Chart nach Filamenttyp)

-   Geschätzte Gewinnentwicklung (Linien-Chart, letzte 6 Monate)

### 4.3.2 Produktverwaltung

Layout: Listenansicht mit Filterbarem TanStack Table. Klick auf Zeile
öffnet Detail-Panel rechts.

Listenansicht (Tabelle):

-   Spalten: Status-Badge, Name, Kategorie, Materialtyp, Zielpreis,
    Marge (berechnet), Plattformen (Icons), Letzte Änderung

-   Filter: Status, Kategorie, Plattform, Marge-Range, Lizenz-Risiko

-   Sortierung: Nach jeder Spalte

-   Suche: Volltextsuche über Name, Kurzname, Beschreibung

-   Bulk-Aktionen: Status ändern, Kategorie zuweisen, Löschen (mit
    Bestätigung)

Detail-Panel (rechts, 400px):

-   Tabs: Übersicht, Dateien, Listings, Kosten, KI

-   Übersicht: Alle Produktfelder als editierbares Formular

-   Dateien: Verknüpfte Dateien mit Typ-Icons, Drag-and-Drop zum
    Hinzufügen

-   Listings: Alle Listings zu diesem Produkt mit Status

-   Kosten: Margenrechner (Material + Strom + Verpackung + Versand +
    Plattformgebühr = Gesamtkosten, Verkaufspreis minus Kosten = Marge)

-   KI: Schnellaktionen (Titel generieren, Beschreibung erstellen, Tags
    vorschlagen, Preis analysieren)

Neues Produkt (Modal oder Fullscreen-Formular):

-   Step 1: Basics (Name, Kategorie, Material, Status)

-   Step 2: Kosten (Druckzeit, Material, Verpackung, Versand, Zielpreis)

-   Step 3: Lizenz (Quelle, Typ, Risiko)

-   Step 4: Dateien (STL, Bilder verlinken oder hochladen)

-   Optionaler KI-Step: Titel und Beschreibung direkt generieren lassen

### 4.3.3 Ausgabenverwaltung

Layout: Tabelle mit Monatssumme oben, Kategorien-Breakdown als
Sidebar-Widget.

Tabelle:

-   Spalten: Datum, Betrag (brutto), Händler, Kategorie, Produktbezug
    (optional), Beleg-Icon, Steuerrelevanz-Icon

-   Filter: Zeitraum, Kategorie, Händler, steuerlich relevant, mit/ohne
    Beleg

-   Schnelle Eingabe: Formular direkt über der Tabelle (Inline-Add-Row)

Wichtiger UI-Hinweis:

Dauerhaft sichtbarer Disclaimer am Seitenende: 'Dieses Modul
unterstützt die Erfassung und Organisation von Ausgaben. Es ersetzt
keine steuerliche Buchführung. Bitte konsultiere deinen Steuerberater.'

### 4.3.4 Auftragsverwaltung

Layout: Kanban-Board als Standardansicht, Tabelle als Alternative.

Kanban-Spalten:

-   Anfrage/Angebot, Bestellt/Bezahlt, In Produktion, Fertig/Versendet,
    Abgeschlossen, Problemfall

-   Drag-and-Drop zwischen Spalten ändert den Status

-   Jede Karte zeigt: Produkt, Kunde/Plattform, Betrag, Datum

Detail-Panel:

-   Alle Auftragsfelder

-   Timeline mit Statusänderungen

-   KI-generierte Antwortentwürfe für Kundenkommunikation

-   Kostenaufstellung (Material, Versand, Gebühren, Marge)

### 4.3.5 Listing-Verwaltung

Layout: Gruppiert nach Plattform, mit Ampel-System für Vollständigkeit.

Listenansicht:

-   Spalten: Plattform-Icon, Titel, Produkt, Preis, Status,
    Vollständigkeit (%), Sprache

-   Vollständigkeit: Grün (alles da), Gelb (fehlende Tags/Beschreibung),
    Rot (wesentliche Daten fehlen)

-   Filter: Plattform, Status, Vollständigkeit, Sprache

Listing-Editor:

-   Split-View: Links das Formular, rechts die KI-Vorschau

-   KI-Toolbar: Titel generieren, Tags generieren, Beschreibung
    (kurz/lang), Plattform anpassen

-   Jeder KI-Vorschlag erscheint als Diff-View (vorher/nachher) mit
    Annehmen/Ablehnen

-   Plattform-Wechsler: Ein Klick passt den Text für eine andere
    Plattform an

-   Zeichenzähler für plattformspezifische Limits

### 4.3.6 Vorlagenbibliothek

Layout: Kategorisierte Liste mit Suchfunktion.

-   Kategorien als Tabs: Impressum, Widerruf, Versand, FAQ,
    Kundenservice, Beilagen, Reklamation

-   Jede Vorlage zeigt: Name, Kategorie, Plattformen, Version, letztes
    Update

-   Editor: Textfeld mit Syntax-Highlighting für Platzhaltervariablen
    (z.B. {{produktname}}, {{bestellnummer}})

-   Warnhinweis bei Rechtstexten: Banner oben im Editor: 'Dies ist ein
    Rechtstext. Assistierte Bearbeitung aktiv. Nicht als juristisch
    geprüft verwenden.'

-   KI-Aktionen: Text umformulieren, kürzen, verlängern, für andere
    Plattform anpassen

### 4.3.7 Dateimanager

Layout: Zweispaltig. Links Ordnerbaum, rechts Dateiliste mit Vorschau.

Funktionen:

-   OneDrive-Hauptordner setzen (einmalige Konfiguration in Settings)

-   Ordnerstruktur als Baumansicht anzeigen

-   Neue Produktordner mit Standardunterordnern anlegen (STL, Slicer,
    Bilder, Listings, Verpackung, Lizenz)

-   Dateien per Drag-and-Drop verschieben

-   Dateien umbenennen (KI-Vorschlag für standardisierten Namen)

-   Duplikate erkennen und markieren

-   Fehlende Pflichtdateien markieren (z.B. Produkt ohne STL)

-   Bildvorschau für PNG/JPG/WEBP

Standard-Ordnerstruktur:

```
/PolyGrid Studio/

/01_Finanzen/

/Belege_2026/

/Exporte/

/02_Produkte/

/{Produktname}/

/STL/

/Slicer/

/Bilder/

/Listings/

/Verpackung/

/Lizenz/

/03_Listings/

/04_Auftraege/

/05_Vorlagen/

/06_Rechtliches/

/07_Marktrecherche/

/08_Content/

/09_Archiv/
```

Sicherheit: Keine Löschung ohne Bestdtigung. Gelöschte Dateien werden
zunächst nach /09_Archiv verschoben. Endgültige Löschung nur über
separaten Archiv-Manager mit doppelter Bestätigung.

### 4.3.8 Aufgaben-Modul

Layout: Wochenansicht als Standard, Listenansicht als Alternative.

-   Wochenansicht: Swim-Lanes für Mo--So, Aufgaben als Karten mit
    Priorität-Badge

-   Prioritäten: Urgent (rot), High (orange), Medium (blau), Low (grau)

-   Verknüpfung: Jede Aufgabe kann optional mit einem Produkt, Auftrag
    oder Listing verbunden sein

-   Wiederkehrend: Tages-, Wochen- oder Monatsrhythmus konfigurierbar

-   KI-Aktionen: Aus Freitext Aufgaben extrahieren, Wochenprioritierung
    vorschlagen, Launch-Checkliste generieren

### 4.3.9 Analysen

Layout: Grid aus Chart-Widgets, konfigurierbar.

Standard-Widgets:

-   Umsatz nach Plattform (Balkendiagramm, letzte 6 Monate)

-   Ausgaben nach Kategorie (Donut-Chart, aktueller Monat)

-   Marge nach Produkt (Horizontales Balkendiagramm, sortiert)

-   Produkte mit schlechtem Deckungsbeitrag (Tabelle, rot markiert)

-   Durchschnittliche Druckzeit (KPI-Karte mit Trend)

-   Materialkostenquote (Prozent der Gesamtausgaben)

-   Aktive vs. pausierte Listings (Statusverteilung)

-   Offene Aufträge (Timeline-Widget)

KI-Zusammenfassung:

Button 'Analyse erstellen' ruft den Product Analyst auf. Dieser
generiert eine Klartextanalyse: 'Dein profitabelstes Produkt ist X mit
Y% Marge. Produkt Z hat das schlechteste Verhältnis von Druckzeit zu
Marge. Überprüfe den Preis oder optimiere die Druckeinstellungen.'

### 4.3.10 KI-Assistent (Standalone)

Layout: Chat-Interface, ähnlich wie ein Messenger.

-   Freies Textfeld für allgemeine Fragen

-   Vorschlag-Chips: 'Listing erstellen', 'Ausgabe erfassen',
    'Woche planen', 'Preis prüfen'

-   Kontext-Aware: Wenn ein Produkt geöffnet ist, bezieht sich die KI
    automatisch darauf

-   Verlauf: Letzte 50 Nachrichten gespeichert

-   Provider-Anzeige: Zeigt an, welcher KI-Provider gerade aktiv ist

-   Aktions-Buttons: Wenn die KI eine Aktion vorschlägt (z.B. 'Listing
    anlegen'), erscheint ein Ausführen-Button

### 4.3.11 Einstellungen

Tabs: Allgemein, KI, Markenstil, Plattformen, Sicherheit

Allgemein:

-   Firmenname / Shopname

-   OneDrive-Hauptordner (Ordnerauswahl-Dialog)

-   Standardwährung (EUR, fix für MVP)

-   Standardsprache (DE/EN)

-   Theme (Hell/Dunkel/System)

-   Datumsformat

KI-Konfiguration:

-   Provider-Auswahl: Claude, OpenAI, Ollama (mit Verbindungstest)

-   API-Key-Eingabe (maskiert, gespeichert im OS-Keychain)

-   Bevorzugtes Modell pro Provider

-   Lokale KI aktivieren (Ollama-Endpoint konfigurieren)

-   Monatliches Kostenlimit in EUR (mit Warnung bei 80%)

-   Logging: KI-Aufträge protokollieren (an/aus)

-   Betriebsmodus (Nur Vorschläge / Vorschlag + Bestätigung /
    Teilautomatisch)

Markenstil (wird an alle KI-Agenten übergeben):

-   Schreibstil: Dropdown (sachlich-minimalistisch, technisch-präzise,
    freundlich-professionell)

-   Brand-Wörter: Kommaseparierte Liste von Begriffen, die bevorzugt
    werden

-   No-Go-Formulierungen: Wörter und Phrasen, die nie verwendet werden
    dürfen

-   Beispieltext: Ein Referenztext für den gewünschten Stil

Plattformen und Material:

-   Standard-Plattformen (Checkboxen: Etsy, eBay, Kleinanzeigen)

-   Standard-Materialien (PLA, PETG, TPU, ABS, Resin)

-   Farbvarianten-Bibliothek (Name + Hex-Code)

-   Versandklassen und Preise

Sicherheit:

-   Dateioperationen absichern (Löschung nur mit Bestätigung)

-   Auto-Archivierung nach X Tagen

-   Datenbank-Backup (manuell und automatisch)

-   Export-Funktionen (alle Daten als JSON, Ausgaben als CSV)

# 5. Command Palette und Tastaturkürzel

## 5.1 Command Palette

Die Command Palette wird mit Cmd+K (Mac) oder Ctrl+K (Windows) geöffnet.
Sie bietet Zugriff auf alle Hauptaktionen und dient als universelle
Suchfunktion.

Kategorien in der Suche:

-   Navigation: Zu Dashboard, Zu Produkten, Zu Ausgaben etc.

-   Aktionen: Neues Produkt, Neue Ausgabe, Neuer Auftrag, Neues Listing

-   KI: KI fragen, Listing generieren, Marge analysieren

-   Daten: Produktsuche, Auftragssuche, Vorlagensuche

-   System: Einstellungen, Daten exportieren, Backup erstellen

## 5.2 Globale Shortcuts

  ---
  **Shortcut**           **Aktion**
  --- ---
  Cmd/Ctrl + K           Command Palette öffnen

  Cmd/Ctrl + N           Neues Element im aktiven Modul

  Cmd/Ctrl + S           Aktives Formular speichern

  Cmd/Ctrl + Z           Rückgängig

  Cmd/Ctrl + Shift + Z   Wiederholen

  Cmd/Ctrl + /           KI-Assistent öffnen/schließen

  Cmd/Ctrl + B           Sidebar ein-/ausklappen

  Cmd/Ctrl + 1--9        Zu Modul 1--9 navigieren

  Escape                 Modal/Panel schließen

  Tab                    Nächstes Feld im Formular
  ---

# 6. OneDrive-Integration

## 6.1 Architektur

Die App greift nicht über die OneDrive-API zu, sondern direkt auf das
lokale Dateisystem. OneDrive synchronisiert die Dateien automatisch in
einen lokalen Ordner. Die App behandelt diesen Ordner wie ein normales
Verzeichnis.

## 6.2 Konfiguration

-   Ersteinrichtung: Nutzer wählt seinen OneDrive-Gewerbeordner über
    einen nativen Verzeichnis-Dialog

-   Der Pfad wird in den App-Settings gespeichert

-   Bei jedem Start prüft die App, ob der Ordner noch existiert und
    erreichbar ist

-   Fehler-Handling: Wenn der Ordner nicht erreichbar ist (OneDrive
    nicht synchronisiert), zeigt die App einen Hinweis mit
    Handlungsanweisung

## 6.3 Dateioperationen via Tauri

Alle Dateioperationen laufen über Tauri-Commands im Rust-Backend:

-   list_directory(path): Verzeichnis auflisten

-   create_directory(path): Ordner erstellen

-   rename_file(old_path, new_path): Datei umbenennen

-   move_file(source, target): Datei verschieben

-   copy_file(source, target): Datei kopieren

-   delete_to_archive(path): Datei nach /09_Archiv verschieben (kein
    echtes Löschen)

-   get_file_info(path): Metadaten lesen (Größe, Datum, Typ)

-   watch_directory(path): Filesystem-Watcher für Live-Updates

Alle Operationen werden in einem Operations-Log protokolliert (Aktion,
Quelle, Ziel, Zeitstempel). Bei Fehlern wird die Operation zurückgerollt
und der Nutzer informiert.

## 6.4 Produkt-Ordner automatisch anlegen

Wenn ein neues Produkt erstellt wird, bietet die App an, automatisch die
Standard-Ordnerstruktur unter /02_Produkte/{Produktname}/ zu erstellen.
Dieser Vorgang ist optional und wird mit einem Dialog bestätigt. Der
Ordnername wird aus dem Produktnamen generiert: Sonderzeichen entfernt,
Leerzeichen durch Bindestriche ersetzt, alles in Kleinbuchstaben.

# 7. Sicherheits- und Rechtsanforderungen

## 7.1 Datensicherheit

-   API-Keys werden im OS-Keychain gespeichert (macOS Keychain, Windows
    Credential Manager), niemals im Klartext in der Datenbank oder
    Config-Dateien

-   SQLite-Datenbank liegt im App-Datenverzeichnis, nicht im
    OneDrive-Ordner

-   Automatisches Backup der Datenbank: täglich, lokales Verzeichnis,
    maximal 30 Backups

-   Manuelles Backup jederzeit über Einstellungen möglich

-   Export-Funktion: Alle Daten als JSON, Ausgaben als CSV (für
    Steuerberater)

## 7.2 KI-Sicherheit

-   Keine Kundendaten (Name, Adresse, E-Mail) an Cloud-KI-Provider
    senden ohne explizite Opt-in

-   Anonymisierungsoption in Settings: Kundennamen werden vor dem Senden
    maskiert

-   Alle KI-Aufträge werden in der ai_jobs-Tabelle protokolliert

-   Kostenlimit pro Monat konfigurierbar, bei 80% Warnung, bei 100%
    KI-Features deaktiviert

-   Fallback auf lokale KI (Ollama) wenn Cloud-Budget erschöpft

## 7.3 Dateioperationen

-   Keine endgültige Löschung ohne doppelte Bestätigung

-   Standard ist Soft-Delete: Verschieben nach /09_Archiv

-   Archiv-Aufräumung nach 30 Tagen (konfigurierbar, deaktivierbar)

-   Operations-Log für alle Dateiaktionen

-   Undo-Funktion für letzte Dateioperation

## 7.4 Steuerliche und rechtliche Hinweise im UI

Die folgenden Hinweise müssen dauerhaft und gut sichtbar in der
Anwendung platziert sein:

-   Ausgaben-Modul: 'Dieses Tool unterstützt die Erfassung und
    Organisation. Es ersetzt keine steuerliche Buchführung.'

-   Vorlagen-Editor bei Rechtstexten: 'Rechtstext. Assistierte
    Bearbeitung. Nicht als juristisch geprüft verwenden.'

-   KI-generierte Texte: Kleine Kennzeichnung 'KI-Entwurf' bis der
    Nutzer den Text manuell freigibt

-   Lizenz-Warnung bei Produkten mit license_risk = 'risky' oder
    'unclear': Rotes Banner mit Handlungsaufforderung

## 7.5 STL-Lizenzmanagement

Jedes Produkt hat ein Lizenzfeld, das den Status der kommerziellen
Nutzung dokumentiert. Das System hilft beim Risikomanagement:

-   Lizenztyp erfassen: Eigenes Design, CC-BY, CC-BY-SA, CC-BY-NC,
    Kommerziell erworben, Unklar

-   Quell-URL dokumentieren

-   Risikobewertung: safe (eigenes Design oder kommerziell erworben),
    review_needed (CC-Lizenz, muss geprüft werden), risky (NC-Klausel
    oder unklare Herkunft)

-   Automatische Warnung wenn ein Produkt mit Status 'risky' auf
    'online' gesetzt wird

-   Dashboard-Widget: 'Produkte mit ungeklärtem Lizenzstatus'

# 8. Kernprozesse und Workflows

## 8.1 Produkt-Launch-Workflow

Dieser Workflow beschreibt den vollständigen Prozess von der Produktidee
bis zum Live-Listing. Die App unterstützt jeden Schritt aktiv.

1.  Produktidee erfassen: Neues Produkt mit Status 'idea', Name und
    Kategorie.

2.  STL beschaffen und Lizenz dokumentieren: Eigenes Design oder
    Download. Quelle und Lizenztyp eintragen. Bei unklarer Lizenz wird
    automatisch eine Review-Aufgabe erstellt.

3.  Testdruck: Status auf 'test_print' setzen. Druckzeit und
    Materialverbrauch eintragen. Fotos vom Ergebnis in den
    Produktordner.

4.  Kalkulation: Materialkosten, Stromkosten, Verpackung, Versandklasse
    eintragen. System berechnet automatisch die Marge bei verschiedenen
    Preispunkten.

5.  Listing-Texte generieren: KI-Assistent erstellt Titel, Beschreibung
    und Tags. Nutzer reviewt im Diff-View und passt an.

6.  Produktfotos und Mockups: In den Produktordner unter /Bilder
    ablegen. Im Listing verlinken.

7.  Listing live schalten: Status auf 'online'. Manuell auf Etsy/eBay
    einstellen (kein API-Connector im MVP). Listing-Status in der App
    tracken.

8.  Monitoring: Dashboard zeigt Verkäufe, Marge und Performance.

## 8.2 Ausgaben-Erfassungs-Workflow

1.  Neue Ausgabe anlegen: Schnellformular mit Datum, Betrag, Händler.

2.  KI klassifiziert: Kategorie und Verwendungszweck werden
    vorgeschlagen.

3.  Beleg verlinken: Belegdatei per Drag-and-Drop oder Dateibrowser
    hinzufügen.

4.  Optional: Produktbezug herstellen (z.B. Filamentkauf für bestimmtes
    Produkt).

5.  Bestätigen: Ausgabe wird gespeichert, KPI-Dashboard aktualisiert.

## 8.3 Auftragsbearbeitungs-Workflow

1.  Neuer Auftrag eingeht: Manuell erfassen mit Plattform, Produkt,
    Variante, Menge, Preis.

2.  Status: 'ordered' oder 'paid' (je nach Plattform).

3.  In Produktion: Status auf 'in_production'. Optionale Aufgabe
    'Drucken' wird erstellt.

4.  Fertig: Status auf 'ready'. Verpacken und Versandlabel erstellen.

5.  Versendet: Status auf 'shipped'. Tracking-Nummer eintragen.

6.  Abgeschlossen: Nach Bestätigung auf 'completed'. Marge wird final
    berechnet.

## 8.4 Wochen-Review-Workflow (KI-gestützt)

Der Operations COO Agent generiert auf Knopfdruck eine
Wochenzusammenfassung:

-   Offene Aufträge und deren Status

-   Überfällige Aufgaben

-   Umsatz und Ausgaben der Woche

-   Produkte in der Pipeline

-   Empfehlungen für die kommende Woche

-   Probleme und Engpässe

# 9. Margenrechner-Logik

Der Margenrechner ist eine Kernfunktion der Produktverwaltung. Er
berechnet transparent die Profitabilität jedes Produkts.

## 9.1 Kostenbestandteile

  ---
  **Posten**          **Berechnung**            **Quelle**
  --- --- ---
  Materialkosten      material_grams \*         Produkt + Einstellungen
                      Filamentpreis pro Gramm   (Filamentpreis/kg)

  Stromkosten         print_time_minutes \*     Produkt + Einstellungen
                      Strompreis pro Minute     (Strompreis/kWh,
                                                Druckerverbrauch)

  Verpackungskosten   Fester Betrag pro Produkt Produkt (packaging_cost)

  Versandkosten       Basierend auf             Produkt (shipping_class) +
                      Versandklasse             Einstellungen

  Plattformgebühren   Prozentsatz vom           Einstellungen (pro
                      Verkaufspreis             Plattform konfigurierbar)

  Sonstige Kosten     Optionaler manueller      Produkt
                      Aufschlag                 
  ---

## 9.2 Berechnung

> Gesamtkosten = Material + Strom + Verpackung + Versand +
> Plattformgebühr + Sonstiges
>
> Rohgewinn = Verkaufspreis - Gesamtkosten
>
```
Marge (%) = (Rohgewinn / Verkaufspreis) \* 100
```

## 9.3 Margen-Ampel

  ---
  **Marge**       **Farbe**       **Bewertung**
  --- --- ---
  über 50%        Grün            Exzellent

  30--50%         Grün (hell)     Gut

  15--30%         Gelb            Akzeptabel, optimieren

  0--15%          Orange          Kritisch, Preiserhöhung empfohlen

  unter 0%        Rot             Verlust, sofortiger Handlungsbedarf
  ---

## 9.4 Einstellbare Parameter (Settings)

-   Filamentpreis pro kg (Standard: 22 EUR für PLA)

-   Strompreis pro kWh (Standard: 0,35 EUR)

-   Druckerleistung in Watt (Standard: 200W für Elegoo Neptune 4 Pro)

-   Etsy-Gebühr (Standard: 6,5% Transaktionsgebühr + 0,20 EUR
    Einstellgebühr)

-   eBay-Gebühr (Standard: je nach Kategorie, konfigurierbar)

-   Kleinanzeigen-Gebühr (Standard: 0 EUR, optional)

-   Standardverpackungskosten pro Versandklasse

# 10. Export und Datenaustausch

## 10.1 Exportformate

  ---
  **Daten**             **Format**       **Zielgruppe / Zweck**
  --- --- ---
  Alle Ausgaben         CSV              Steuerberater, eigene Auswertung
                                         in Excel

  Alle Produkte         JSON             Backup, Migration

  Alle Listings         JSON             Backup, Textarchiv

  Alle Aufträge         CSV + JSON       Umsatzanalyse, Steuerberater

  Kompletter            JSON (SQLite     Volles Backup
  Datenbestand          Dump)            

  KI-Aufträge-Log       JSON             Kostenanalyse, Debugging

  KPI-Snapshots         CSV              Langzeitanalyse
  ---

## 10.2 Import

Für den MVP gibt es keinen automatischen Import von Plattformdaten.
Geplant für spätere Versionen:

-   CSV-Import für Produkte (Massenanlage)

-   CSV-Import für Ausgaben (z.B. aus Kontobewegungen)

-   Etsy CSV Export importieren (Bestellungen)

-   eBay CSV Export importieren (Bestellungen)

# 11. MVP-Roadmap und Entwicklungsphasen

## 11.1 Phase 1: MVP v1 (Kernfunktionalität)

Ziel: Funktionierendes Backoffice-Tool mit den wichtigsten Modulen.

Pflichtumfang:

-   Desktop-App für macOS und Windows (Tauri)

-   App Shell mit Sidebar-Navigation und Command Palette

-   Dashboard mit KPI-Karten und Schnellaktionen

-   Produktverwaltung mit vollständigem CRUD und Margenrechner

-   Ausgabenverwaltung mit Kategorisierung

-   Listing-Verwaltung mit KI-Textgenerierung

-   Vorlagenbibliothek mit Platzhaltervariablen

-   Dateimanager mit OneDrive-Integration

-   KI-Provider-Setup (Claude + OpenAI)

-   Listing Assistant Agent

-   Expense Assistant Agent

-   SQLite-Datenbank mit Drizzle ORM

-   Settings-Bereich

-   Hell-/Dunkel-Modus

-   Globale Suche und Shortcuts

## 11.2 Phase 2: v1.5 (Erweiterungen)

-   Auftragsverwaltung mit Kanban-Board

-   Aufgaben-Modul mit Wochenansicht

-   Beleg-Upload mit Bildvorschau

-   KI-Kategorisierung für Ausgaben (automatisch)

-   Erweiterte Preis-/Margenlogik mit Vergleichsfunktion

-   Product Analyst Agent

-   File Organizer Agent

-   Export-Funktionen (CSV, JSON)

-   Datenbank-Backup (automatisch)

-   Analysen-Modul mit Charts

## 11.3 Phase 3: v2 (KI-Erweiterungen und Automatisierung)

-   Lokale KI via Ollama

-   Hybride KI-Logik (einfache Jobs lokal, komplexe Jobs Cloud)

-   OCR für Belege

-   Operations COO Agent

-   Stärkeres Reporting und Dashboarding

-   Bulk-Aktionen (mehrere Listings gleichzeitig generieren)

-   KI-Workflow-Ketten (z.B. Produkt anlegen, Listing generieren, Ordner
    erstellen in einem Flow)

-   CSV-Import für Plattformdaten

## 11.4 Phase 4: v3 (Plattform-Erweiterung)

Optional und abhängig vom Geschäftswachstum:

-   Web-Version (React, gehostet)

-   iPhone/iPad Companion App (React Native oder native)

-   Etsy API Integration (Listings automatisch publizieren)

-   eBay API Integration

-   Multi-User mit Rollenkonzept

-   Shopify-Anbindung

# 12. Qualitätskriterien für die Entwicklung

## 12.1 Code-Qualität

-   TypeScript strict mode aktiviert

-   ESLint + Prettier konfiguriert

-   Alle Datenmodelle als Zod-Schemas definiert (Single Source of Truth)

-   Fehlerbehandlung: Jede Dateioperaion und KI-Anfrage muss try/catch
    haben

-   Logging: Strukturiertes Logging für alle kritischen Operationen

-   Keine any-Types ohne Kommentar

-   Feature-basierte Ordnerstruktur (nicht nach Dateityp)

## 12.2 Performance

-   App-Start unter 2 Sekunden auf durchschnittlicher Hardware

-   Tabellen mit 1.000+ Einträgen müssen flüssig scrollen
    (Virtualisierung via TanStack Table)

-   KI-Anfragen asynchron mit Loading-States (Skeleton-UI während des
    Ladens)

-   Dateimanager lädt Verzeichnisse lazy (nicht den gesamten
    OneDrive-Baum auf einmal)

-   SQLite-Queries mit Indizes auf häufig gefilterte Felder (status,
    platform, category, created_at)

## 12.3 Testing

-   Unit-Tests für Business-Logik (Margenrechner, Kostenberechnung)

-   Unit-Tests für KI-Abstraktionsschicht (Provider-Auswahl, Fallback)

-   Integration-Tests für Datenbankoperationen

-   E2E-Tests für kritische Workflows (Produkt anlegen, Listing
    generieren)

-   Testabdeckung Ziel: 80% für Business-Logik, 60% gesamt

## 12.4 Barrierefreiheit

-   Alle interaktiven Elemente per Tastatur erreichbar

-   ARIA-Labels für Icons und Buttons ohne Text

-   Farbkontraste gemäß WCAG 2.1 AA

-   Focus-Indikatoren sichtbar

## 12.5 Internationalisierung

Auch wenn die MVP-Sprache Deutsch ist, sollte die App von Anfang an
i18n-ready sein:

-   Alle UI-Strings in Sprachdateien auslagern (de.json, en.json)

-   Datumsformate über Intl API

-   Währungsformate über Intl.NumberFormat

-   KI-Sprache konfigurierbar (de/en)

# 13. Glossar

  ---
  **Begriff**        **Definition**
  --- ---
  STL                Stereolithographie-Dateiformat für 3D-Modelle

  Slicer             Software, die 3D-Modelle in Druckanweisungen
                     (G-Code) umwandelt

  PLA                Polylactid, biologisch abbaubares Filament
                     (Standard-Druckmaterial)

  Listing            Ein Produktangebot auf einer Verkaufsplattform
                     (Etsy, eBay etc.)

  Marge              Differenz zwischen Verkaufspreis und Gesamtkosten in
                     Prozent

  Tauri              Framework für plattformübergreifende Desktop-Apps
                     mit Rust und Web-Technologien

  OneDrive           Microsoft Cloud-Speicher mit lokaler
                     Dateisynchronisation

  Ollama             Tool zum lokalen Ausführen von KI-Sprachmodellen

  Drizzle ORM        TypeScript ORM für SQL-Datenbanken

  shadcn/ui          Komponentenbibliothek für React basierend auf Radix
                     UI

  Zustand            Minimalistischer State Manager für React

  TanStack Table     Headless UI-Bibliothek für Tabellen in React

  MVP                Minimum Viable Product, erste lauffähige Version

  Soft-Delete        Datensätze werden als gelöscht markiert, aber nicht
                     physisch entfernt

  CC-BY              Creative Commons Lizenz: Namensnennung erforderlich,
                     kommerzielle Nutzung erlaubt

  CC-BY-NC           Creative Commons Lizenz: Keine kommerzielle Nutzung
                     erlaubt

  Kleinunternehmer   Steuerlicher Status gemäß §19 UStG (keine
                     Umsatzsteuererhebung)

  DAC7               EU-Richtlinie zur Meldepflicht von
                     Plattformverkäufern
  ---

# 14. Anhänge

## 14.1 Ausgaben-Kategorien (vollständige Liste)

  ---
  **Kategorie**         **Unterkategorien (Beispiele)**
  --- ---
  Filament              PLA, PETG, TPU, ABS, Resin, Sondermaterial

  Verpackung            Kartons, Füllmaterial, Klebeband, Aufkleber,
                        Beilagen

  Werkzeuge             Spatel, Pinzette, Cutter, Messgeräte

  Druckerzubehör        Düsen, Druckbett, Riemen, Federn, Ersatzteile

  Maschinen/Hardware    Drucker, Enclosure, Upgrades, Computer

  Software/SaaS         CAD-Software, Slicer-Lizenz, Cloud-Dienste,
                        KI-API-Kosten

  Werbung               Etsy Ads, Social Media, Fotografie

  Versand               Briefmarken, DHL, Hermes, Verpackungsstation

  Reisekosten           Messen, Abholung, Materialbesorgung

  Büro                  Papier, Tinte, Ordner, Schreibtisch

  Sonstiges             Alles, was nicht in andere Kategorien passt
  ---

## 14.2 Plattformspezifische Listing-Anforderungen

  ---
  **Plattform**   **Titel-Limit**   **Tags**      **Beschreibung**    **Besonderheiten**
  --- --- --- --- ---
  Etsy            140 Zeichen       Max. 13 Tags  Keine               SEO-Titel wichtig,
                                                  Zeichenbegrenzung   Bullet Points
                                                                      empfohlen,
                                                                      Kategoriebaum

  eBay            80 Zeichen        Keine Tags    HTML erlaubt        Artikelmerkmale
                                    (Merkmale)                        wichtig,
                                                                      Zustandsbeschreibung,
                                                                      Versandoptionen

  Kleinanzeigen   50 Zeichen        Keine Tags    Freitext, kurz      Preis + Standort
                                                                      wichtig, einfache
                                                                      Beschreibung, Fotos
                                                                      entscheidend
  ---

## 14.3 KI-Prompt-Richtlinien für Listing-Texte

Die folgenden Richtlinien müssen in den System-Prompts aller
Text-generierenden KI-Agenten verankert sein:

SCHREIBSTIL:

-   Präzise und sachlich. Kein übertriebener Enthusiasmus.

-   Technische Details, wo sinnvoll. Kein Weglassen von Fakten zugunsten
    von Marketingsprache.

-   Kurze Sätze. Klare Struktur.

-   Passend für eine Marke, die sich als 'Industrial Minimal'
    positioniert.

VERBOTEN:

-   Emojis in Produkttexten

-   Gedankenstriche als Stilmittel

-   Formulierungen wie: 'Entdecke', 'Erlebe', 'Perfekt für',
    'Ideal für jeden', 'Must-have', 'Eyecatcher'

-   Superlative ohne Substanz: 'Der beste', 'Einzigartig',
    'Unvergleichlich'

-   Fragen im Beschreibungstext: 'Suchst du...?', 'Du liebst...?'

-   Generische Füller: 'Hochwertig verarbeitet', 'Aus bestem
    Material'

BEVORZUGT:

-   Konkrete Maße, Gewichte, Materialangaben

-   Funktionsbeschreibung statt Emotionsbeschreibung

-   'Gedruckt aus PLA. 12 cm hoch. Passend für Standard-Regale.'

-   'Organizer mit drei Fächern für Stifte, Kabel und Kleinkram.'

## 14.4 Standard-Einstellungen (Defaults)

  ---
  **Einstellung**                **Standardwert**
  --- ---
  Währung                        EUR

  Sprache                        Deutsch

  Theme                          System (folgt OS)

  KI-Modus                       Vorschlag + Bestätigung

  Filamentpreis PLA              22,00 EUR/kg

  Filamentpreis PETG             25,00 EUR/kg

  Strompreis                     0,35 EUR/kWh

  Druckerleistung                200 Watt

  Etsy Transaktionsgebühr        6,5%

  Etsy Einstellgebühr            0,20 EUR

  eBay Verkäufergebühr           11% (konfigurierbar)

  Kleinanzeigen Gebühr           0 EUR

  Archiv-Aufbewahrung            30 Tage

  DB-Backup-Intervall            Täglich

  Max. DB-Backups                30

  KI-Kostenlimit                 10 EUR/Monat
  ---
