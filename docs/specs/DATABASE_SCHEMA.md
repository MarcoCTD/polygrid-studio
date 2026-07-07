# Datenbank-Schema

PolyGrid Studio Business OS | Konsolidiertes Schema über alle Module | Juli 2026 | Version 1.5

> **Änderungen in v1.5 gegenüber v1.4:**
>
> - Modul 15 (Verkaufszahlen und Smart Actions): keine neuen Tabellen, keine Migrationsänderungen
> - Neuer Settings-Key `smart_action_snoozes` (Smart Actions, Modul 15)
> - Verkaufszahlen werden live aus `orders` aggregiert (salesStatsService), kein persistiertes Schema

> **Änderungen in v1.4 gegenüber v1.3:**
>
> - Modul 10 als abgeschlossen markiert, Modul 11 als aktiv
> - Settings-Keys um fehlende Modul-11-Keys ergänzt: `backup_directory`, `last_backup_at`
> - Klarstellung: `app_settings` Tabelle bleibt Key-Value-basiert, kein neues Schema nötig für Modul 11
> - Hinweis: API-Keys und OAuth-Tokens werden NICHT in `app_settings` gespeichert, sondern im OS-Keychain (Tauri `keyring` Crate). Settings-UI liest/schreibt über dedizierte Tauri-Commands.

Dieses Dokument ist die **Single Source of Truth** für das komplette SQLite-Schema. Alle Tabellen werden in Modul 01 (Foundation) angelegt, auch wenn sie erst in späteren Modulen befüllt werden. Das sichert korrekte FK-Beziehungen von Anfang an.

## Konventionen

- **Primärschlüssel**: `id` TEXT (UUID v4) für alle fachlichen Tabellen
- **Timestamps**: `created_at`, `updated_at` TEXT (ISO 8601) auf allen Tabellen
- **Soft-Delete**: `deleted_at` TEXT (ISO 8601), NULL = aktiv
- **JSON-Felder**: TEXT, validiert über Zod vor Persistierung
- **Booleans**: INTEGER (0/1), in Drizzle als Boolean gemappt
- **Beträge**: REAL in EUR
- **Enums**: TEXT mit Validierung über Zod-Enum
- **Tax-Lock**: Boolean-Flag auf steuerrelevanten Tabellen (`orders`, `expenses`). Locked Datensätze sind schreibgeschützt.

## Tabellen-Übersicht

| Tabelle               | Definiert in | Zweck                                            |
| --------------------- | ------------ | ------------------------------------------------ |
| `products`            | Modul 02     | Produktkatalog                                   |
| `expenses`            | Modul 04     | Geschäftsausgaben                                |
| `file_links`          | Modul 03     | Datei-zu-Entität-Verknüpfungen                   |
| `listings`            | Modul 05     | Plattform-Listings                               |
| `ai_jobs`             | Modul 06     | KI-Aufruf-Protokollierung                        |
| `templates`           | Modul 07     | Textvorlagen-Bibliothek                          |
| `orders`              | Modul 08     | Kundenaufträge                                   |
| `bank_transactions`   | Modul 08     | Importierte Banktransaktionen (N26)              |
| `import_batches`      | Modul 08     | Audit-Trail für CSV-Imports                      |
| `bank_payout_orders`  | Modul 08     | Junction für Sammelauszahlungen (n:m)            |
| `tasks`               | Modul 09     | Aufgaben                                         |
| `kpi_records`         | Modul 10     | KPI-Snapshots                                    |
| `app_settings`        | Modul 01     | Key-Value-Einstellungen                          |

---

## products (Modul 02)

