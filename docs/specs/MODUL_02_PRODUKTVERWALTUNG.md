# Modul 02: Produktverwaltung

**PolyGrid Studio Business OS**

| | |
|---|---|
| **Status** | In Planung (Spec finalisiert) |
| **Version** | 2.0 (abgeleitet von Original-Spec v1.0, April 2026) |
| **Vorgänger** | Modul 01 Foundation (abgeschlossen) |
| **Nachfolger** | Modul 03 Dateimanager |

---

## Hinweis zu dieser Version

Diese `.md`-Datei ersetzt die ursprüngliche `MODUL_02_PRODUKTVERWALTUNG.docx`. Sie übernimmt alle fachlichen Anforderungen der Original-Spec und ergänzt sie um Entscheidungen, die in der Planungsphase getroffen wurden.

**Wichtige Abweichungen gegenüber der Original-Spec:**

1. **Bearbeitung per Full-Screen-Route** statt im 400px-Detail-Panel (Abschnitt 3.3)
2. **Auto-Save debounced** statt expliziter Speichern-Button (Abschnitt 3.4)
3. **Plattform-spezifische Preise** zusätzlich zu Zielpreis/Mindestpreis (Abschnitt 2.1)
4. **High-End-Features** in Phase E (Abschnitt 7)
5. **Soft-Delete mit Papierkorb-Route** zusätzlich zum Liste-Toggle (Abschnitt 5.2)
6. **Vorab-Notizen für Modul 03 und Modul 05 und Modul 11** am Ende dieses Dokuments (Abschnitt 10)

Bei Widersprüchen gilt diese Datei, nicht die Original-docx.

---

## 1. Scope und Ziel

Dieses Modul implementiert die vollständige Produktverwaltung auf Basis des Foundation-Moduls. Nach Abschluss können Produkte angelegt, bearbeitet, gefiltert, dupliziert und in ihrer Profitabilität analysiert werden. Bulk-Aktionen, gespeicherte Filter und CSV-Export sind Teil des Scopes.

### 1.1 Lieferergebnisse

- Produktliste mit TanStack Table (Sortierung, Filter, Volltextsuche, Virtualisierung)
- Tastatur-Navigation (J/K, Enter, Escape) in der Liste
- Bulk-Aktionen (mehrere Produkte markieren, Status-Change, Soft-Delete)
- Column-Settings (Spalten ein-/ausblenden, Reihenfolge ändern, persistiert)
- Gespeicherte Filter (benannte Filter-Sets)
- CSV-Export der Produktliste (vollständig oder gefiltert)
- Full-Screen-Bearbeitungsseite unter `/products/:id` mit Tabs: Übersicht, Dateien (Platzhalter), Listings (Platzhalter), Kosten, KI (Platzhalter)
- Auto-Save debounced (800 ms) mit Save-Indicator
- Neues-Produkt-Modal (4-stufig: Basics, Kosten, Lizenz, Übersicht)
- Produkt-Duplizieren
- Margenrechner mit Echtzeit-Berechnung, Ampel-System und Plattform-Toggle
- Soft-Delete mit `deleted_at` + Papierkorb-Route `/products/trash`
- Lizenz-Risiko-Warnung als Warning-Dialog bei Statusänderung auf `online`

### 1.2 Abhängigkeiten

- **Modul 01 Foundation** muss abgeschlossen sein
- Nutzt bestehende Foundation-Bausteine: `uiStore`, Command Registry, Shortcut Registry, DB Service, `useTheme`-Hook
- Datenbank-Schema für `products` wird in diesem Modul **erweitert** (neue Felder für plattform-spezifische Preise und für `primary_image_path`)

### 1.3 Explizit NICHT im Scope

- Keine Dateiverknüpfungen (kommt in Modul 03 Dateimanager)
  - Der Dateien-Tab zeigt einen Platzhalter mit Hinweis auf Modul 03
- Keine Listing-Erstellung (kommt in Modul 05 Listing-Verwaltung)
  - Der Listings-Tab zeigt einen Platzhalter mit Hinweis auf Modul 05
- Keine KI-Funktionen (kommt in Modul 06 KI-Architektur)
  - Der KI-Tab zeigt einen Platzhalter mit Hinweis auf Modul 06
- Keine Produktbilder-UI (wird in Modul 03 implementiert, Feld `primary_image_path` aber schon jetzt im Schema)
- Keine OneDrive-Integration (Modul 03)
- Keine globalen deutschen Zod-Fehlermeldungen (bewusste Entscheidung, Fehlermeldungen bleiben englisch oder werden pro Feld einzeln gesetzt)

---

## 2. Datenmodell

### 2.1 Product Schema (Drizzle)

Die Tabelle `products` wurde bereits in Foundation angelegt. In Modul 02 wird sie um folgende Felder erweitert:

- `price_etsy` (REAL, nullable) → plattform-spezifischer Preis
- `price_ebay` (REAL, nullable) → plattform-spezifischer Preis
- `price_kleinanzeigen` (REAL, nullable) → plattform-spezifischer Preis
- `primary_image_path` (TEXT, nullable) → wird erst in Modul 03 befüllt, hier nur als Feld reserviert

