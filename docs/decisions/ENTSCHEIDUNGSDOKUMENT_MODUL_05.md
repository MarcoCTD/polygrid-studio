# Entscheidungsdokument Modul 05: Listing-Verwaltung

Datum: 28. April 2026
Status: Final, vor Implementierungsstart abgesegnet

---

## Kontext

Modul 05 implementiert die Listing-Verwaltung. Vor Implementierungsstart wurden mehrere Architektur-Fragen geklärt, die die Struktur des Moduls grundlegend beeinflussen. Dieses Dokument hält die Entscheidungen fest, damit sie während der Sub-Sessions nicht erneut diskutiert werden müssen.

---

## Entscheidung 1: Master-Listing mit Plattform-Overrides

**Frage**: Sollen pro Produkt drei separate Listings (Etsy, eBay, Kleinanzeigen) gepflegt werden oder ein Master-Listing mit plattformspezifischen Overrides?

**Entscheidung**: Master-Listing mit Plattform-Overrides.

**Begründung**:
- Reduziert Pflegeaufwand drastisch (eine Beschreibung statt drei)
- Master-Daten sind die Single Source of Truth, Overrides nur dort wo nötig
- Plattform-spezifische Anpassungen (kürzerer Titel für Kleinanzeigen, mehr Tags für Etsy) bleiben möglich
- Ermöglicht spätere Sync-Architektur in Modul 12 ohne Datenmodell-Umbau
- Konzeptionell sauber: Produkt → Master-Listing → Plattform-Repräsentation

**Konsequenzen**:
- Drei Tabellen: `listings` (Master), `listing_platform_overrides`, `listing_variants`
- UNIQUE-Constraint: ein Master-Listing pro Produkt
- Pro Plattform maximal ein Override-Record
- Helper-Funktion `getResolvedListingForPlatform` löst Master + Override pro Feld auf

---

## Entscheidung 2: Inventory-Modus für beide Fälle

**Frage**: Wird auf Bestellung oder aus Lagerbestand verkauft?

**Entscheidung**: Beides, konfigurierbar pro Listing.

**Begründung**:
- 3D-Druck-Geschäft hat oft beide Modelle parallel: Standard-Produkte auf Lager, Sonderanfertigungen auf Bestellung
- Etsy unterstützt beides explizit (readiness_state: ready_to_ship | made_to_order)
- eBay erfordert eine Mengenangabe, made_to_order wird als Quantity 1 mit ständiger Verfügbarkeit modelliert

**Konsequenzen**:
- Feld `inventory_mode` in `listings` mit Werten `made_to_order` und `stock`
- Feld `stock_quantity` nur befüllt bei `stock`-Modus
- UI blendet Stock-Felder dynamisch ein/aus
- In Modul 12 wird der Modus auf Plattform-spezifische Felder gemappt (Etsy `readiness_state`, eBay `availability.shipToLocationAvailability.quantity`)

---

## Entscheidung 3: Modul 12 als Stub-Spec vorbereiten

**Frage**: Soll das Platform-Sync-Modul jetzt schon spezifiziert werden?

**Entscheidung**: Ja, als Stub-Spec (Version 0.9), Implementierung später.

**Begründung**:
- Datenmodell von Modul 05 muss API-kompatibel sein (external_listing_id, sync_status, OAuth-relevante Felder)
- Ohne Stub-Spec besteht das Risiko, dass Modul 05 ein Datenmodell baut, das später umgebaut werden muss
- Stub-Spec ist nicht final, wird vor Modul-12-Start aktualisiert (besonders Etsy-API ändert sich oft)
- Schafft Klarheit, welche Felder in Modul 05 vorbereitet werden müssen

**Konsequenzen**:
- `docs/specs/MODUL_12_PLATFORM_SYNC.md` als Stub angelegt
- Modul 05 enthält Felder für späteren Sync (external_listing_id, sync_status, last_synced_at, platform_metadata)
- Sync-Buttons in Modul 05 sind deaktivierte Stubs mit Tooltip "Wird in Modul 12 verfügbar"
- PROJEKTREGELN.md aktualisiert um Modul 12

---

## Entscheidung 4: Kleinanzeigen ohne API-Anbindung

**Frage**: Wie wird Kleinanzeigen behandelt, da keine offizielle API existiert?

**Entscheidung**: Kleinanzeigen wird als Plattform unterstützt, aber mit Copy-Helfer statt API-Sync.

