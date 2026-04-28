# Modul 05: Listing-Verwaltung

PolyGrid Studio Business OS
Anforderungsdokument | Version 2.0 | April 2026

> **Hinweis zur Versionierung**
> Diese Version 2.0 ersetzt die ursprüngliche Spec vollständig. Wesentliche Änderungen:
> - **Master-Listing-Konzept**: Ein Master-Listing pro Produkt mit plattformspezifischen Overrides statt drei separater Listings
> - **API-Kompatibilität**: Datenmodell vorbereitet für Etsy Open API v3 und eBay Sell Inventory API (aktive Anbindung in Modul 12)
> - **Inventory-Modi**: Unterstützung für made-to-order und Lagerbestand
> - **Bilder-Management**: Verknüpfung mit Modul 03 (Dateimanager), geordnete Bildreihenfolge
> - **Kleinanzeigen-Komfort**: Copy-Helfer statt API-Anbindung
> - **Sync-Status**: Anzeige des Plattform-Status pro Listing und Plattform

---

## 1. Scope und Ziel

Dieses Modul implementiert die zentrale Listing-Verwaltung als **Single Source of Truth** für alle Plattformen. Ein Produkt hat genau ein Master-Listing. Davon werden plattformspezifische Varianten (Overrides) für Etsy, eBay und Kleinanzeigen abgeleitet. Die tatsächliche Plattform-Synchronisation erfolgt erst in Modul 12 (Platform Sync). Modul 05 liefert die UI, das Datenmodell und die Stub-Buttons für späteres Push to Platform.

### 1.1 Lieferergebnisse

- Listing-Liste mit Master-Listings, gruppiert nach Produkt oder als flache Liste
- Listing-Editor mit Tab-basiertem Layout: Master-Daten, Etsy-Override, eBay-Override, Kleinanzeigen-Override, Bilder, Vorschau
- Plattformspezifische Zeichenlimits und Echtzeit-Validierung
- Tag-Management mit Plattformlimits
- Bilder-Management via Verknüpfung zu Modul 03 (Drag-and-Drop-Sortierung, Hauptbild-Markierung)
- Variantenmanagement (Name, Preis, Lagerbestand, SKU)
- Inventory-Modus pro Listing: made_to_order oder stock
- Vollständigkeits-Ampel pro Plattform separat
- Sync-Status-Anzeige (Stub für Modul 12, zeigt aktuell immer "manuell")
- "Push to Platform"-Buttons als deaktivierte Stubs mit Tooltip
- Kleinanzeigen-Copy-Helfer (Titel, Beschreibung, Tags formatiert in Zwischenablage)
- Integration: Listings erscheinen im Produkt-Detail-Panel (Tab "Listings")
- Listing-Vorlagen: bestehendes Listing als Template für neues Listing duplizieren
- Bulk-Aktionen: Pausieren, Aktivieren, Preis ändern (in %), Löschen für Auswahl

### 1.2 Abhängigkeiten

- Foundation (App Shell, DB, Routing, Detail-Panel)
- Produktverwaltung (Modul 02): Jedes Master-Listing referenziert genau ein Produkt
- Dateimanager (Modul 03): Bilder werden via file_links verknüpft
- Vorlagenbibliothek (Modul 07, optional): Rechtstexte können automatisch ans Listing-Ende angehängt werden, wenn vorhanden

### 1.3 Explizit NICHT im Scope

- Keine echten API-Aufrufe an Etsy oder eBay (kommt in Modul 12)
- Keine KI-Textgenerierung (kommt in Modul 06, Buttons sind Platzhalter)
- Keine automatische Bestandsaktualisierung über Plattformen hinweg (kommt in Modul 12)
- Keine Bild-Bearbeitung in der App (Bilder werden extern erstellt und über Modul 03 verknüpft)

---

## 2. Datenmodell

### 2.1 Konzeptionelle Struktur

```
Produkt (1) ────── (1) Master-Listing
                         │
                         ├── (0..1) Etsy-Override
                         ├── (0..1) eBay-Override
                         └── (0..1) Kleinanzeigen-Override
                         │
                         └── (0..n) Listing-Bilder (via file_links)
                         └── (0..n) Listing-Varianten
```

Ein Master-Listing existiert immer, sobald ein Produkt zum Verkauf vorbereitet wird. Overrides werden nur angelegt, wenn das Listing auf der jeweiligen Plattform veröffentlicht werden soll. Wenn kein Override existiert, werden die Master-Werte verwendet (mit automatischer Kürzung auf Plattform-Limits).