| Feld                      | Typ         | Pflicht | Beschreibung                                                                                                  |
| ------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| id                        | TEXT (UUID) | Ja      | Primärschlüssel                                                                                              |
| name                      | TEXT        | Ja      | Vollständiger Produktname                                                                                    |
| short_name                | TEXT        | Nein    | Kurzname für Listen                                                                                          |
| category                  | TEXT        | Ja      | Hauptkategorie (Deko, Organizer, Gadget etc.)                                                                |
| subcategory               | TEXT        | Nein    | Unterkategorie                                                                                               |
| description_internal      | TEXT        | Nein    | Interne Beschreibung und Notizen                                                                             |
| collection                | TEXT        | Nein    | Kollektion (Minimal, Industrial etc.)                                                                        |
| status                    | TEXT        | Ja      | idea, review, print_ready, test_print, launch_ready, online, paused, discontinued                            |
| material_type             | TEXT        | Ja      | PLA, PETG, TPU etc.                                                                                          |
| color_variants            | TEXT (JSON) | Nein    | Array von Farbvarianten `[{name, hex}]`                                                                      |
| print_time_minutes        | INTEGER     | Nein    | Geschätzte Druckzeit in Minuten                                                                              |
| material_grams            | REAL        | Nein    | Materialverbrauch in Gramm                                                                                   |
| electricity_cost          | REAL        | Nein    | Strom-/Maschinenkosten in EUR                                                                                |
| packaging_cost            | REAL        | Nein    | Verpackungskosten in EUR                                                                                     |
| shipping_class            | TEXT        | Nein    | Brief, Paket, Warensendung                                                                                   |
| target_price              | REAL        | Nein    | Zielverkaufspreis in EUR                                                                                     |
| min_price                 | REAL        | Nein    | Mindestverkaufspreis in EUR                                                                                  |
| price_etsy                | REAL        | Nein    | Plattform-spezifischer Etsy-Preis                                                                            |
| price_ebay                | REAL        | Nein    | Plattform-spezifischer eBay-Preis                                                                            |
| price_kleinanzeigen       | REAL        | Nein    | Plattform-spezifischer Kleinanzeigen-Preis                                                                   |
| estimated_margin          | REAL        | Nein    | Kalkulierte Marge in % (berechnet)                                                                           |
| license_source            | TEXT        | Nein    | Quelle der STL (Thingiverse, Printables, Eigen)                                                              |
| license_type              | TEXT        | Nein    | own, cc_by, cc_by_sa, cc_by_nc, commercial, unclear                                                          |
| license_url               | TEXT        | Nein    | Link zur Originaldatei oder Lizenz                                                                           |
| license_risk              | TEXT        | Nein    | safe, review_needed, risky                                                                                   |
| platforms                 | TEXT (JSON) | Nein    | Array: etsy, ebay, kleinanzeigen                                                                             |
| notes                     | TEXT        | Nein    | Freitextnotizen                                                                                              |
| upsell_notes              | TEXT        | Nein    | Ideen für Upselling                                                                                          |
| primary_image_path        | TEXT        | Nein    | Pfad zum Produktbild                                                                                         |
| shipping_paid_by_customer | BOOLEAN     | Nein    | NULL = globaler Default; TRUE = Käufer zahlt; FALSE = wir zahlen (Versand in Marge)                          |
| created_at                | TEXT (ISO)  | Ja      | Erstellungszeitpunkt                                                                                         |
| updated_at                | TEXT (ISO)  | Ja      | Letzte Änderung                                                                                              |
| deleted_at                | TEXT (ISO)  | Nein    | Soft-Delete Timestamp                                                                                        |

**Indizes**: `status`, `category`, `created_at`

---

## expenses (Modul 04, erweitert in Modul 08)

