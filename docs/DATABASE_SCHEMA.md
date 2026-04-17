# Datenbank-Schema

PolyGrid Studio Business OS | Konsolidiertes Schema über alle Module | April 2026

Dieses Dokument ist die **Single Source of Truth** für das komplette SQLite-Schema. Alle Tabellen werden in Modul 01 (Foundation) angelegt, auch wenn sie erst in späteren Modulen befüllt werden. Das sichert korrekte FK-Beziehungen von Anfang an.

## Konventionen

- **Primärschlüssel**: `id` TEXT (UUID v4) für alle fachlichen Tabellen
- **Timestamps**: `created_at`, `updated_at` TEXT (ISO 8601) auf allen Tabellen
- **Soft-Delete**: `deleted_at` TEXT (ISO 8601), NULL = aktiv
- **JSON-Felder**: TEXT, validiert über Zod vor Persistierung
- **Booleans**: INTEGER (0/1), in Drizzle als Boolean gemappt
- **Beträge**: REAL in EUR
- **Enums**: TEXT mit Validierung über Zod-Enum

## Tabellen-Übersicht

| Tabelle | Definiert in | Zweck |
|---|---|---|
| `products` | Modul 02 | Produktkatalog |
| `expenses` | Modul 04 | Geschäftsausgaben |
| `file_links` | Modul 03 | Datei-zu-Entität-Verknüpfungen |
| `listings` | Modul 05 | Plattform-Listings |
| `ai_jobs` | Modul 06 | KI-Aufruf-Protokollierung |
| `templates` | Modul 07 | Textvorlagen-Bibliothek |
| `orders` | Modul 08 | Kundenaufträge |
| `tasks` | Modul 09 | Aufgaben |
| `kpi_records` | Modul 10 | KPI-Snapshots |
| `app_settings` | Modul 01 | Key-Value-Einstellungen |

---

## products (Modul 02)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| name | TEXT | Ja | Vollständiger Produktname |
| short_name | TEXT | Nein | Kurzname für Listen |
| category | TEXT | Ja | Hauptkategorie (Deko, Organizer, Gadget etc.) |
| subcategory | TEXT | Nein | Unterkategorie |
| description_internal | TEXT | Nein | Interne Beschreibung und Notizen |
| collection | TEXT | Nein | Kollektion (Minimal, Industrial etc.) |
| status | TEXT | Ja | idea, review, print_ready, test_print, launch_ready, online, paused, discontinued |
| material_type | TEXT | Ja | PLA, PETG, TPU etc. |
| color_variants | TEXT (JSON) | Nein | Array von Farbvarianten |
| print_time_minutes | INTEGER | Nein | Geschätzte Druckzeit in Minuten |
| material_grams | REAL | Nein | Materialverbrauch in Gramm |
| electricity_cost | REAL | Nein | Strom-/Maschinenkosten in EUR |
| packaging_cost | REAL | Nein | Verpackungskosten in EUR |
| shipping_class | TEXT | Nein | Brief, Paket, Warensendung |
| target_price | REAL | Nein | Zielverkaufspreis in EUR |
| min_price | REAL | Nein | Mindestverkaufspreis in EUR |
| estimated_margin | REAL | Nein | Kalkulierte Marge in % (berechnet) |
| license_source | TEXT | Nein | Quelle der STL (Thingiverse, Printables, Eigen) |
| license_type | TEXT | Nein | own, cc_by, cc_by_sa, cc_by_nc, commercial, unclear |
| license_url | TEXT | Nein | Link zur Originaldatei oder Lizenz |
| license_risk | TEXT | Nein | safe, review_needed, risky |
| platforms | TEXT (JSON) | Nein | Array: etsy, ebay, kleinanzeigen |
| notes | TEXT | Nein | Freitextnotizen |
| upsell_notes | TEXT | Nein | Ideen für Upselling |
| created_at | TEXT (ISO) | Ja | Erstellungszeitpunkt |
| updated_at | TEXT (ISO) | Ja | Letzte Änderung |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete Timestamp |

**Indizes**: `status`, `category`, `created_at`

---

## expenses (Modul 04)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| date | TEXT (ISO) | Ja | Datum der Ausgabe |
| amount_gross | REAL | Ja | Bruttobetrag in EUR |
| amount_net | REAL | Nein | Nettobetrag (berechnet wenn leer) |
| tax_amount | REAL | Nein | Steuerbetrag |
| vendor | TEXT | Ja | Händler |
| category | TEXT | Ja | Hauptkategorie |
| subcategory | TEXT | Nein | Unterkategorie |
| payment_method | TEXT | Nein | PayPal, Kreditkarte, Überweisung |
| purpose | TEXT | Nein | Verwendungszweck |
| product_id | TEXT (FK → products.id) | Nein | Referenz auf Produkt |
| receipt_attached | BOOLEAN | Ja | Default: false |
| receipt_file_path | TEXT | Nein | Pfad zur Belegdatei |
| tax_relevant | BOOLEAN | Ja | Default: true |
| recurring | BOOLEAN | Ja | Default: false |
| notes | TEXT | Nein | Freitext |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