**Vollständige Felddefinition nach Erweiterung:**

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | TEXT (UUID) | Ja | Primärschlüssel |
| `name` | TEXT | Ja | Vollständiger Produktname |
| `short_name` | TEXT | Nein | Kurzname für Listen |
| `category` | TEXT | Ja | Hauptkategorie (Deko, Organizer, Gadget, ...) |
| `subcategory` | TEXT | Nein | Unterkategorie |
| `description_internal` | TEXT | Nein | Interne Beschreibung und Notizen |
| `collection` | TEXT | Nein | Kollektion (Minimal, Industrial, ...) |
| `status` | TEXT | Ja | siehe Enum unten |
| `material_type` | TEXT | Ja | PLA, PETG, TPU, ABS, Resin |
| `color_variants` | TEXT (JSON) | Nein | Array `[{name, hex}]` |
| `print_time_minutes` | INTEGER | Nein | Geschätzte Druckzeit in Minuten |
| `material_grams` | REAL | Nein | Materialverbrauch in Gramm |
| `electricity_cost` | REAL | Nein | Strom-/Maschinenkosten in EUR (berechnet, kann auch manuell überschrieben werden) |
| `packaging_cost` | REAL | Nein | Verpackungskosten in EUR |
| `shipping_class` | TEXT | Nein | Brief, Warensendung, Paket |
| `target_price` | REAL | Nein | Zielverkaufspreis EUR (Master-Preis) |
| `min_price` | REAL | Nein | Mindestverkaufspreis EUR |
| `price_etsy` | REAL | Nein | **NEU:** plattform-spezifischer Etsy-Preis |
| `price_ebay` | REAL | Nein | **NEU:** plattform-spezifischer eBay-Preis |
| `price_kleinanzeigen` | REAL | Nein | **NEU:** plattform-spezifischer Kleinanzeigen-Preis |
| `estimated_margin` | REAL | Nein | Kalkulierte Marge in % (berechnet, basierend auf `target_price`) |
| `license_source` | TEXT | Nein | Quelle der STL (Thingiverse, Printables, Eigen) |
| `license_type` | TEXT | Nein | siehe Enum unten |
| `license_url` | TEXT | Nein | Link zur Originaldatei oder Lizenz |
| `license_risk` | TEXT | Nein | safe, review_needed, risky |
| `platforms` | TEXT (JSON) | Nein | Array: etsy, ebay, kleinanzeigen |
| `notes` | TEXT | Nein | Freitextnotizen |
| `upsell_notes` | TEXT | Nein | Ideen für Upselling |
| `primary_image_path` | TEXT | Nein | **NEU:** Pfad zum Produktbild (wird in Modul 03 befüllt, in Modul 02 nur reserviert) |
| `created_at` | TEXT (ISO) | Ja | Erstellungszeitpunkt |
| `updated_at` | TEXT (ISO) | Ja | Letzte Änderung |
| `deleted_at` | TEXT (ISO) | Nein | Soft-Delete Timestamp |

**Migrations-Hinweis für Phase A:** Da Foundation das ursprüngliche Schema bereits angelegt hat, muss in Phase A eine neue Drizzle-Migration für die drei Preis-Felder und `primary_image_path` erstellt werden.

### 2.2 Zod-Schema (Single Source of Truth)

Alle Formulare validieren gegen ein zentrales Zod-Schema unter `src/features/products/schema.ts`. Dieses Schema ist Source of Truth; das Drizzle-Schema leitet sich daraus ab (Typen via `z.infer`).

**Struktur:**

- `productSchema` (vollständiges Produkt, für DB-Zugriff)
- `productCreateSchema` (Input für Neues-Produkt-Modal, ohne `id`, `created_at`, `updated_at`, `deleted_at`)
- `productUpdateSchema` (Partial, für Auto-Save)

**Enums (als `z.enum`):**

- `statusEnum`: `idea`, `review`, `print_ready`, `test_print`, `launch_ready`, `online`, `paused`, `discontinued`
- `materialTypeEnum`: `PLA`, `PETG`, `TPU`, `ABS`, `Resin`
- `licenseTypeEnum`: `own`, `cc_by`, `cc_by_sa`, `cc_by_nc`, `commercial`, `unclear`
- `licenseRiskEnum`: `safe`, `review_needed`, `risky`
- `shippingClassEnum`: `Brief`, `Warensendung`, `Paket`
- `platformEnum`: `etsy`, `ebay`, `kleinanzeigen`

**Validierungsregeln:**

- `name`: min 2 Zeichen, max 200 Zeichen
- `target_price` und `min_price`: ≥ 0
- `print_time_minutes`: ≥ 0, max 10080 (eine Woche)
- `material_grams`: ≥ 0, max 10000 (10 kg)
- `license_url`: wenn gesetzt, dann gültige URL

### 2.3 Farbvarianten-Format

**Entscheidung:** `color_variants` wird als Array von Objekten gespeichert:

```ts
[
  { name: "Schwarz", hex: "#000000" },
  { name: "Weiß", hex: "#FFFFFF" },
  { name: "PolyGrid-Blau", hex: "#0070F2" }
]
```

**Begründung:** Einfach implementierbar und erlaubt Farbpunkte in der UI. Für Modul 11 ist eine zentrale Farbbibliothek vorgesehen; die Migration aus diesem Format bleibt kompatibel (Modul 11 kann `name` dann als Referenz auf einen Bibliothekseintrag nutzen, oder weiterhin `hex` verwenden als Fallback).

---

## 3. UI-Spezifikation

### 3.1 Produktliste (`/products`)

Hauptansicht des Moduls. TanStack Table mit Virtualisierung.

**Layout:**

```
┌─ Toolbar ────────────────────────────────────────────┐
│ [Suche...] [Filter ▼] [Gespeicherte Filter ▼]        │
│ [Neues Produkt] [Spalten ▼] [CSV Export] [Papierkorb]│
├─ Bulk-Toolbar (nur sichtbar bei Auswahl) ────────────┤
│ 3 ausgewählt   [Status ▼] [Duplizieren] [Löschen]    │
├─ Tabelle ────────────────────────────────────────────┤
│ ☐ │ Status │ Name │ Kategorie │ Material │ ...       │
└──────────────────────────────────────────────────────┘
```