| Feld               | Typ                     | Pflicht | Beschreibung                                                |
| ------------------ | ----------------------- | ------- | ----------------------------------------------------------- |
| id                 | TEXT (UUID)             | Ja      | Primärschlüssel                                            |
| date               | TEXT (ISO)              | Ja      | Datum der Ausgabe                                           |
| amount_gross       | REAL                    | Ja      | Bruttobetrag in EUR (= netto bei Kleinunternehmer)          |
| amount_net         | REAL                    | Nein    | Nettobetrag (NULL bei Kleinunternehmer)                     |
| tax_amount         | REAL                    | Nein    | Steuerbetrag (NULL bei Kleinunternehmer)                    |
| vendor             | TEXT                    | Ja      | Händler                                                     |
| category           | TEXT                    | Ja      | Hauptkategorie                                              |
| subcategory        | TEXT                    | Nein    | Unterkategorie                                              |
| payment_method     | TEXT                    | Nein    | PayPal, Kreditkarte, Überweisung                            |
| purpose            | TEXT                    | Nein    | Verwendungszweck                                            |
| product_id         | TEXT (FK → products.id) | Nein    | Referenz auf Produkt                                        |
| receipt_attached   | BOOLEAN                 | Ja      | Default: false                                              |
| receipt_file_path  | TEXT                    | Nein    | Pfad zur Belegdatei                                         |
| tax_relevant       | BOOLEAN                 | Ja      | Default: true                                               |
| recurring          | BOOLEAN                 | Ja      | Default: false                                              |
| tax_locked         | BOOLEAN                 | Ja      | Default false. True nach EÜR-Export                         |
| bank_match_id      | TEXT (FK → bank_transactions.id) | Nein | Verknüpfung zur Banktransaktion                      |
| notes              | TEXT                    | Nein    | Freitext                                                    |
| created_at         | TEXT (ISO)              | Ja      |                                                             |
| updated_at         | TEXT (ISO)              | Ja      |                                                             |
| deleted_at         | TEXT (ISO)              | Nein    | Soft-Delete (nur bei tax_locked = false erlaubt)            |

**Indizes**: `date`, `category`, `vendor`, `tax_locked`

**Kategorien-Enum**: Filament, Verpackung, Werkzeuge, Druckerzubehör, Maschinen/Hardware, Software/SaaS, Werbung, Versand, Reisekosten, Büro, Sonstiges

---

## file_links (Modul 03)

| Feld        | Typ         | Pflicht | Beschreibung                                          |
| ----------- | ----------- | ------- | ----------------------------------------------------- |
| id          | TEXT (UUID) | Ja      | Primärschlüssel                                      |
| entity_type | TEXT        | Ja      | product, expense, order, listing                      |
| entity_id   | TEXT        | Ja      | ID der verknüpften Entität                            |
| file_path   | TEXT        | Ja      | Relativer Pfad unter OneDrive-Basispfad               |
| file_type   | TEXT        | Ja      | stl, slicer, image, mockup, receipt, document, other  |
| note        | TEXT        | Nein    | Optionale Notiz                                       |
| created_at  | TEXT (ISO)  | Ja      |                                                       |
| updated_at  | TEXT (ISO)  | Ja      |                                                       |

**Indizes**: `(entity_type, entity_id)`, `file_type`

---

## listings (Modul 05)

| Feld                 | Typ                     | Pflicht | Beschreibung                          |
| -------------------- | ----------------------- | ------- | ------------------------------------- |
| id                   | TEXT (UUID)             | Ja      | Primärschlüssel                      |
| product_id           | TEXT (FK → products.id) | Ja      | Referenz auf Produkt                  |
| platform             | TEXT                    | Ja      | etsy, ebay, kleinanzeigen             |
| title                | TEXT                    | Ja      | Listing-Titel                         |
| short_description    | TEXT                    | Nein    | Kurzbeschreibung                      |
| long_description     | TEXT                    | Nein    | Ausführliche Beschreibung             |
| bullet_points        | TEXT (JSON)             | Nein    | Array von Aufzählungspunkten          |
| tags                 | TEXT (JSON)             | Ja      | Array von Tags                        |
| price                | REAL                    | Ja      | Listenpreis in EUR                    |
| variants             | TEXT (JSON)             | Nein    | Array [{name, price}]                 |
| shipping_info        | TEXT                    | Nein    | Versandinfo Freitext                  |
| processing_time_days | INTEGER                 | Nein    | Bearbeitungszeit                      |
| status               | TEXT                    | Ja      | draft, online, paused, archived       |
| language             | TEXT                    | Ja      | de, en                                |
| seo_notes            | TEXT                    | Nein    | SEO-Hinweise                          |
| created_at           | TEXT (ISO)              | Ja      |                                       |
| updated_at           | TEXT (ISO)              | Ja      |                                       |
| deleted_at           | TEXT (ISO)              | Nein    | Soft-Delete                           |

**Indizes**: `platform`, `status`, `product_id`

---

## ai_jobs (Modul 06)