**Indizes**: `date`, `category`, `vendor`

**Kategorien-Enum**: Filament, Verpackung, Werkzeuge, Druckerzubehör, Maschinen/Hardware, Software/SaaS, Werbung, Versand, Reisekosten, Büro, Sonstiges

---

## file_links (Modul 03)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| entity_type | TEXT | Ja | product, expense, order, listing |
| entity_id | TEXT | Ja | ID der verknüpften Entität |
| file_path | TEXT | Ja | Relativer Pfad unter OneDrive-Basispfad |
| file_type | TEXT | Ja | stl, slicer, image, mockup, receipt, document, other |
| note | TEXT | Nein | Optionale Notiz |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |

**Indizes**: `(entity_type, entity_id)`, `file_type`

---

## listings (Modul 05)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| product_id | TEXT (FK → products.id) | Ja | Referenz auf Produkt |
| platform | TEXT | Ja | etsy, ebay, kleinanzeigen |
| title | TEXT | Ja | Listing-Titel |
| short_description | TEXT | Nein | Kurzbeschreibung |
| long_description | TEXT | Nein | Ausführliche Beschreibung |
| bullet_points | TEXT (JSON) | Nein | Array von Aufzählungspunkten |
| tags | TEXT (JSON) | Ja | Array von Tags |
| price | REAL | Ja | Listenpreis in EUR |
| variants | TEXT (JSON) | Nein | Array [{name, price}] |
| shipping_info | TEXT | Nein | Versandinfo Freitext |
| processing_time_days | INTEGER | Nein | Bearbeitungszeit |
| status | TEXT | Ja | draft, online, paused, archived |
| language | TEXT | Ja | de, en |
| seo_notes | TEXT | Nein | SEO-Hinweise |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

**Indizes**: `platform`, `status`, `product_id`

---

## ai_jobs (Modul 06)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| provider | TEXT | Ja | claude, openai, ollama |
| model | TEXT | Ja | Modellname (z.B. claude-sonnet-4-20250514) |
| agent | TEXT | Ja | listing_assistant, expense_assistant, product_analyst |
| action | TEXT | Ja | generate_title, classify_expense, etc. |
| input | TEXT | Nein | Input-Prompt (gekürzt) |
| output | TEXT | Nein | Output-Text (gekürzt) |
| tokens_used | INTEGER | Nein | Gesamte Tokens |
| duration_ms | INTEGER | Nein | Dauer in Millisekunden |
| status | TEXT | Ja | success, error, cancelled |
| error_message | TEXT | Nein | Fehlermeldung bei status=error |
| estimated_cost | REAL | Nein | Geschätzte Kosten in EUR |
| created_at | TEXT (ISO) | Ja | |

**Indizes**: `created_at`, `agent`, `status`

---

## templates (Modul 07)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| name | TEXT | Ja | Name der Vorlage |
| category | TEXT | Ja | impressum, widerruf, versand, faq, antwort, kundenservice, beilage, reklamation, sonstiges |
| content | TEXT | Ja | Vorlagentext mit {{variablen}} |
| platforms | TEXT (JSON) | Nein | Plattformen für die die Vorlage gilt |
| variables | TEXT (JSON) | Nein | Liste der Variablen mit Beschreibung |
| version | INTEGER | Ja | Default: 1, automatisch hochgezählt |
| is_legal | BOOLEAN | Ja | Rechtstext ja/nein |
| notes | TEXT | Nein | Interne Notizen |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

**Indizes**: `category`

---

## orders (Modul 08)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| external_order_id | TEXT | Nein | Bestell-ID der Plattform |
| customer_name | TEXT | Nein | Kundenname |
| platform | TEXT | Ja | etsy, ebay, kleinanzeigen, direkt |
| product_id | TEXT (FK → products.id) | Nein | Referenz auf Produkt |
| variant | TEXT | Nein | Gewählte Variante |
| quantity | INTEGER | Ja | Default: 1 |
| sale_price | REAL | Ja | Verkaufspreis EUR |
| shipping_cost | REAL | Nein | Versandkosten |
| material_cost | REAL | Nein | Materialkosten |
| platform_fee | REAL | Nein | Plattformgebühren |
| status | TEXT | Ja | inquiry, quoted, ordered, paid, in_production, ready, shipped, completed, issue, cancelled |
| payment_status | TEXT | Ja | pending, paid, refunded, disputed |
| shipping_status | TEXT | Nein | not_shipped, shipped, delivered, returned |
| tracking_number | TEXT | Nein | Sendungsverfolgungsnummer |
| order_date | TEXT (ISO) | Ja | Bestelldatum |
| notes | TEXT | Nein | Freitext |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

**Indizes**: `status`, `platform`, `order_date`

---