### 2.2 Tabelle: listings (Master-Listing)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| product_id | TEXT (FK) | Ja | Referenz auf Produkt, UNIQUE |
| master_title | TEXT | Ja | Vollständiger Titel (bis 140 Zeichen, Etsy-Limit) |
| master_short_description | TEXT | Nein | Kurzbeschreibung für Plattformen mit Limit |
| master_long_description | TEXT | Nein | Ausführliche Beschreibung (HTML erlaubt) |
| master_bullet_points | TEXT (JSON) | Nein | Array von Aufzählungspunkten |
| master_tags | TEXT (JSON) | Ja | Array von Tags (Master-Pool, max. 20) |
| base_price | REAL | Ja | Standardpreis in EUR |
| currency | TEXT | Ja | Default: 'EUR' |
| inventory_mode | TEXT | Ja | 'made_to_order' oder 'stock' |
| stock_quantity | INTEGER | Nein | Nur bei stock-Modus, sonst NULL |
| sku_base | TEXT | Nein | Basis-SKU (z.B. 'PG-VASE-001'), wird für Varianten erweitert |
| processing_time_min_days | INTEGER | Nein | Minimale Bearbeitungszeit |
| processing_time_max_days | INTEGER | Nein | Maximale Bearbeitungszeit |
| weight_grams | REAL | Nein | Versandgewicht in Gramm (für eBay/DHL relevant) |
| dimension_length_cm | REAL | Nein | Verpackungslänge |
| dimension_width_cm | REAL | Nein | Verpackungsbreite |
| dimension_height_cm | REAL | Nein | Verpackungshöhe |
| condition | TEXT | Ja | 'new' oder 'used_like_new' (Default: 'new') |
| language | TEXT | Ja | 'de' oder 'en' |
| status | TEXT | Ja | draft, ready, online, paused, archived |
| seo_notes | TEXT | Nein | Interne SEO-Hinweise |
| append_legal_texts | BOOLEAN | Ja | Default: true. Hängt Impressum/Widerruf aus Modul 07 an |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |
| deleted_at | TEXT (ISO) | Nein | Soft-Delete |

### 2.3 Tabelle: listing_platform_overrides

Pro Listing × Plattform maximal eine Zeile. Wenn ein Feld NULL ist, wird der Master-Wert verwendet.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| listing_id | TEXT (FK) | Ja | Referenz auf listings.id |
| platform | TEXT | Ja | 'etsy', 'ebay' oder 'kleinanzeigen' |
| is_active | BOOLEAN | Ja | Soll dieses Listing auf dieser Plattform gepflegt werden |
| title_override | TEXT | Nein | Plattformspezifischer Titel |
| short_description_override | TEXT | Nein | Plattformspezifische Kurzbeschreibung |
| long_description_override | TEXT | Nein | Plattformspezifische Langbeschreibung |
| tags_override | TEXT (JSON) | Nein | Plattformspezifische Tags (Subset oder eigener Set) |
| price_override | REAL | Nein | Plattformspezifischer Preis (z.B. eBay 11% höher wegen Gebühren) |
| platform_category_id | TEXT | Nein | Etsy taxonomy_id oder eBay categoryId |
| shipping_profile_id | TEXT | Nein | Plattform-Versandprofil-ID |
| return_policy_id | TEXT | Nein | Plattform-Rückgabeprofil-ID |
| payment_policy_id | TEXT | Nein | Plattform-Zahlungsprofil-ID |
| external_listing_id | TEXT | Nein | Listing-ID auf der Plattform nach Push (für Modul 12) |
| external_listing_url | TEXT | Nein | Direkter Link zur Plattform-Seite |
| sync_status | TEXT | Ja | Default: 'manual'. Werte: manual, pending, synced, error |
| sync_error_message | TEXT | Nein | Fehlermeldung des letzten Sync-Versuchs |
| last_synced_at | TEXT (ISO) | Nein | Wann zuletzt erfolgreich gesynct |
| platform_metadata | TEXT (JSON) | Nein | Plattformspezifische Felder, die wir hier nicht modellieren (z.B. Etsy-Materials, eBay Item Specifics) |
| created_at | TEXT (ISO) | Ja | |
| updated_at | TEXT (ISO) | Ja | |

UNIQUE-Constraint auf (listing_id, platform).