| Feld           | Typ         | Pflicht | Beschreibung                                          |
| -------------- | ----------- | ------- | ----------------------------------------------------- |
| id             | TEXT (UUID) | Ja      | Primärschlüssel                                      |
| provider       | TEXT        | Ja      | claude, openai, ollama                                |
| model          | TEXT        | Ja      | Modellname (z.B. claude-sonnet-4-20250514)            |
| agent          | TEXT        | Ja      | listing_assistant, expense_assistant, product_analyst, task_extractor, template_assistant |
| action         | TEXT        | Ja      | generate_title, classify_expense, extract_tasks, rewrite_template, etc. |
| input          | TEXT        | Nein    | Input-Prompt (gekürzt)                                |
| output         | TEXT        | Nein    | Output-Text (gekürzt)                                 |
| tokens_used    | INTEGER     | Nein    | Gesamte Tokens                                        |
| duration_ms    | INTEGER     | Nein    | Dauer in Millisekunden                                |
| status         | TEXT        | Ja      | success, error, cancelled                             |
| error_message  | TEXT        | Nein    | Fehlermeldung bei status=error                        |
| estimated_cost | REAL        | Nein    | Geschätzte Kosten in EUR                              |
| created_at     | TEXT (ISO)  | Ja      |                                                       |

**Indizes**: `created_at`, `agent`, `status`

**Hinweis**: `agent`-Enum erweitert in Modul 07 um `template_assistant`, in Modul 09 um `task_extractor`.

---

## templates (Modul 07)

| Feld       | Typ         | Pflicht | Beschreibung                                                                                  |
| ---------- | ----------- | ------- | --------------------------------------------------------------------------------------------- |
| id         | TEXT (UUID) | Ja      | Primärschlüssel                                                                              |
| name       | TEXT        | Ja      | Name der Vorlage                                                                              |
| category   | TEXT        | Ja      | impressum, widerruf, versand, faq, antwort, kundenservice, beilage, reklamation, sonstiges    |
| content    | TEXT        | Ja      | Vorlagentext mit {{variablen}}                                                                |
| platforms  | TEXT (JSON) | Nein    | Plattformen für die die Vorlage gilt                                                          |
| variables  | TEXT (JSON) | Nein    | Liste der Variablen mit Beschreibung                                                          |
| version    | INTEGER     | Ja      | Default: 1, automatisch hochgezählt                                                           |
| is_legal   | BOOLEAN     | Ja      | Rechtstext ja/nein                                                                            |
| notes      | TEXT        | Nein    | Interne Notizen                                                                               |
| created_at | TEXT (ISO)  | Ja      |                                                                                               |
| updated_at | TEXT (ISO)  | Ja      |                                                                                               |
| deleted_at | TEXT (ISO)  | Nein    | Soft-Delete                                                                                   |

**Indizes**: `category`

---

## orders (Modul 08, erweitert)