## tasks (Modul 09)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| title | TEXT | Ja | Aufgabentitel |
| description | TEXT | Nein | Beschreibung |
| priority | TEXT | Ja | low, medium, high, urgent |
| status | TEXT | Ja | todo, in_progress, done, cancelled |
| due_date | TEXT (ISO) | Nein | Fälligkeitsdatum |
| product_id | TEXT (FK → products.id) | Nein | Referenz auf Produkt |
| order_id | TEXT (FK → orders.id) | Nein | Referenz auf Auftrag |
| listing_id | TEXT (FK → listings.id) | Nein | Referenz auf Listing |
| recurring_rule | TEXT (JSON) | Nein | `{interval: daily/weekly/monthly, day?: number}` |
| completed_at | TEXT (ISO) | Nein | Abschlusszeitpunkt |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |

**Indizes**: `status`, `priority`, `due_date`

---

## kpi_records (Modul 10)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| period_type | TEXT | Ja | week, month |
| period_start | TEXT (ISO) | Ja | Beginn des Zeitraums |
| period_end | TEXT (ISO) | Ja | Ende des Zeitraums |
| revenue | REAL | Ja | Umsatz in EUR |
| expenses_total | REAL | Ja | Ausgaben in EUR |
| orders_count | INTEGER | Ja | Anzahl Aufträge |
| active_products | INTEGER | Ja | Anzahl aktiver Produkte |
| active_listings | INTEGER | Ja | Anzahl aktiver Listings |
| avg_margin | REAL | Nein | Durchschnittliche Marge in % |
| created_at | TEXT (ISO) | Ja | |

**Indizes**: `(period_type, period_start)`

---

## app_settings (Modul 01)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| key | TEXT | Ja | **Primärschlüssel**, Setting-Key |
| value | TEXT (JSON) | Ja | Wert als JSON-String |
| updated_at | TEXT (ISO) | Ja | Letzte Änderung |

### Settings-Keys (Überblick)

Diese Keys werden über verschiedene Module hinweg verwendet. Die vollständige Settings-UI entsteht in Modul 11.

**Foundation (Modul 01):**
- `theme`: `"light"` | `"dark"` | `"system"` (Default: `"system"`)
- `accent_color`: `"sap_blue"` | `"indigo"` | `"petrol"` | `"orange"` | `"violet"` | `"graphite"` | Custom Hex (Default: `"sap_blue"`)
- `sidebar_collapsed`: boolean (Default: `false`)

**Allgemein (Modul 11):**
- `company_name`: String
- `date_format`: `"DD.MM.YYYY"` | `"YYYY-MM-DD"`
- `language`: `"de"` | `"en"`

**OneDrive (Modul 03):**
- `onedrive_base_path`: String (absoluter Pfad)

**Material & Plattform (Modul 02, 11):**
- `filament_prices`: `{ "PLA": 22, "PETG": 25, ... }`
- `platform_fees`: `{ "etsy": { "percent": 6.5, "fixed": 0.20 }, "ebay": { "percent": 11, "fixed": 0 } }`
- `shipping_classes`: Array `[{ name, price }]`
- `printer_power_watts`: Number (Default: 200)
- `electricity_price_per_kwh`: Number (Default: 0.35)
- `color_variants_library`: Array `[{ name, hex }]`

**KI (Modul 06, 11):**
- `ai_preferred_provider`: `"claude"` | `"openai"` | `"ollama"`
- `ai_monthly_limit_eur`: Number (Default: 10)
- `ai_logging_enabled`: boolean (Default: true)
- `ai_mode`: `"suggest_only"` | `"suggest_confirm"` (MVP: immer `suggest_confirm`)
- `ai_ollama_endpoint`: String (Default: `"http://localhost:11434"`)
- **API-Keys werden NICHT hier gespeichert**, sondern im OS-Keychain.

**Markenstil (Modul 06, 11):**
- `brand_writing_style`: `"sachlich-minimalistisch"` | `"technisch-präzise"` | `"freundlich-professionell"`
- `brand_preferred_words`: Array<String>
- `brand_forbidden_phrases`: Array<String>
- `brand_reference_text`: String

**Sicherheit (Modul 11):**
- `backup_interval_hours`: Number (Default: 24)
- `backup_max_count`: Number (Default: 30)
- `archive_retention_days`: Number (Default: 30)

---

## FK-Beziehungen (Übersicht)

```
products ←── expenses.product_id (optional)
         ←── listings.product_id (pflicht)
         ←── orders.product_id (optional)
         ←── tasks.product_id (optional)

orders   ←── tasks.order_id (optional)

listings ←── tasks.listing_id (optional)

file_links: polymorph via (entity_type, entity_id) → products/expenses/orders/listings
```

**Hinweis zur Löschstrategie**: Da alle Entitäten Soft-Delete verwenden (`deleted_at`), werden FK-Referenzen nicht gebrochen. Queries müssen aktive Einträge selbst filtern (`WHERE deleted_at IS NULL`).