**Spalten (Default-Konfiguration):**

| Spalte | Breite | Verhalten | Default sichtbar |
|---|---|---|---|
| Auswahl (Checkbox) | 40px | Bulk-Selection | Ja |
| Status-Badge | 100px | Farbcodiert | Ja |
| Name | flex | Klickbar → öffnet `/products/:id` | Ja |
| Kategorie | 120px | Text | Ja |
| Material | 100px | Text | Ja |
| Zielpreis | 100px | Rechtsbündig, EUR | Ja |
| Marge | 100px | Ampel-Farbe | Ja |
| Plattformen | 120px | Icons | Ja |
| Letzte Änderung | 140px | Relatives Datum | Ja |
| Kollektion | 120px | Text | Nein |
| Druckzeit | 100px | Minuten | Nein |
| Material (g) | 100px | Rechtsbündig | Nein |
| Lizenz-Risiko | 120px | Badge | Nein |
| Erstellt am | 140px | Datum | Nein |

**Spalten-Konfiguration (Column-Settings):**

- Button `Spalten ▼` öffnet Popover mit Checkboxen für jede Spalte
- Drag-and-Drop zur Reihenfolge-Änderung innerhalb des Popovers
- Konfiguration wird in `app_settings` unter Key `products_column_config` persistiert (JSON: `{ columns: [{ id, visible, order }] }`)

### 3.2 Filter und Suche

**Volltextsuche:**

- Suchfeld oben, durchsucht `name`, `short_name`, `description_internal`, `notes`
- Debounced (300 ms)

**Filter (Dropdown-Popover):**

- Status (Multi-Select)
- Kategorie (Multi-Select)
- Plattformen (Multi-Select)
- Lizenz-Risiko (Multi-Select)
- Marge: Range-Slider (Min/Max in %)

**Aktive Filter** werden als Badges unterhalb der Toolbar angezeigt, jeder Badge hat ein `X` zum Entfernen.

**Soft-Deleted Produkte:**

- Standardmäßig ausgeblendet
- Toggle `Gelöschte anzeigen` in der Toolbar blendet sie wieder ein (grau, durchgestrichen)
- Alternativ: `/products/trash` als eigene Ansicht (siehe 5.2)

### 3.3 Gespeicherte Filter

**Mechanik:**

- Nach Setzen von Filtern erscheint neben der aktiven Filter-Anzeige ein Button `Als Filter speichern`
- Klick öffnet Dialog: Name eingeben (z.B. "Kritische Marge", "Lizenz-Review"), Speichern
- Gespeicherte Filter erscheinen im Dropdown `Gespeicherte Filter ▼`
- Klick auf gespeicherten Filter aktiviert ihn
- Jeder gespeicherte Filter hat Kontextmenü: `Umbenennen`, `Aktualisieren` (überschreibt mit aktuellem Filter-State), `Löschen`

**Speicherort:**

- Tabelle `app_settings`, Key `products_saved_filters`, Value JSON:

```ts
[
  {
    id: "uuid",
    name: "Kritische Marge",
    filters: {
      search: "",
      status: ["online"],
      marginMin: 0,
      marginMax: 30,
      // ...
    },
    createdAt: "2026-04-19T..."
  }
]
```

### 3.4 Full-Screen-Bearbeitung (`/products/:id`)

**Layout:**