**Begründung**:
- Kleinanzeigen.de hat keine offizielle API für Listings
- Inoffizielle Scraper sind rechtlich grau und technisch fragil
- Manuelles Inserieren mit fertig formatiertem Text reduziert den Aufwand bereits erheblich
- Nutzer kann mehrere Listings pro Tag in PolyGrid vorbereiten und dann gesammelt auf Kleinanzeigen einstellen

**Konsequenzen**:
- Kleinanzeigen-Tab im Editor mit Copy-Buttons (Titel, Beschreibung, Komplett-Text)
- `sync_status` für Kleinanzeigen ist immer `manual`
- Button "Auf kleinanzeigen.de inserieren" öffnet die Inserate-Seite im Browser
- Modul 12 wird Kleinanzeigen explizit nicht implementieren

---

## Entscheidung 5: Bilder-Management via Modul 03

**Frage**: Wie werden Listing-Bilder verwaltet?

**Entscheidung**: Bilder werden via `file_links` aus dem Dateimanager (Modul 03) verknüpft. Eine eigene Tabelle `listing_images` regelt die Reihenfolge und plattformspezifische Filter.

**Begründung**:
- Bilder liegen ohnehin im OneDrive-Ordnerstruktur (`/02_Produkte/{produktordner}/Bilder/`)
- Doppelte Speicherung vermeiden
- Bestehende file_links-Infrastruktur nutzen
- Bild-Reihenfolge ist plattformspezifisch wichtig (Hauptbild zuerst)

**Konsequenzen**:
- Neue Tabelle `listing_images` mit FK auf `file_links.id`
- Drag-and-Drop-Sortierung im Bilder-Tab
- Plattform-Filter pro Bild (z.B. Bild nur für Etsy)
- Bild-Picker bevorzugt Bilder aus dem Produktordner

---

## Entscheidung 6: Auto-Save mit Debouncing

**Frage**: Wann werden Änderungen gespeichert?

**Entscheidung**: Auto-Save 1.5s nach letzter Änderung in Textfeldern, plus Cmd/Ctrl+S für manuelles Speichern.

**Begründung**:
- Listing-Editor ist groß, Datenverlust durch versehentliches Schließen wäre schmerzhaft
- 1.5s Debounce verhindert ständige DB-Calls bei jedem Tastendruck
- Sichtbarer Status im Footer ("Gespeichert", "Wird gespeichert...", "Ungesicherte Änderungen") gibt Vertrauen

**Konsequenzen**:
- React Hook Form mit `mode: 'onChange'` und Debounce-Logik im Editor-Container
- Speicher-Status als Zustand-Slice
- Cmd/Ctrl+S registriert sich über Shortcut Registry aus Foundation

---

## Entscheidung 7: Listing-Vorlagen statt erneuter Erstellung

**Frage**: Wie werden ähnliche Listings (z.B. Vasen-Serie) effizient angelegt?

**Entscheidung**: Funktion "Aus Vorlage erstellen" dupliziert ein bestehendes Listing als Basis für ein neues.

**Begründung**:
- 3D-Druck-Geschäft hat oft Produktserien (verschiedene Farben/Größen einer Vase)
- Beschreibungen, Tags, Kategorien sind oft identisch oder ähnlich
- Spart erheblich Zeit gegenüber Neu-Erstellung

**Konsequenzen**:
- Modal "Aus Vorlage erstellen" mit Listing-Picker und Zielprodukt-Auswahl
- Master-Daten und Override-Daten werden kopiert, Bilder NICHT (müssen produktspezifisch sein)
- Stock-Werte werden auf Default zurückgesetzt
- Status wird auf `draft` gesetzt

---

## Entscheidung 8: Bulk-Aktionen

**Frage**: Welche Bulk-Aktionen werden unterstützt?

**Entscheidung**: Pausieren, Aktivieren, Preis ±%, Soft-Delete.

**Begründung**:
- "Pausieren" ist häufiger Use-Case (Urlaub, Materialknappheit)
- "Preis ändern um X%" für Inflationsanpassung oder Sale
- Andere Bulk-Aktionen (Tags ändern, Beschreibung ändern) sind komplex und werden auf Einzel-Edit verwiesen

**Konsequenzen**:
- Action-Bar erscheint, wenn Zeilen ausgewählt sind
- Preis-Änderung mit Bestätigungsdialog (zeigt Vorher/Nachher)
- Soft-Delete via deleted_at

---

## Sub-Session-Aufteilung

Basierend auf den Entscheidungen werden folgende Sub-Sessions vorgeschlagen. Jede endet mit grünem `npm run tauri dev` und Git-Commit.