| Feld                  | Typ                                  | Pflicht | Beschreibung                                                                |
| --------------------- | ------------------------------------ | ------- | --------------------------------------------------------------------------- |
| id                    | TEXT (UUID)                          | Ja      | Primärschlüssel                                                            |
| receipt_number        | TEXT                                 | Ja      | Auto-generiert `JAHR-LFD` (z.B. `2026-0042`), unique                       |
| external_order_id     | TEXT                                 | Nein    | Bestell-ID der Plattform                                                    |
| customer_name         | TEXT                                 | Nein    | Kundenname                                                                  |
| platform              | TEXT                                 | Ja      | etsy, ebay, kleinanzeigen, direkt                                           |
| product_id            | TEXT (FK → products.id)              | Nein    | Referenz auf Produkt                                                        |
| variant               | TEXT                                 | Nein    | Gewählte Variante                                                           |
| quantity              | INTEGER                              | Ja      | Default: 1                                                                  |
| sale_price            | REAL                                 | Ja      | Verkaufspreis EUR (brutto = netto bei Kleinunternehmer)                     |
| shipping_revenue      | REAL                                 | Nein    | Vom Kunden gezahlte Versandkosten                                           |
| shipping_cost         | REAL                                 | Nein    | Tatsächliche Versandkosten (DHL, Hermes etc.)                               |
| material_cost         | REAL                                 | Nein    | Materialkosten                                                              |
| platform_fee          | REAL                                 | Nein    | Plattformgebühren                                                           |
| payout_amount         | REAL                                 | Nein    | Netto-Auszahlung der Plattform                                              |
| status                | TEXT                                 | Ja      | inquiry, ordered, paid, in_production, shipped, completed, issue, cancelled |
| payment_status        | TEXT                                 | Ja      | pending, paid, refunded, disputed                                           |
| payment_received_date | TEXT (ISO)                           | Nein    | Zuflussdatum für EÜR (§11 EStG)                                            |
| shipping_status       | TEXT                                 | Nein    | not_shipped, shipped, delivered, returned                                   |
| tracking_number       | TEXT                                 | Nein    | Sendungsverfolgungsnummer                                                   |
| order_date            | TEXT (ISO)                           | Ja      | Bestelldatum                                                                |
| notes                 | TEXT                                 | Nein    | Freitext                                                                    |
| tax_locked            | BOOLEAN                              | Ja      | Default false. True nach EÜR-Export                                         |
| bank_match_id         | TEXT (FK → bank_transactions.id)     | Nein    | Verknüpfung zur Banktransaktion (1:1)                                       |
| created_at            | TEXT (ISO)                           | Ja      |                                                                             |
| updated_at            | TEXT (ISO)                           | Ja      |                                                                             |
| deleted_at            | TEXT (ISO)                           | Nein    | Soft-Delete (nur bei tax_locked = false erlaubt)                            |

**Indizes**: `status`, `platform`, `order_date`, `payment_received_date`, `receipt_number` (unique), `tax_locked`

---

## bank_transactions (Modul 08)

Importierte Banktransaktionen aus N26-CSV-Export.

| Feld                | Typ                              | Pflicht | Beschreibung                                                |
| ------------------- | -------------------------------- | ------- | ----------------------------------------------------------- |
| id                  | TEXT (UUID)                      | Ja      | Primärschlüssel                                            |
| transaction_date    | TEXT (ISO)                       | Ja      | Buchungsdatum                                               |
| value_date          | TEXT (ISO)                       | Nein    | Wertstellungsdatum                                          |
| amount              | REAL                             | Ja      | Positiv = Eingang, negativ = Ausgang                        |
| description         | TEXT                             | Ja      | Verwendungszweck                                            |
| counterparty_name   | TEXT                             | Nein    | Absender/Empfänger                                          |
| counterparty_iban   | TEXT                             | Nein    | IBAN der Gegenseite                                         |
| transaction_type    | TEXT                             | Nein    | N26-Kategorie (z.B. "MasterCard Payment")                   |
| matched_order_id    | TEXT (FK → orders.id)            | Nein    | Verknüpfter Auftrag (bei 1:1-Match)                         |
| matched_expense_id  | TEXT (FK → expenses.id)          | Nein    | Verknüpfte Ausgabe                                          |
| match_confidence    | TEXT                             | Nein    | high, medium, low, manual, unmatched                        |
| is_payout           | BOOLEAN                          | Ja      | Default: false. True bei Plattform-Sammelauszahlung         |
| import_batch_id     | TEXT (FK → import_batches.id)    | Ja      | UUID des Import-Laufs                                       |
| ignored             | BOOLEAN                          | Ja      | Default: false. Manuell als irrelevant markiert             |
| notes               | TEXT                             | Nein    | Freitext                                                    |
| created_at          | TEXT (ISO)                       | Ja      |                                                             |

**Indizes**: `transaction_date`, `amount`, `import_batch_id`, `match_confidence`, `is_payout`

---

## import_batches (Modul 08)

Audit-Trail für CSV-Imports (N26 und zukünftige Quellen).

| Feld              | Typ         | Pflicht | Beschreibung                  |
| ----------------- | ----------- | ------- | ----------------------------- |
| id                | TEXT (UUID) | Ja      | Primärschlüssel              |
| source            | TEXT        | Ja      | n26, manual, future-api       |
| imported_at       | TEXT (ISO)  | Ja      | Zeitpunkt des Imports         |
| filename          | TEXT        | Nein    | Original-CSV-Dateiname        |
| transaction_count | INTEGER     | Ja      | Anzahl importierter Zeilen    |
| matched_count     | INTEGER     | Ja      | Anzahl Auto-Matches           |
| date_range_start  | TEXT (ISO)  | Nein    | Frühestes Datum im Import     |
| date_range_end    | TEXT (ISO)  | Nein    | Spätestes Datum im Import     |