```
┌─ Header ─────────────────────────────────────────────┐
│ [← Zurück] Produktname            [Save-Indicator]   │
│ [Duplizieren] [Status ▼] [Löschen]                   │
├─ Tabs ───────────────────────────────────────────────┤
│ Übersicht │ Dateien │ Listings │ Kosten │ KI         │
├─ Content ────────────────────────────────────────────┤
│                                                      │
│ (Tab-Inhalt, max-width 1200px)                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Save-Indicator (oben rechts):**

- `Gespeichert` (grau, nach erfolgreichem Speichern)
- `Speichert…` (Spinner, während DB-Schreibvorgang)
- `Nicht gespeichert` (Warn-Farbe, wenn Validierung fehlschlägt, mit Tooltip zur Fehlermeldung)
- `Fehler beim Speichern` (rot, bei DB-Fehler, mit Retry-Button)

**Auto-Save-Mechanik:**

- React Hook Form mit `useWatch` beobachtet alle Felder
- Nach 800 ms Inaktivität wird `productUpdateSchema.safeParse` ausgeführt
- Bei erfolgreicher Validierung: Update in DB via Drizzle, Indicator → `Gespeichert`
- Bei Validierungsfehler: Feld bleibt editierbar, Indicator → `Nicht gespeichert`, Fehlermeldung erscheint unter dem Feld
- Ungültige Werte werden **nicht** in die DB geschrieben

**Tabs:**

#### Tab "Übersicht"

Alle Produktfelder als Formular, gruppiert in Abschnitten:

- **Grunddaten:** name, short_name, category, subcategory, collection, status
- **Produktion:** material_type, color_variants, print_time_minutes, material_grams, packaging_cost, shipping_class
- **Preise:** target_price, min_price, price_etsy, price_ebay, price_kleinanzeigen
- **Lizenz:** license_source, license_type, license_url, license_risk
- **Plattformen:** platforms (Multi-Select Checkbox-Gruppe)
- **Notizen:** description_internal, notes, upsell_notes

**Farbvarianten-UI:**

- Liste der Varianten, jeweils: Farbpunkt (`hex`), Name-Input, Hex-Input, X-Button zum Entfernen
- `+ Variante hinzufügen`-Button fügt neues Objekt hinzu

#### Tab "Dateien"

Platzhalter:

```
📁 Dateien
Der Dateimanager wird in Modul 03 implementiert.
Hier werden dann STL-Dateien, Slicer-Dateien und Bilder
verwaltet und per Knopfdruck im passenden Programm geöffnet.
```

#### Tab "Listings"

Platzhalter:

```
🏷️ Listings
Die Listing-Verwaltung wird in Modul 05 implementiert.
Hier werden dann Listings für Etsy, eBay und Kleinanzeigen
erstellt und verwaltet.
```

#### Tab "Kosten"

Vollständiger Margenrechner (siehe Abschnitt 4).

#### Tab "KI"

Platzhalter:

```
✨ KI-Assistent
KI-Funktionen werden in Modul 06 implementiert.
Hier werden dann Titel, Beschreibungen und Tags
automatisch generiert.
```

### 3.5 Neues-Produkt-Modal

4-stufiges Modal (`max-width: 560px`):

**Step 1: Basics**
- `name` (Pflicht)
- `category` (Pflicht, Dropdown)
- `subcategory` (optional)
- `material_type` (Pflicht, Dropdown)
- `status` (Default: `idea`)
- `collection` (optional)

**Step 2: Kosten**
- `print_time_minutes`
- `material_grams`
- `packaging_cost`
- `shipping_class`
- `target_price`
- `min_price`

**Step 3: Lizenz**
- `license_source`
- `license_type` (Dropdown)
- `license_url`
- `license_risk` (Dropdown mit Farbindikator)

**Step 4: Übersicht**
- Zusammenfassung aller Eingaben
- Live-berechnete Marge mit Ampel
- `Erstellen`-Button

**Navigation:**

- Jeder Step hat `Zurück` / `Weiter`-Buttons
- Validierung pro Step (erst beim `Weiter`, nicht live)
- `Abbrechen` jederzeit (mit Bestätigung, wenn bereits Daten eingegeben)

**Nach Erstellen:**

- Produkt wird angelegt, Modal schließt
- Navigation zu `/products/:id` (Full-Screen-Edit)

### 3.6 Tastatur-Navigation

In der Produktliste:

| Taste | Aktion |
|---|---|
| `J` / `↓` | Eine Zeile nach unten |
| `K` / `↑` | Eine Zeile nach oben |
| `Enter` | Aktive Zeile öffnen (`/products/:id`) |
| `Space` | Aktive Zeile auswählen (für Bulk) |
| `Escape` | Auswahl aufheben / Popover schließen |
| `Shift+J/K` | Mehrfachauswahl erweitern |

Aktive Zeile hat sichtbaren Fokus-Ring in `--accent-primary`.

Im Full-Screen-Edit:

| Taste | Aktion |
|---|---|
| `Escape` | Zurück zur Liste (Auto-Save hat bereits gespeichert) |
| `Cmd+K` | Command Palette öffnen (Foundation) |

### 3.7 Bulk-Aktionen

**Aktivierung:**

- Mindestens ein Produkt ausgewählt → Bulk-Toolbar erscheint oberhalb der Tabelle
- Bulk-Toolbar zeigt: `N ausgewählt` + Aktionen

**Verfügbare Aktionen:**

- **Status ändern:** Dropdown mit allen Status-Werten; Klick ändert Status für alle ausgewählten
- **Duplizieren:** Erstellt Kopien aller ausgewählten Produkte (Suffix `(Kopie)` im Namen, siehe 3.8)
- **Löschen (Soft-Delete):** Setzt `deleted_at` für alle ausgewählten (mit Bestätigungsdialog)
- **Auswahl aufheben**

### 3.8 Produkt-Duplizieren

**Mechanik:**

- Einzeln: Button im Full-Screen-Edit Header, oder Kontextmenü auf Tabellenzeile
- Bulk: Button in Bulk-Toolbar
- Duplikat bekommt:
  - Neue UUID
  - Name mit Suffix `(Kopie)` (bei mehreren Kopien: `(Kopie 2)`, `(Kopie 3)` etc.)
  - Status wird auf `idea` zurückgesetzt
  - `created_at` und `updated_at` auf jetzt
  - `deleted_at` auf null
  - Alle anderen Felder werden kopiert
- Nach Duplizieren (einzeln): Navigation zum Duplikat
- Nach Duplizieren (bulk): Bleibt in Liste, Toast-Benachrichtigung

### 3.9 CSV-Export

**Trigger:** Button `CSV Export` in der Toolbar.

**Verhalten:**

- Exportiert **aktuelle gefilterte Liste** (also nicht immer alle Produkte, sondern was gerade sichtbar ist)
- Dialog fragt: `Alle Spalten` oder `Nur sichtbare Spalten` (Default: sichtbare)
- Nativer Speichern-Dialog via Tauri Dialog API
- Dateiname-Default: `produkte_JJJJ-MM-TT.csv`
- Trennzeichen: Semikolon (deutsche Excel-Konvention)
- Encoding: UTF-8 mit BOM (damit Excel Umlaute korrekt anzeigt)
- Datumsfelder im ISO-Format
- JSON-Felder (color_variants, platforms) werden serialisiert

---

## 4. Margenrechner

### 4.1 Kostenbestandteile

| Posten | Berechnung | Quelle |
|---|---|---|
| Materialkosten | `material_grams × Filamentpreis_pro_g` | Produkt + Settings |
| Stromkosten | `(print_time_min × Druckerleistung_W × Strompreis_EUR_pro_kWh) / 60000` | Produkt + Settings |
| Verpackung | Fester Betrag | Produkt (`packaging_cost`) |
| Versand | Basierend auf `shipping_class` | Produkt + Settings |
| Plattformgebühr | `Verkaufspreis × Prozent + Fixbetrag` | Settings (pro Plattform) |

### 4.2 Berechnungsformeln

```
Materialkosten      = material_grams * filament_price[material_type] / 1000
Stromkosten         = (print_time_minutes * printer_power_watts * electricity_price_per_kwh) / 60000
Verpackung          = packaging_cost
Versand             = shipping_cost[shipping_class]
Plattformgebühr     = verkaufspreis * platform_fee_percent[platform] / 100 + platform_fee_fixed[platform]