### Sub-Session 5.1: Datenmodell und Schema
- Drizzle-Schema für `listings`, `listing_platform_overrides`, `listing_variants`, `listing_images`
- Zod-Schemas in `src/features/listings/schemas.ts`
- Konstanten in `src/features/listings/constants.ts` (Plattform-Limits, Enums)
- Migration ausführen, DB-Struktur prüfen
- Commit: "feat(listings): add data model and schemas"

### Sub-Session 5.2: Listenansicht
- Route `/listings` mit TanStack Table
- Spalten, Filter, Suche, Bulk-Select
- Empty-State, wenn noch keine Listings
- Commit: "feat(listings): list view with table and filters"

### Sub-Session 5.3: Editor-Skelett und Master-Tab
- Route `/listings/$id` mit Tab-Layout
- Footer mit Speicher-Status und Action-Buttons
- Master-Tab vollständig funktional (alle Felder, React Hook Form, Auto-Save)
- KI-Buttons als Stubs
- Commit: "feat(listings): editor skeleton and master tab"

### Sub-Session 5.4: Bilder-Tab
- Bild-Picker (Integration mit Modul 03)
- Drag-and-Drop-Sortierung
- Plattform-Filter pro Bild
- Zähler und Warnungen bei Limit-Überschreitung
- Commit: "feat(listings): image management tab"

### Sub-Session 5.5: Varianten-Tab
- Tabelle mit CRUD für Varianten
- Drag-and-Drop-Sortierung
- Default-Variante-Validierung
- SKU-Generierung (sku_base + sku_suffix)
- Commit: "feat(listings): variants tab"

### Sub-Session 5.6: Plattform-Tabs (Etsy, eBay, Kleinanzeigen)
- Drei Tab-Komponenten mit gemeinsamer Basis
- Override-Felder mit Master-Wert als Placeholder
- Plattform-spezifische Felder (Taxonomy, Item Specifics etc.)
- Sync-Stub-Buttons mit Tooltip
- Kleinanzeigen-Copy-Helfer mit Clipboard-API
- Commit: "feat(listings): platform tabs with overrides"

### Sub-Session 5.7: Vorschau-Tab
- Drei Sub-Reiter (Etsy, eBay, Kleinanzeigen)
- Visuelle Repräsentation mit aufgelösten Werten
- Verwendung von `getResolvedListingForPlatform`
- Commit: "feat(listings): preview tab"

### Sub-Session 5.8: Vollständigkeits-Ampel und Bulk-Aktionen
- Pure Function `calculateCompleteness` pro Plattform
- Anzeige in Liste und Editor-Footer
- Bulk-Aktionen (Pausieren, Aktivieren, Preis ±%, Löschen)
- Commit: "feat(listings): completeness checks and bulk actions"

### Sub-Session 5.9: Vorlagen-Funktion und Produkt-Integration
- "Neues Listing"-Modal
- "Aus Vorlage erstellen"-Modal
- Integration ins Produkt-Detail-Panel (Modul 02 erweitern)
- Command Palette: neue Commands registrieren
- Commit: "feat(listings): templates and product integration"

### Sub-Session 5.10: Polish und Akzeptanztest
- Manuelles Durchgehen aller Akzeptanzkriterien
- Edge-Cases prüfen (leere Listings, sehr lange Texte, viele Bilder)
- ESLint und Prettier final
- Commit: "chore(listings): polish and finalize module"
- Branch `feat/modul-05-listing-verwaltung` mergen in main

---

## Risiken und Annahmen

- **Annahme**: Etsy- und eBay-Limits ändern sich nicht drastisch in den nächsten Wochen. Falls doch, sind sie als Konstanten zentral änderbar.
- **Risiko**: Drag-and-Drop für Bilder und Varianten kann auf Tauri-Windows-Builds anders funktionieren als auf macOS. Test auf beiden Plattformen am Ende des Moduls.
- **Risiko**: Kleinanzeigen ändert seine Inserate-Seite, dann funktioniert der Browser-Open-Button nicht mehr. Akzeptables Risiko, leicht zu fixen.
- **Annahme**: Bilder werden extern bearbeitet (Photoshop, GIMP). PolyGrid bietet keine Bildbearbeitung.

---

## Nicht-Ziele dieses Moduls

- Keine echte Plattform-API-Anbindung (Modul 12)
- Keine KI-Textgenerierung (Modul 06)
- Keine Bildbearbeitung
- Keine Auftragsabwicklung (Modul 08)
- Keine Bestandsabgleich zwischen Plattformen (Modul 12)