**Indizes**: `imported_at`, `source`

---

## bank_payout_orders (Modul 08)

Junction-Tabelle für Sammelauszahlungen. Eine Banktransaktion (Plattform-Auszahlung) kann sich auf mehrere Aufträge beziehen.

| Feld                | Typ                                      | Pflicht | Beschreibung                            |
| ------------------- | ---------------------------------------- | ------- | --------------------------------------- |
| id                  | TEXT (UUID)                              | Ja      | Primärschlüssel                        |
| bank_transaction_id | TEXT (FK → bank_transactions.id)         | Ja      | Banktransaktion (Sammelauszahlung)      |
| order_id            | TEXT (FK → orders.id)                    | Ja      | Verknüpfter Auftrag                     |
| allocated_amount    | REAL                                     | Ja      | Zugeordneter Anteil dieser Auszahlung   |
| created_at          | TEXT (ISO)                               | Ja      |                                         |

**Indizes**: `bank_transaction_id`, `order_id`, `(bank_transaction_id, order_id)` (unique)

---

## tasks (Modul 09, erweitert in v1.2)

| Feld           | Typ                     | Pflicht | Beschreibung                                                  |
| -------------- | ----------------------- | ------- | ------------------------------------------------------------- |
| id             | TEXT (UUID)             | Ja      | Primärschlüssel                                              |
| title          | TEXT                    | Ja      | Aufgabentitel                                                 |
| description    | TEXT                    | Nein    | Beschreibung                                                  |
| priority       | TEXT                    | Ja      | low, medium, high, urgent                                     |
| status         | TEXT                    | Ja      | todo, in_progress, done, cancelled                            |
| due_date       | TEXT (ISO)              | Nein    | Fälligkeitsdatum (nur Datum, YYYY-MM-DD)                      |
| product_id     | TEXT (FK → products.id) | Nein    | Referenz auf Produkt                                          |
| order_id       | TEXT (FK → orders.id)   | Nein    | Referenz auf Auftrag                                          |
| listing_id     | TEXT (FK → listings.id) | Nein    | Referenz auf Listing                                          |
| recurring_rule | TEXT (JSON)             | Nein    | `{interval: "daily"|"weekly"|"monthly", day?: number}`        |
| parent_task_id | TEXT (FK → tasks.id)    | Nein    | Eltern-Aufgabe bei wiederkehrenden Tasks                      |
| completed_at   | TEXT (ISO)              | Nein    | Abschlusszeitpunkt                                            |
| created_at     | TEXT (ISO)              | Ja      |                                                               |
| updated_at     | TEXT (ISO)              | Ja      |                                                               |
| deleted_at     | TEXT (ISO)              | Nein    | Soft-Delete Timestamp                                         |

**Indizes**: `status`, `priority`, `due_date`, `parent_task_id`

---

## kpi_records (Modul 10, erweitert in v1.3)

| Feld                 | Typ         | Pflicht | Beschreibung                                          |
| -------------------- | ----------- | ------- | ----------------------------------------------------- |
| id                   | TEXT (UUID) | Ja      | Primärschlüssel                                      |
| period_type          | TEXT        | Ja      | week, month                                           |
| period_start         | TEXT (ISO)  | Ja      | Beginn des Zeitraums (YYYY-MM-DD)                     |
| period_end           | TEXT (ISO)  | Ja      | Ende des Zeitraums (YYYY-MM-DD)                       |
| revenue              | REAL        | Ja      | Umsatz in EUR (Summe sale_price completed Orders)     |
| expenses_total       | REAL        | Ja      | Ausgaben in EUR                                       |
| orders_count         | INTEGER     | Ja      | Anzahl abgeschlossener Aufträge im Zeitraum           |
| open_orders          | INTEGER     | Ja      | Anzahl offener Aufträge zum Stichtag period_end       |
| open_tasks           | INTEGER     | Ja      | Anzahl offener Tasks zum Stichtag period_end          |
| completed_orders     | INTEGER     | Ja      | Anzahl in diesem Zeitraum abgeschlossener Aufträge    |
| active_products      | INTEGER     | Ja      | Anzahl aktiver Produkte (status=online)               |
| active_listings      | INTEGER     | Ja      | Anzahl aktiver Listings (status=online)               |
| avg_margin           | REAL        | Nein    | Durchschnittliche Marge in %                          |
| revenue_by_platform  | TEXT (JSON) | Nein    | `{"etsy": 150.00, "ebay": 80.00, "direkt": 20.00}`   |
| expenses_by_category | TEXT (JSON) | Nein    | `{"Filament": 45.00, "Verpackung": 12.00, ...}`      |
| created_at           | TEXT (ISO)  | Ja      |                                                       |