Gesamtkosten        = Material + Strom + Verpackung + Versand + Plattformgebühr
Rohgewinn           = Verkaufspreis - Gesamtkosten
Marge_prozent       = (Rohgewinn / Verkaufspreis) * 100
```

### 4.3 Plattform-Toggle im Kosten-Tab

Der Kosten-Tab zeigt oben einen Plattform-Toggle:

```
Plattform: [Alle] [Etsy] [eBay] [Kleinanzeigen]
```

- **Alle:** Verwendet `target_price` als Verkaufspreis, berechnet durchschnittliche Gebühr über aktivierte Plattformen
- **Etsy/eBay/Kleinanzeigen:** Verwendet `price_etsy`/`price_ebay`/`price_kleinanzeigen` wenn gesetzt, sonst `target_price`, berechnet Gebühren dieser Plattform

Pro Toggle-Wert werden angezeigt:

- Verkaufspreis (bearbeitbar, schreibt in entsprechendes Feld zurück)
- Kostenaufstellung (alle Posten einzeln)
- Gesamtkosten
- Rohgewinn (EUR)
- Marge (%)
- Ampel-Indikator

### 4.4 Margen-Ampel

| Marge | Farbe | Token | Bewertung |
|---|---|---|---|
| > 50% | Grün | `--accent-success` | Exzellent |
| 30–50% | Grün (hell) | `--accent-success` | Gut |
| 15–30% | Gelb | `--accent-warning` | Akzeptabel, optimieren |
| 0–15% | Orange | `--accent-warning` (intensiver) | Kritisch, Preiserhöhung empfohlen |
| < 0% | Rot | `--accent-danger` | Verlust, sofortiger Handlungsbedarf |

In der Produktliste wird die Ampel-Farbe auf die `estimated_margin`-Spalte angewendet (berechnet aus `target_price`).

### 4.5 Standard-Parameter aus Settings

Werden aus `app_settings` gelesen. Falls keine Werte existieren, werden folgende **Defaults** verwendet (hardcoded in `src/features/products/defaults.ts`):

| Parameter | Settings-Key | Default |
|---|---|---|
| Filamentpreis PLA | `filament_price_pla` | 22,00 EUR/kg |
| Filamentpreis PETG | `filament_price_petg` | 25,00 EUR/kg |
| Filamentpreis TPU | `filament_price_tpu` | 35,00 EUR/kg |
| Filamentpreis ABS | `filament_price_abs` | 28,00 EUR/kg |
| Filamentpreis Resin | `filament_price_resin` | 45,00 EUR/kg |
| Strompreis | `electricity_price_per_kwh` | 0,35 EUR/kWh |
| Druckerleistung | `printer_power_watts` | 200 W |
| Versand Brief | `shipping_price_brief` | 1,95 EUR |
| Versand Warensendung | `shipping_price_warensendung` | 2,75 EUR |
| Versand Paket | `shipping_price_paket` | 6,00 EUR |
| Etsy-Gebühr % | `platform_fee_etsy_percent` | 6,5 % |
| Etsy-Gebühr Fix | `platform_fee_etsy_fixed` | 0,20 EUR |
| eBay-Gebühr % | `platform_fee_ebay_percent` | 11,0 % |
| eBay-Gebühr Fix | `platform_fee_ebay_fixed` | 0,00 EUR |
| Kleinanzeigen-Gebühr % | `platform_fee_kleinanzeigen_percent` | 0,0 % |
| Kleinanzeigen-Gebühr Fix | `platform_fee_kleinanzeigen_fixed` | 0,00 EUR |

Die vollständige UI zur Pflege dieser Werte kommt in Modul 11. In Modul 02 wird **nur gelesen** (mit Defaults als Fallback).

---

## 5. Business-Logik

### 5.1 Lizenz-Risiko-Warnung

**Trigger:** Wenn Status auf `online` geändert wird (im Full-Screen-Edit via Status-Dropdown oder via Bulk-Aktion) UND `license_risk` ist `risky` oder `review_needed` ODER `license_risk` ist nicht gesetzt.

**Dialog:**

```
⚠️ Lizenz-Risiko prüfen

Dieses Produkt hat einen ungeklärten oder riskanten Lizenzstatus:
- Lizenztyp: [license_type oder "nicht gesetzt"]
- Risiko: [license_risk oder "nicht bewertet"]
- Quelle: [license_source oder "unbekannt"]

Bist du sicher, dass du es online stellen willst?