### 2.4 Tabelle: listing_variants

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| listing_id | TEXT (FK) | Ja | Referenz auf listings.id |
| name | TEXT | Ja | Variantenname (z.B. "Schwarz matt") |
| sku_suffix | TEXT | Nein | Wird an sku_base angehängt (z.B. "-BLK") |
| price | REAL | Ja | Variantenpreis |
| stock_quantity | INTEGER | Nein | Nur bei stock-Modus |
| color_hex | TEXT | Nein | Hex-Code für Farbvariante |
| sort_order | INTEGER | Ja | Reihenfolge in der UI |
| is_default | BOOLEAN | Ja | Default-Variante für Anzeige |

### 2.5 Tabelle: listing_images

Verknüpft Bilder aus dem Dateimanager (Modul 03) mit Listings. Reihenfolge ist relevant.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| listing_id | TEXT (FK) | Ja | Referenz auf listings.id |
| file_link_id | TEXT (FK) | Ja | Referenz auf file_links.id (Modul 03) |
| sort_order | INTEGER | Ja | Reihenfolge, 0 = Hauptbild |
| alt_text | TEXT | Nein | Alt-Text für Barrierefreiheit/SEO |
| platforms | TEXT (JSON) | Nein | Optional: Bild nur für bestimmte Plattformen, z.B. ["etsy", "ebay"]. NULL = alle |

### 2.6 Zod-Schemas

Alle drei Tabellen bekommen ein Zod-Schema in `src/features/listings/schemas.ts`. Drizzle leitet daraus ab. Enums (platform, inventory_mode, status, condition, sync_status) werden als Zod-Enums definiert und exportiert, damit andere Module sie nutzen können.

---

## 3. Plattform-Limits

| Plattform | Titel | Tags | Beschreibung | Bilder max | Bemerkung |
|-----------|-------|------|--------------|-----------|-----------|
| Etsy | 140 Zeichen | 13 Tags, je max. 20 Zeichen | Keine Hardlimit, empfohlen <1000 | 10 | HTML eingeschränkt |
| eBay | 80 Zeichen | Keine Tags (Item Specifics stattdessen) | HTML erlaubt, ~500.000 Zeichen | 24 | Pflichtfelder: Condition, Brand, etc. |
| Kleinanzeigen | 65 Zeichen | Keine Tags | Reiner Text, ~4000 Zeichen | 20 | Keine API |

Diese Limits werden als Konstanten in `src/features/listings/constants.ts` definiert. Der Editor zeigt sie als Echtzeit-Zeichenzähler. Bei Überschreitung erscheint eine rote Markierung, das Speichern wird aber nicht blockiert (nur das Push to Platform würde später fehlschlagen).

---

## 4. UI-Spezifikation

### 4.1 Listenansicht (Route: /listings)

**Header-Bereich:**
- Titel "Listings"
- Such-/Filterleiste
- Buttons: "Neues Listing", "Aus Vorlage erstellen"
- Bulk-Action-Bar erscheint, wenn Zeilen ausgewählt sind

**Tabelle (TanStack Table):**

| Spalte | Breite | Verhalten |
|--------|--------|-----------|
| Checkbox | 40px | Bulk-Select |
| Status | 100px | Badge (draft/ready/online/paused/archived) |
| Hauptbild | 60px | Thumbnail oder Platzhalter-Icon |
| Master-Titel | flex | Klickbar, öffnet Editor |
| Produkt | 160px | Verlinkter Produktname |
| Plattformen | 140px | Drei kleine Badges (Etsy/eBay/KA), grün=online, gelb=draft, grau=inaktiv, rot=sync_error |
| Inventory | 100px | "Auf Bestellung" oder "Lager: X" |
| Basispreis | 100px | Rechtsbündig, EUR |
| Sprache | 60px | DE/EN |
| Geändert | 120px | Relatives Datum |

**Filter:**
- Status (Multi-Select)
- Plattform-Status (online auf Etsy, draft auf eBay etc.)
- Inventory-Modus
- Vollständigkeit (alle, unvollständig)
- Sprache
- Toggle "Gelöschte anzeigen"

### 4.2 Listing-Editor (Route: /listings/$id)

Der Editor ist eine eigene Seite, kein Modal, weil er groß ist. Layout: Tab-basiert mit fester Tab-Leiste oben und einem festen Aktions-Footer unten.

**Tab-Leiste:**
1. **Master** (Pflicht-Tab, immer aktiv)
2. **Bilder**
3. **Varianten**
4. **Etsy** (Tab-Header zeigt Status-Badge)
5. **eBay** (Tab-Header zeigt Status-Badge)
6. **Kleinanzeigen** (Tab-Header zeigt Status-Badge)
7. **Vorschau**