**Indizes**: `(period_type, period_start)` (unique)

---

## app_settings (Modul 01)

| Feld       | Typ         | Pflicht | Beschreibung                       |
| ---------- | ----------- | ------- | ---------------------------------- |
| key        | TEXT        | Ja      | **Primärschlüssel**, Setting-Key  |
| value      | TEXT (JSON) | Ja      | Wert als JSON-String               |
| updated_at | TEXT (ISO)  | Ja      | Letzte Änderung                    |

### Settings-Keys (Überblick)

Diese Keys werden über verschiedene Module hinweg verwendet. Die vollständige Settings-UI entsteht in Modul 11.

**Foundation (Modul 01):**

- `theme`: `"light"` | `"dark"` | `"system"` (Default: `"system"`)
- `accent_color`: `"sap_blue"` | `"indigo"` | `"petrol"` | `"orange"` | `"violet"` | `"graphite"` | Custom Hex (Default: `"sap_blue"`)
- `sidebar_collapsed`: boolean (Default: `false`)

**Allgemein (Modul 11):**

- `company_name`: String (Default: `"PolyGrid Studio"`)
- `date_format`: `"DD.MM.YYYY"` | `"YYYY-MM-DD"` (Default: `"DD.MM.YYYY"`)
- `language`: `"de"` | `"en"` (Default: `"de"`)

**OneDrive (Modul 03):**

- `onedrive_base_path`: String (absoluter Pfad)

**Material & Plattform (Modul 02, 11):**

- `filament_prices`: `{ "PLA": 22, "PETG": 25, ... }`
- `platform_fees`: `{ "etsy": { "percent": 6.5, "fixed": 0.20 }, "ebay": { "percent": 11, "fixed": 0 }, "kleinanzeigen": { "percent": 0, "fixed": 0 } }`
- `shipping_classes`: Array `[{ name, price }]` (Default: `[{"name": "Brief", "price": 1.60}, {"name": "Warensendung", "price": 2.25}, {"name": "Päckchen S", "price": 3.99}, {"name": "Paket", "price": 6.99}]`)
- `printer_power_watts`: Number (Default: 200)
- `electricity_price_per_kwh`: Number (Default: 0.35)
- `shipping_paid_by_customer_default`: Boolean (Default: true)
- `color_variants_library`: Array `[{ name, hex }]` (Default: `[]`)

**KI (Modul 06, 11):**

- `ai_preferred_provider`: `"claude"` | `"openai"` | `"ollama"` (Default: `"claude"`)
- `ai_preferred_model_claude`: String (Default: `"claude-sonnet-4-20250514"`)
- `ai_preferred_model_openai`: String (Default: `"gpt-4o"`)
- `ai_preferred_model_ollama`: String (Default: `"llama3"`)
- `ai_monthly_limit_eur`: Number (Default: 10)
- `ai_logging_enabled`: boolean (Default: true)
- `ai_mode`: `"suggest_only"` | `"suggest_confirm"` (MVP: immer `suggest_confirm`)
- `ai_ollama_endpoint`: String (Default: `"http://localhost:11434"`)
- **API-Keys werden NICHT hier gespeichert**, sondern im OS-Keychain (Tauri `keyring` Crate).

**Markenstil (Modul 06, 11):**