[Abbrechen]  [Trotzdem online stellen]
```

**Bei Abbrechen:** Status bleibt auf vorherigem Wert.

**Bei Bestätigen:** Status wird auf `online` gesetzt, keine weitere Aktion (kein Audit-Log in Modul 02).

### 5.2 Soft-Delete

**Mechanik:**

- `DELETE` setzt nur `deleted_at` auf aktuellen Timestamp
- Gelöschte Produkte werden in der Standardliste **ausgeblendet**
- Toggle `Gelöschte anzeigen` in der Toolbar: blendet sie grau/durchgestrichen wieder ein

**Papierkorb-Route `/products/trash`:**

- Eigene Route mit vereinfachter Tabellenansicht (nur Name, Kategorie, Gelöscht am)
- Filter: Nur Produkte mit `deleted_at IS NOT NULL`
- Aktionen pro Zeile:
  - `Wiederherstellen`: Setzt `deleted_at` auf null
  - `Endgültig löschen`: Hard-Delete mit doppelter Bestätigung
- Bulk-Aktionen: Wiederherstellen, Endgültig löschen
- Zugang über Toolbar-Button `Papierkorb` in `/products`

### 5.3 Status-Workflow

Kein erzwungener Workflow. Jeder Status kann frei gesetzt werden. Die Reihenfolge im Dropdown suggeriert den Standard-Flow:

`idea → review → print_ready → test_print → launch_ready → online → paused → discontinued`

Ausnahme: `online`-Übergang löst Lizenz-Warnung aus (siehe 5.1).

---

## 6. Command Palette Erweiterung

Neue Einträge in der Command Registry (werden in Phase D registriert):

| Command | Kategorie | Aktion |
|---|---|---|
| Neues Produkt | Aktionen | Öffnet Neues-Produkt-Modal |
| Produkt suchen | Navigation | Fokussiert Suchfeld in `/products` |
| Gelöschte Produkte anzeigen | Navigation | Navigiert zu `/products/trash` |
| Produktliste als CSV exportieren | Aktionen | Triggert CSV-Export |

Die Commands werden über das Foundation-Registry-Pattern registriert, nicht in der Command Palette selbst hartcodiert.

---

## 7. Implementierungs-Phasen (für Claude Code)

Jede Phase endet mit einem Commit und Push. Nach Phase E folgt PR-Merge und CLAUDE.md-Update.

### Phase A: Datenmodell und Foundation-Erweiterung

**Ziel:** Schema erweitert, Zod-Schema vollständig, DB-Service bereit für Produkt-CRUD.

**Tasks:**

1. Drizzle-Migration für neue Felder: `price_etsy`, `price_ebay`, `price_kleinanzeigen`, `primary_image_path`
2. Zod-Schemas in `src/features/products/schema.ts`:
   - `productSchema`, `productCreateSchema`, `productUpdateSchema`
   - Alle Enums
3. Defaults-Konstante in `src/features/products/defaults.ts` (Filamentpreise, Strompreis, Gebühren)
4. DB-Service-Funktionen in `src/features/products/db.ts`:
   - `createProduct`, `updateProduct`, `deleteProduct` (soft), `restoreProduct`, `hardDeleteProduct`, `duplicateProduct`
   - `listProducts(filters)`, `getProduct(id)`, `listTrashedProducts()`
5. Settings-Reader in `src/features/products/settings.ts`:
   - `getProductSettings()` liest aus `app_settings`, mergt mit Defaults
6. Kosten-Berechnungs-Logik in `src/features/products/margin.ts`:
   - `calculateMargin(product, platform, settings)`
   - `getMarginColor(marginPercent)`

**Commit-Message:** `feat(products): phase A - schema, zod, db service, margin logic`

### Phase B: Produktliste (Read-Only)

**Ziel:** Produktliste mit TanStack Table anzeigen, sortieren, filtern, suchen.

**Tasks:**

1. Route `/products` mit TanStack Router
2. Komponente `ProductsTable` mit TanStack Table
   - Virtualisierung via `@tanstack/react-virtual`
   - Default-Spalten gemäß 3.1
3. Toolbar-Komponente mit Suchfeld und Filter-Popover
4. Filter-State in Zustand-Store (`productsUiStore`)
5. Status-Badge-Komponente (farbcodiert nach Status-Enum)
6. Margen-Zelle mit Ampel-Farbe
7. Plattform-Icons-Zelle
8. Relatives Datum (z.B. via `date-fns`, oder eigene simple Utility)
9. Soft-Delete-Toggle `Gelöschte anzeigen`

**Noch NICHT in Phase B:**

- Kein Neues-Produkt-Modal
- Keine Bearbeitung
- Keine Bulk-Aktionen
- Keine Column-Settings
- Keine gespeicherten Filter
- Kein CSV-Export

**Commit-Message:** `feat(products): phase B - list view with table, filters, search`

### Phase C: Full-Screen-Edit und Margenrechner

**Ziel:** Produkte bearbeiten können, Auto-Save, Margenrechner im Kosten-Tab.

**Tasks:**

1. Route `/products/:id` mit TanStack Router (typed params)
2. Komponente `ProductEditPage` mit Header (Zurück, Name, Save-Indicator, Actions)
3. Tabs-Komponente (shadcn/ui Tabs): Übersicht, Dateien (Platzhalter), Listings (Platzhalter), Kosten, KI (Platzhalter)
4. Tab "Übersicht":
   - React Hook Form + Zod Resolver
   - Gruppierte Felder gemäß 3.4
   - Farbvarianten-Editor (Add/Remove, Hex-Input mit Color-Picker)
5. Auto-Save-Hook `useAutoSave`:
   - `useWatch` beobachtet Formular
   - Debounce 800 ms
   - Validiert via `productUpdateSchema.safeParse`
   - Bei Erfolg: `updateProduct` in DB
   - Setzt Save-Indicator-State
6. Tab "Kosten": Margenrechner mit Plattform-Toggle
7. Platzhalter-Tabs mit Hinweis auf spätere Module
8. Tastatur: `Escape` → zurück zur Liste
9. Navigation von Liste zu Edit-Seite (Klick auf Name-Zelle, Enter-Taste auf aktiver Zeile)

**Commit-Message:** `feat(products): phase C - edit page with auto-save and margin calculator`

### Phase D: Neues-Produkt-Modal, Lizenz-Warnung, Papierkorb

**Ziel:** Produkte anlegen können, Lizenz-Warnung aktiv, Soft-Delete mit Papierkorb.

**Tasks:**

1. Komponente `NewProductDialog` (shadcn/ui Dialog)
2. 4-Step-Formular mit Step-Navigation
3. Pro Step: React Hook Form mit partiellem Zod-Schema
4. Step 4 (Übersicht) zeigt Live-Berechnung der Marge
5. Nach `Erstellen`: `createProduct`, Modal schließen, Navigation zu `/products/:id`
6. Lizenz-Warnung-Dialog:
   - Trigger beim Status-Change auf `online` (in Edit-Seite und Bulk-Aktion)
   - shadcn/ui AlertDialog
7. Papierkorb-Route `/products/trash`
8. Komponente `TrashView` mit Tabelle (Name, Kategorie, Gelöscht am, Aktionen)
9. `Wiederherstellen` und `Endgültig löschen` (mit doppelter Bestätigung)
10. Command Registry: Commands registrieren
11. Toolbar-Button `Neues Produkt` in `/products`
12. Toolbar-Button `Papierkorb` in `/products`

**Commit-Message:** `feat(products): phase D - create modal, license warning, trash`

### Phase E: High-End-Polish

**Ziel:** Bulk-Aktionen, Duplizieren, Column-Settings, gespeicherte Filter, CSV-Export, Tastatur-Navigation.

**Tasks:**

1. Bulk-Selection in Tabelle (Checkbox-Spalte, Select-All-Header)
2. Bulk-Toolbar-Komponente mit Aktionen: Status ändern, Duplizieren, Löschen
3. Produkt-Duplizieren: Einzeln (Kontextmenü + Button in Edit-Header) und Bulk
4. Column-Settings:
   - Popover mit Checkbox-Liste
   - Drag-and-Drop für Reihenfolge (via `@dnd-kit/sortable`)
   - Persistierung in `app_settings`
5. Gespeicherte Filter:
   - Dialog `Filter speichern` (Name-Input)
   - Dropdown `Gespeicherte Filter ▼`
   - Kontextmenü pro Filter (Umbenennen, Aktualisieren, Löschen)
   - Persistierung in `app_settings`
6. CSV-Export:
   - Button in Toolbar
   - Dialog `Alle Spalten` vs `Nur sichtbare`
   - Tauri-Save-Dialog
   - CSV-Generierung (UTF-8 mit BOM, Semikolon)
7. Tastatur-Navigation in Tabelle:
   - J/K, ↑/↓ für Zeilen
   - Enter für Öffnen
   - Space für Auswahl
   - Shift+J/K für Mehrfachauswahl
   - Aktive-Zeile-Fokus-Ring

**Commit-Message:** `feat(products): phase E - bulk actions, duplication, column settings, saved filters, csv export, keyboard nav`

**Nach Phase E:** PR-Merge, CLAUDE.md aktualisieren (Modul 02 auf `✅ Abgeschlossen`).

---

## 8. Akzeptanzkriterien

Das Modul gilt als abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

**Funktional:**

- [ ] Produkte können über das Neues-Produkt-Modal (4 Steps) angelegt werden
- [ ] Produkte können in der Full-Screen-Edit-Seite bearbeitet werden
- [ ] Auto-Save speichert nach 800 ms Inaktivität, Save-Indicator reflektiert Status korrekt
- [ ] Ungültige Eingaben werden **nicht** in die DB geschrieben, Fehlermeldung erscheint im Feld
- [ ] Produkte können (soft-)gelöscht und aus dem Papierkorb wiederhergestellt werden
- [ ] Endgültiges Löschen erfordert doppelte Bestätigung
- [ ] Produkte können einzeln und bulk dupliziert werden
- [ ] Bulk-Aktionen (Status ändern, Duplizieren, Löschen) funktionieren mit Auswahl
- [ ] Margenrechner berechnet korrekt pro Plattform (Toggle)
- [ ] Margen-Ampel zeigt korrekte Farben gemäß Abschnitt 4.4
- [ ] Lizenz-Warnung erscheint bei Statusänderung auf `online` mit `risky`/`review_needed`/unset `license_risk`

**UI:**

- [ ] Produktliste zeigt alle Default-Spalten, ist sortier- und filterbar
- [ ] Volltextsuche durchsucht `name`, `short_name`, `description_internal`, `notes` (debounced 300 ms)
- [ ] Column-Settings persistieren über App-Neustart
- [ ] Gespeicherte Filter können angelegt, umbenannt, aktualisiert, gelöscht werden
- [ ] CSV-Export generiert korrekte Datei (UTF-8 mit BOM, Semikolon)
- [ ] Tastatur-Navigation funktioniert (J/K, Enter, Space, Shift+J/K, Escape)
- [ ] Aktive Zeile in Tabelle hat sichtbaren Fokus-Ring in Akzentfarbe
- [ ] Platzhalter-Tabs (Dateien, Listings, KI) zeigen klaren Hinweis auf späteres Modul

**Technisch:**

- [ ] Zod-Schema ist Single Source of Truth
- [ ] Drizzle-Migration wurde sauber ausgeführt (neue Felder sind in DB)
- [ ] TypeScript kompiliert ohne Fehler im strict mode
- [ ] ESLint und Prettier laufen ohne Fehler
- [ ] TanStack Table virtualisiert bei 100+ Einträgen flüssig
- [ ] Command Palette enthält alle neuen Commands

---

## 9. Offene Punkte / Post-MVP

Diese Punkte wurden **bewusst aus Modul 02 ausgeklammert**. Sie sind dokumentiert, damit sie nicht vergessen werden.

- **Audit-Log** für Status-Änderungen und Lizenz-Warnung-Entscheidungen (später relevant für steuerliche Nachvollziehbarkeit)
- **Produkt-Verlauf** / Änderungshistorie (wann hat sich der Zielpreis geändert, wann wurde die Marge kritisch)
- **Globale deutsche Zod-Fehlermeldungen** (bewusst nicht aufgenommen; bei Bedarf später global via `z.setErrorMap`)
- **Varianten-Management auf Produktebene** (aktuell nur `color_variants`; ggf. später: Größen, Materialien als echte Varianten statt Farben)
- **Produkt-Templates** (z.B. "Typisches Deko-Produkt" mit vorausgefüllten Kosten)
- **Barcode-/SKU-Generierung**
- **Mehrwährungs-Support** (aktuell nur EUR, fix)

---

## 10. Vorab-Notizen für spätere Module

### 10.1 Für Modul 03 Dateimanager

Aus dem Planungsgespräch für Modul 02 ergeben sich folgende Anforderungen, die **in Modul 03** umgesetzt werden:

**STL-Dateien pro Produkt:**

- Mehrere STLs pro Produkt möglich
- Eine STL markierbar als `primary`
- UI: Liste der STLs im Dateien-Tab des Produkts, Primary-Toggle pro Datei

**Slicer-Dateien:**

- Mehrere Slicer-Dateien pro Produkt möglich
- Feld `best_settings` (Boolean) pro Datei, um die "funktioniert am besten"-Profile zu markieren
- Freitext-Feld `slicer_notes` am Produkt (oder pro Datei) für Hinweise wie "Diese Einstellungen geben sauberste Kanten"

**Elegoo Slicer Auto-Open (macOS und Windows):**

- Zwei Buttons pro Slicer-Datei:
  - `Öffnen` → nutzt `shell.open` (macOS-Default-App oder Windows-Default)
  - `In Elegoo Slicer öffnen` → nutzt expliziten Pfad aus Settings
- Settings-Feld `elegoo_slicer_path` (TEXT, OS-abhängiger Default):
  - macOS-Default: `/Applications/ELEGOO Slicer.app`
  - Windows-Default: aus Registry zu ermitteln, Fallback auf manuelle Eingabe
- Implementierung via Tauri-Command (Rust-Backend), nicht direkt über `shell.open`, damit expliziter Pfad möglich ist

**Produktbilder:**

- Galerie im Dateien-Tab des Produkt-Edit-Screens
- Drag-and-Drop Upload (Dateien werden nach `/02_Produkte/{produktname}/Bilder/` in OneDrive kopiert)
- Ein Bild markierbar als `primary` → schreibt Pfad in `products.primary_image_path`
- Thumbnail in Produktliste (neue Spalte, Default: sichtbar, ganz links nach Checkbox)
- Reihenfolge per Drag-and-Drop anpassbar
- Unterstützte Formate: PNG, JPG, WEBP

**Architektur für Bilder über Module hinweg (Bildpool-Prinzip):**

- Bilder werden **am Produkt** verwaltet (als Pool)
- Listings (Modul 05) wählen aus diesem Pool aus, können zusätzlich listing-spezifische Bilder haben
- Dies verhindert doppeltes Hochladen und ermöglicht einheitliche Pflege

### 10.2 Für Modul 05 Listing-Verwaltung

**Bildauswahl im Listing:**

- Listing-Editor hat Tab "Bilder"
- Zeigt Bildpool des verknüpften Produkts
- Checkbox pro Bild für "in diesem Listing verwenden"
- Drag-and-Drop zur Reihenfolge
- Zusätzlich: Upload-Button für listing-spezifische Bilder (z.B. Etsy-Titelbild mit Text-Overlay)
- Datenmodell-Vorschlag: Tabelle `listing_images` mit `listing_id`, `image_path`, `position`, `is_listing_specific` (boolean)

**Plattform-spezifische Preise:**

- Modul 02 hat bereits `price_etsy`, `price_ebay`, `price_kleinanzeigen` am Produkt
- Listings greifen auf diese Preise zu als Default, können aber überschrieben werden im Listing selbst

### 10.3 Für Modul 11 Settings

**Farbvarianten-Bibliothek:**

- Modul 02 speichert `color_variants` als `[{name, hex}]` am Produkt
- Modul 11 soll eine zentrale Farbbibliothek einführen (Tabelle `color_library`)
- Migration: Modul 11 kann beim ersten Start alle vorhandenen `color_variants` aus Produkten extrahieren und in die Bibliothek überführen
- Datenmodell bleibt rückwärtskompatibel: `name` wird dann auf Library-Eintrag referenzieren können

**Elegoo-Slicer-Pfad:**

- Siehe 10.1, Settings-Feld `elegoo_slicer_path`

**Plattform-Gebühren-UI:**

- Modul 02 liest Gebühren aus `app_settings` mit Defaults
- Modul 11 baut die UI zur Pflege dieser Werte (gemäß Modul-11-Spec Abschnitt 2.4)

**Filament-Preise:**

- Default-Preise in `src/features/products/defaults.ts`
- Modul 11 baut Material-Tabelle zur Anpassung (gemäß Modul-11-Spec Abschnitt 2.4)

---

## 11. Referenzen

- **Original-Spec:** `MODUL_02_PRODUKTVERWALTUNG.docx` im Project Knowledge
- **Foundation:** `docs/modules/MODUL_01_FOUNDATION.md`
- **Projektregeln:** `docs/PROJEKTREGELN.md`
- **Design-System:** `docs/DESIGN_SYSTEM.md`
- **Datenbank-Schema (konsolidiert):** `docs/DATABASE_SCHEMA.md`

---

*Ende von Modul 02 Produktverwaltung Spec v2.0*