**Footer (immer sichtbar):**
- Links: Speichern-Status ("Gespeichert", "Wird gespeichert...", "Ungesicherte Änderungen")
- Mitte: Vollständigkeits-Ampeln pro Plattform (drei kleine Punkte mit Tooltip)
- Rechts: Abbrechen, Speichern, "Push to Platforms" (deaktivierter Stub mit Tooltip "Wird in Modul 12 verfügbar")

#### 4.2.1 Tab: Master

Linke Spalte (Formular, 60%):
- Produktauswahl (read-only nach Erstellung)
- Master-Titel mit Zeichenzähler (zeigt "47/140 (Etsy) | 47/80 (eBay) | 47/65 (Kleinanzeigen)")
- Master-Kurzbeschreibung
- Master-Langbeschreibung (Markdown-Editor oder einfache Textarea)
- Master-Tags (Input mit Chips, max. 20)
- Inventory-Modus (Radio: Auf Bestellung / Lagerbestand)
- Stock-Quantity (nur bei Lagerbestand)
- SKU-Basis
- Bearbeitungszeit (Min/Max Tage)
- Versandgewicht und Maße
- Sprache (DE/EN)
- Status (draft/ready/online/paused/archived)
- Toggle "Rechtstexte automatisch anhängen"

Rechte Spalte (Hilfe-Sidebar, 40%):
- Hinweis-Box: "Master-Daten sind die Standardwerte. In den Plattform-Tabs kannst du diese pro Plattform überschreiben."
- KI-Aktions-Buttons (deaktivierte Platzhalter): "Titel verbessern", "Beschreibung generieren", "Tags vorschlagen"
- Tooltip auf Buttons: "Wird in Modul 06 verfügbar"

#### 4.2.2 Tab: Bilder

- Drag-and-Drop-Bereich oder "Bild hinzufügen"-Button (öffnet Datei-Picker aus Modul 03)
- Grid mit Thumbnails, Drag-and-Drop zur Sortierung
- Erstes Bild = Hauptbild (mit "HAUPT"-Badge markiert)
- Pro Bild: Alt-Text-Eingabe, Plattform-Filter (Checkboxen Etsy/eBay/KA, Default: alle)
- Zähler oben: "5/24 Bilder (Etsy: 5/10, eBay: 5/24, KA: 5/20)"
- Bei Überschreitung: Warnung welche Bilder auf welcher Plattform abgeschnitten werden

#### 4.2.3 Tab: Varianten

- Tabelle mit Spalten: Sortierung (Drag-Handle), Name, SKU-Suffix, Preis, Stock (wenn stock-Modus), Farbe (Hex), Default-Marker, Aktionen (Löschen)
- Button "Variante hinzufügen"
- Validierung: Mindestens eine Default-Variante

#### 4.2.4 Tab: Etsy

Header: Status-Badge ("Inaktiv", "Draft", "Online", "Sync-Fehler"), Toggle "Auf Etsy aktiv pflegen"

Wenn aktiv:
- **Override-Felder** (alle optional, Platzhalter zeigt Master-Wert):
  - Titel-Override (mit Zeichenzähler 0/140)
  - Beschreibung-Override
  - Tags-Override (max. 13, je max. 20 Zeichen)
  - Preis-Override
- **Etsy-spezifische Felder:**
  - Etsy Taxonomy ID (Eingabefeld + Hilfe-Link)
  - Shipping Profile (Dropdown, im MVP manuell pflegbar)
  - Return Policy (Dropdown)
  - Materials (kommaseparierte Liste, Etsy-Item-Specific)
  - Production Partner (optional)
  - Is Personalizable (Boolean)
- **Sync-Bereich:**
  - Anzeige sync_status, last_synced_at, external_listing_url
  - Button "Push to Etsy" (deaktivierter Stub, Tooltip: "Wird in Modul 12 verfügbar")
  - Button "Im Browser öffnen" (aktiv wenn external_listing_url vorhanden)
  - Button "Kopieren-Helfer öffnen" (öffnet Dialog mit Etsy-formatiertem Text zum manuellen Einfügen)

#### 4.2.5 Tab: eBay

Analog zu Etsy, aber mit eBay-spezifischen Feldern:
- Override-Felder (Titel max. 80, keine Tags, dafür Item Specifics)
- eBay Category ID
- Item Specifics (Key-Value-Liste, z.B. Brand=PolyGrid, Material=PLA, Color=Schwarz)
- Listing Format (immer Festpreis im MVP)
- Listing Duration (GTC = Good Till Cancelled, Default)
- Best Offer akzeptieren (Boolean)
- Versandprofile, Zahlungsprofile, Rückgabeprofile (Plattform-IDs)