- `brand_writing_style`: `"sachlich-minimalistisch"` | `"technisch-präzise"` | `"freundlich-professionell"` (Default: `"sachlich-minimalistisch"`)
- `brand_preferred_words`: Array\<String\> (Default: `[]`)
- `brand_forbidden_phrases`: Array\<String\> (Default: `[]`)
- `brand_reference_text`: String (Default: `""`)

**Aufträge & Finanzen (Modul 08):**

- `receipt_number_prefix_format`: String (Default: `"YYYY-NNNN"`)
- `receipt_number_min_digits`: Number (Default: 4)
- `tax_lock_default_for_yearly_export`: Boolean (Default: true)
- `tax_lock_default_for_monthly_export`: Boolean (Default: false)
- `tax_status`: `"kleinunternehmer_19_ustg"` | `"regelbesteuert"` (Default: `"kleinunternehmer_19_ustg"`)
- `bank_csv_format_default`: `"n26"` | `"custom"` (Default: `"n26"`)
- `bank_match_amount_tolerance_eur`: Number (Default: 0.02)
- `bank_match_time_window_days_orders`: Number (Default: 14)
- `bank_match_time_window_days_expenses`: Number (Default: 7)
- `payout_keywords_etsy`: Array\<String\> (Default: `["Etsy", "Etsy Ireland", "Etsy Inc"]`)
- `payout_keywords_ebay`: Array\<String\> (Default: `["eBay", "Ebay Marketplaces"]`)

**Dashboard (Modul 10):**

- `dashboard_kpi_snapshot_auto`: Boolean (Default: true)
- `dashboard_low_margin_threshold`: Number (Default: 30)

**Smart Actions (Modul 15):**

- `smart_action_snoozes`: JSON-Objekt `{ "<ruleId>": { "until": "<ISO>", "count": <Zahl> } }` (Default: `{}`). Verworfene Smart-Action-Karten mit Ablaufdatum (+7 Tage) und Count beim Verwerfen; Karte kehrt bei Ablauf oder gestiegenem Count zurück.

**Sicherheit & Backup (Modul 11):**

- `backup_interval_hours`: Number (Default: 24)
- `backup_max_count`: Number (Default: 30)
- `backup_directory`: String (Default: leer, wird auf Tauri App-Datenverzeichnis + `/backups` gesetzt)
- `last_backup_at`: String ISO (Default: `""`, wird nach jedem Backup aktualisiert)
- `archive_retention_days`: Number (Default: 30)

---

## FK-Beziehungen (Übersicht)

```
products ←── expenses.product_id (optional)
         ←── listings.product_id (pflicht)
         ←── orders.product_id (optional)
         ←── tasks.product_id (optional)

orders   ←── tasks.order_id (optional)
         ←── bank_payout_orders.order_id (n:m via junction)

listings ←── tasks.listing_id (optional)

tasks    ←── tasks.parent_task_id (optional, self-referencing für Recurring-Verlauf)

bank_transactions ←── orders.bank_match_id (optional, 1:1)
                  ←── expenses.bank_match_id (optional, 1:1)
                  ←── bank_payout_orders.bank_transaction_id (n:m via junction)

import_batches ←── bank_transactions.import_batch_id (pflicht)

file_links: polymorph via (entity_type, entity_id) → products/expenses/orders/listings
```

**Hinweis zur Löschstrategie**: Da alle fachlichen Entitäten Soft-Delete verwenden (`deleted_at`), werden FK-Referenzen nicht gebrochen. Queries müssen aktive Einträge selbst filtern (`WHERE deleted_at IS NULL`).

**Hinweis zum Tax-Lock**: Locked Datensätze (`tax_locked = true`) auf `orders` und `expenses` sind schreibgeschützt:

- UPDATE auf andere Felder als `notes` und `bank_match_id`: blockiert
- Soft-Delete (`deleted_at` setzen): blockiert
- Hard-Delete: blockiert
- Statusänderung auf `cancelled` (Storno): erlaubt, plus Anlage einer Gegenbuchung als neuer Datensatz

Diese Validierung erfolgt in der Service-Layer (Drizzle-Wrapper) und im Frontend (UI-Sperre).