#### 4.2.6 Tab: Kleinanzeigen

Da keine API existiert, ist der Tab als **Copy-Helfer** ausgelegt:
- Override-Felder (Titel max. 65, einfache Textbeschreibung)
- PLZ-Bereich (Pflichtfeld bei Kleinanzeigen)
- Versand anbieten (Boolean) und Versandkosten
- Standort-Stadt
- **Kopier-Aktionen:**
  - Button "Titel kopieren"
  - Button "Beschreibung kopieren"
  - Button "Komplett-Text kopieren" (Titel + Beschreibung + ggf. Hashtags + Rechtstexte)
  - Button "Auf kleinanzeigen.de inserieren" (öffnet `https://www.kleinanzeigen.de/p-anzeige-aufgeben.html` im Browser)
- Hinweis-Box: "Kleinanzeigen bietet keine API. Inserate werden manuell gepflegt. PolyGrid hilft dir mit fertig formatierten Texten."
- sync_status ist hier immer "manual"

#### 4.2.7 Tab: Vorschau

- Drei Reiter: Etsy-Vorschau, eBay-Vorschau, Kleinanzeigen-Vorschau
- Jeweils visuelle Approximation, wie das Listing auf der Plattform aussehen würde
- Titel, Hauptbild, Preis, Beschreibung, Tags
- Kein Pixel-perfect-Mockup, sondern strukturierte Repräsentation

### 4.3 Neues Listing (Modal)

Schmales Modal:
- Produktauswahl (Pflicht, Dropdown mit Suche, nur Produkte ohne bestehendes Listing)
- Sprache (DE/EN)
- Inventory-Modus (Auf Bestellung / Lagerbestand)
- Plattformen vorbereiten (Checkboxen Etsy, eBay, Kleinanzeigen, Default: alle)
- Erstellen-Button: Erzeugt Master-Listing + leere Override-Records für gewählte Plattformen, navigiert in den Editor

### 4.4 Aus Vorlage erstellen

- Modal mit Liste bestehender Listings (durchsuchbar)
- Auswahl + Zielprodukt (muss anderes Produkt sein) + "Duplizieren"
- Kopiert Master-Daten, Override-Daten, Variantenstruktur (ohne Stock-Werte). Bilder werden NICHT kopiert (müssen produktspezifisch sein)
- Setzt Status auf "draft" und sync-Status auf "manual"

### 4.5 Bulk-Aktionen

Auswahl per Checkbox in der Liste, dann Action-Bar oben:
- Pausieren (status = paused)
- Aktivieren (status = ready)
- Preis ändern um X% (öffnet Dialog mit Prozent-Eingabe, betrifft base_price aller Master-Listings)
- Soft-Delete

### 4.6 Vollständigkeits-Ampel

Pro Listing × Plattform separat berechnet:
- **Grün**: Alle Pflichtfelder gefüllt, Tags >= 5 (bei Etsy), mindestens 1 Bild, Plattform-Kategorie gesetzt
- **Gelb**: Pflichtfelder gefüllt, aber empfohlene Felder fehlen (z.B. <5 Tags, kein Override-Titel obwohl Master >Plattform-Limit)
- **Rot**: Pflichtfelder fehlen oder Master-Titel überschreitet Plattform-Limit ohne Override

Logik in `src/features/listings/utils/completeness.ts` als pure Function.

---

## 5. Integration mit anderen Modulen

### 5.1 Produktverwaltung (Modul 02)

Im Produkt-Detail-Panel, Tab "Listings", wird jetzt das Master-Listing dieses Produkts angezeigt (statt Platzhalter). Falls noch keins existiert: Button "Listing anlegen". Falls vorhanden: Mini-Karte mit Master-Titel, Plattform-Badges, Status, Klick führt zum Editor.

### 5.2 Dateimanager (Modul 03)

Bilder werden aus dem Dateimanager via file_links verknüpft. Beim Bild-Picker werden bevorzugt Bilder aus `/02_Produkte/{produktordner}/Bilder/` angezeigt, andere Pfade aber auch zugelassen.

### 5.3 Vorlagenbibliothek (Modul 07)

Wenn `append_legal_texts = true` und in Modul 07 Vorlagen mit Kategorie "impressum", "widerruf", "versand" existieren, werden diese beim Generieren des Plattform-Texts (in der Vorschau und im Copy-Helfer) automatisch ans Ende angehängt. In Modul 05 wird diese Logik vorbereitet, aber falls Modul 07 noch nicht existiert, wird ein Platzhalter-Text "{{Rechtstexte werden in Modul 07 angehängt}}" eingesetzt.

### 5.4 KI-Architektur (Modul 06)

Alle KI-Buttons im Editor sind deaktivierte Stubs mit Tooltip. Modul 06 ersetzt die Stubs durch echte Calls.

### 5.5 Platform Sync (Modul 12)

Die "Push to Platform"-Buttons und der gesamte Sync-Bereich pro Plattform-Tab sind Stubs. Modul 12 implementiert die echte API-Anbindung. Das Datenmodell ist bereits darauf vorbereitet (external_listing_id, sync_status, last_synced_at).

---

## 6. Technische Details

### 6.1 Speicher-Verhalten

- Auto-Save nach 1.5s Inaktivität bei Textfeldern
- Manuelles Speichern via Cmd/Ctrl+S
- Speicher-Status sichtbar im Footer
- React Hook Form mit Zod-Resolver, Drizzle für DB-Calls

### 6.2 Plattform-Wert-Auflösung

Eine Helper-Funktion `getResolvedListingForPlatform(listing, platform)` liefert das aufgelöste Listing für eine Plattform:
- Pro Feld: Override-Wert wenn nicht NULL, sonst Master-Wert
- Tags: Override ersetzt komplett, nicht merge
- Bilder: gefiltert nach platforms-Array oder NULL
- Plattform-Limits: Werte werden NICHT automatisch gekürzt, nur markiert

Diese Funktion wird auch in der Vorschau, im Copy-Helfer und später in Modul 12 verwendet.

### 6.3 Command Palette Erweiterung

Neue Commands:
- "Neues Listing"
- "Listing-Liste öffnen"
- "Listing duplizieren"

### 6.4 Indizes

- listings: product_id (UNIQUE), status, language
- listing_platform_overrides: listing_id, platform (zusammen UNIQUE), sync_status
- listing_images: listing_id, sort_order
- listing_variants: listing_id, sort_order

---

## 7. Akzeptanzkriterien

- Master-Listing kann angelegt, bearbeitet und soft-deleted werden
- Pro Plattform kann ein Override aktiviert/deaktiviert werden
- Override-Felder zeigen Master-Wert als Platzhalter
- Zeichenzähler funktionieren für alle drei Plattformen korrekt
- Tag-Management mit Plattformlimits (Etsy max. 13)
- Bilder können aus Modul 03 verknüpft, sortiert und plattformspezifisch gefiltert werden
- Vollständigkeits-Ampel zeigt korrekten Status pro Plattform
- Vorschau-Tab zeigt sinnvolle Repräsentation für alle drei Plattformen
- Kleinanzeigen-Copy-Helfer kopiert formatierten Text in die Zwischenablage
- "Push to Platform"-Buttons sind deaktivierte Stubs mit Tooltip
- "Aus Vorlage erstellen" dupliziert Master + Overrides ohne Bilder
- Bulk-Aktionen (Pausieren, Aktivieren, Preis ±%, Löschen) funktionieren
- Inventory-Modus made_to_order und stock werden korrekt unterschieden (Stock-Feld nur sichtbar bei stock)
- Listing erscheint im Produkt-Detail-Panel (Modul 02)
- Auto-Save funktioniert
- TypeScript strict mode kompiliert ohne Fehler
- ESLint und Prettier laufen ohne Fehler

---

## 8. Hinweise für die KI-Implementierung (Codex)

- **Reihenfolge der Sub-Sessions**: Datenmodell + Schema → Listenansicht → Editor-Skelett → Master-Tab → Bilder-Tab → Varianten-Tab → Plattform-Tabs (Etsy/eBay/KA) → Vorschau → Bulk-Aktionen → Integration in Produkt-Detail-Panel.
- Jede Sub-Session muss mit grünem `npm run tauri dev` und Git-Commit enden.
- Keine Vorgriffe auf Modul 06 (KI) oder Modul 12 (Sync). Stubs bleiben Stubs.
- Bei Unsicherheiten zu Plattform-spezifischen Feldern: Default-Werte aus den Konstanten verwenden, nicht erfinden.
- Plattform-Limits sind in `constants.ts` zu definieren und zu importieren, nicht hardcoden.
