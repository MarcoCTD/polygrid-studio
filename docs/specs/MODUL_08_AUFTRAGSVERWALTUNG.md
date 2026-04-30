# Modul 08: Auftragsverwaltung

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.1 | April 2026

> **Änderungen in v1.1 gegenüber v1.0:**
>
> - EÜR-Export ergänzt (Kleinunternehmer §19 UStG)
> - N26-CSV-Bankimport mit Auto-Matching ergänzt
> - Status-Modell vereinfacht (10 → 8 Werte)
> - Felder `receipt_number`, `payment_received_date`, `payout_amount`, `tax_locked` ergänzt
> - Neuer Sidebar-Bereich "Finanzen" eingeführt
> - Belegnummern-Generator (JAHR-LFD)
> - Sammelauszahlungs-Erkennung für Plattform-Auszahlungen

---

## 1. Scope und Ziel

Dieses Modul implementiert die Verwaltung von Kundenaufträgen mit Kanban-Board als Standardansicht und Tabelle als Alternative. Aufträge werden manuell erfasst (echte Plattform-Anbindung folgt in Modul 12). Zusätzlich liefert das Modul den EÜR-Export für die Einnahmen-Überschuss-Rechnung sowie den N26-CSV-Bankimport mit Auto-Matching gegen Aufträge und Ausgaben.

### 1.1 Lieferergebnisse

- Kanban-Board mit Drag-and-Drop Statusänderung (dnd-kit)
- Tabellenansicht als Alternative (TanStack Table)
- Neuer-Auftrag-Formular mit automatischer Belegnummer
- Detail-Panel mit Timeline, Kostenaufstellung, Marge, Tracking
- Status-Workflow (geführt, nicht erzwungen)
- Sidebar Badge-Counter für offene Aufträge
- Neuer Sidebar-Bereich "Finanzen" mit drei Tabs:
  - **EÜR-Export** (CSV + Excel mit 4 Sheets)
  - **Banktransaktionen** (N26-CSV-Import)
  - **Belegübersicht** (alle Aufträge + Ausgaben mit Beleg-Status)
- N26-CSV-Import mit Auto-Matching gegen Aufträge und Ausgaben
- Confidence-Score-System für Match-Vorschläge
- Sammelauszahlungs-Erkennung (1 Banktransaktion → n Aufträge)
- Belegnummern-Generator (Format `JAHR-LFD`)
- Tax-Lock-Mechanismus (steuerrelevante Daten nach Export schreibgeschützt)

### 1.2 Abhängigkeiten

- Foundation (Modul 01) für DB, Routing, Sidebar, Detail-Panel
- Produktverwaltung (Modul 02) für Produktreferenz
- Ausgabenverwaltung (Modul 04) für EÜR-Export-Datenquelle und Bank-Matching gegen Ausgaben

### 1.3 Explizit NICHT im Scope

- Keine Live-API-Anbindung an Etsy oder eBay (kommt in Modul 12)
- Keine Live-Banking-API (PSD2, FinTS) — nur CSV-Import
- Keine USt.-Verarbeitung (Kleinunternehmer §19 UStG)
- Keine automatische Statusänderung durch Bank-Match (nur Vorschlag mit Bestätigung)

---

## 2. Datenmodell

### 2.1 Tabelle `orders` (final)

| Feld                    | Typ                     | Pflicht | Beschreibung                                                |
| ----------------------- | ----------------------- | ------- | ----------------------------------------------------------- |
| id                      | TEXT (UUID)             | Ja      | Primärschlüssel                                            |
| receipt_number          | TEXT                    | Ja      | Auto-generiert: `JAHR-LFD` (z.B. `2026-0042`), unique       |
| external_order_id       | TEXT                    | Nein    | Bestell-ID der Plattform                                    |
| customer_name           | TEXT                    | Nein    | Kundenname                                                  |
| platform                | TEXT                    | Ja      | etsy, ebay, kleinanzeigen, direkt                           |
| product_id              | TEXT (FK → products.id) | Nein    | Referenz auf Produkt                                        |
| variant                 | TEXT                    | Nein    | Gewählte Variante                                           |
| quantity                | INTEGER                 | Ja      | Default: 1                                                  |
| sale_price              | REAL                    | Ja      | Verkaufspreis EUR (brutto = netto bei KU)                   |
| shipping_revenue        | REAL                    | Nein    | Vom Kunden gezahlte Versandkosten                           |
| shipping_cost           | REAL                    | Nein    | Tatsächliche Versandkosten (DHL, Hermes etc.)               |
| material_cost           | REAL                    | Nein    | Materialkosten dieses Auftrags (aus Produkt vorbefüllt)     |
| platform_fee            | REAL                    | Nein    | Plattformgebühren (aus Settings vorbefüllt)                 |
| payout_amount           | REAL                    | Nein    | Netto-Auszahlung der Plattform                              |
| status                  | TEXT                    | Ja      | inquiry, ordered, paid, in_production, shipped, completed, issue, cancelled |
| payment_status          | TEXT                    | Ja      | pending, paid, refunded, disputed                           |
| payment_received_date   | TEXT (ISO)              | Nein    | **Zuflussdatum für EÜR (§11 EStG)**                         |
| shipping_status         | TEXT                    | Nein    | not_shipped, shipped, delivered, returned                   |
| tracking_number         | TEXT                    | Nein    | Sendungsverfolgungsnummer                                   |
| order_date              | TEXT (ISO)              | Ja      | Bestelldatum                                                |
| notes                   | TEXT                    | Nein    | Freitext                                                    |
| tax_locked              | BOOLEAN                 | Ja      | Default: false. True nach EÜR-Export                        |
| bank_match_id           | TEXT (FK → bank_transactions.id) | Nein | Verknüpfung zur Banktransaktion                       |
| created_at              | TEXT (ISO)              | Ja      |                                                             |
| updated_at              | TEXT (ISO)              | Ja      |                                                             |
| deleted_at              | TEXT (ISO)              | Nein    | Soft-Delete (nur bei tax_locked = false erlaubt)            |

**Indizes**: `status`, `platform`, `order_date`, `payment_received_date`, `receipt_number` (unique)

### 2.2 Tabelle `bank_transactions` (neu)

| Feld                | Typ                              | Pflicht | Beschreibung                                          |
| ------------------- | -------------------------------- | ------- | ----------------------------------------------------- |
| id                  | TEXT (UUID)                      | Ja      | Primärschlüssel                                      |
| transaction_date    | TEXT (ISO)                       | Ja      | Buchungsdatum                                         |
| value_date          | TEXT (ISO)                       | Nein    | Wertstellungsdatum                                    |
| amount              | REAL                             | Ja      | Positiv = Eingang, negativ = Ausgang                  |
| description         | TEXT                             | Ja      | Verwendungszweck                                      |
| counterparty_name   | TEXT                             | Nein    | Absender/Empfänger                                    |
| counterparty_iban   | TEXT                             | Nein    | IBAN der Gegenseite                                   |
| transaction_type    | TEXT                             | Nein    | N26-Kategorie (z.B. "MasterCard Payment")             |
| matched_order_id    | TEXT (FK → orders.id)            | Nein    | Verknüpfter Auftrag (bei 1:1-Match)                   |
| matched_expense_id  | TEXT (FK → expenses.id)          | Nein    | Verknüpfte Ausgabe                                    |
| match_confidence    | TEXT                             | Nein    | high, medium, low, manual, unmatched                  |
| is_payout           | BOOLEAN                          | Ja      | Default: false. True bei Plattform-Sammelauszahlung   |
| import_batch_id     | TEXT (FK → import_batches.id)    | Ja      | UUID des Import-Laufs                                 |
| ignored             | BOOLEAN                          | Ja      | Default: false. Manuell als irrelevant markiert       |
| notes               | TEXT                             | Nein    | Freitext                                              |
| created_at          | TEXT (ISO)                       | Ja      |                                                       |

**Indizes**: `transaction_date`, `amount`, `import_batch_id`, `match_confidence`

### 2.3 Tabelle `import_batches` (neu)

| Feld              | Typ         | Pflicht | Beschreibung                              |
| ----------------- | ----------- | ------- | ----------------------------------------- |
| id                | TEXT (UUID) | Ja      | Primärschlüssel                          |
| source            | TEXT        | Ja      | n26, manual, future-api                   |
| imported_at       | TEXT (ISO)  | Ja      | Zeitpunkt des Imports                     |
| filename          | TEXT        | Nein    | Original-CSV-Dateiname                    |
| transaction_count | INTEGER     | Ja      | Anzahl importierter Zeilen                |
| matched_count     | INTEGER     | Ja      | Anzahl Auto-Matches                       |
| date_range_start  | TEXT (ISO)  | Nein    | Frühestes Datum im Import                 |
| date_range_end    | TEXT (ISO)  | Nein    | Spätestes Datum im Import                 |

### 2.4 Junction-Tabelle `bank_payout_orders` (neu, für Sammelauszahlungen)

Bildet die n:m-Beziehung ab, wenn eine Banktransaktion eine Sammelauszahlung mehrerer Aufträge ist.

| Feld                | Typ                               | Pflicht | Beschreibung                            |
| ------------------- | --------------------------------- | ------- | --------------------------------------- |
| id                  | TEXT (UUID)                       | Ja      | Primärschlüssel                        |
| bank_transaction_id | TEXT (FK → bank_transactions.id)  | Ja      | Banktransaktion                         |
| order_id            | TEXT (FK → orders.id)             | Ja      | Verknüpfter Auftrag                     |
| allocated_amount    | REAL                              | Ja      | Zugeordneter Anteil dieser Auszahlung   |
| created_at          | TEXT (ISO)                        | Ja      |                                         |

**Indizes**: `bank_transaction_id`, `order_id`

---

## 3. Status-Modell

| Status          | Bedeutung                                | Bank-Match-Effekt                  |
| --------------- | ---------------------------------------- | ---------------------------------- |
| `inquiry`       | Kundenanfrage, noch keine Bestellung     | —                                  |
| `ordered`       | Bestellt, noch nicht bezahlt             | Bei Match: Vorschlag → `paid`      |
| `paid`          | Bezahlt, Produktion läuft oder steht an  | —                                  |
| `in_production` | Wird gedruckt                            | —                                  |
| `shipped`       | Versendet                                | —                                  |
| `completed`     | Abgeschlossen (Geld da, Ware beim Kunden)| —                                  |
| `issue`         | Reklamation/Problem                      | —                                  |
| `cancelled`     | Storniert                                | —                                  |

**Workflow:** Nicht erzwungen. Jeder Status kann direkt gesetzt werden. Empfohlene Reihenfolge wird durch UI suggeriert.

---

## 4. UI-Spezifikation

### 4.1 Kanban-Board (Standardansicht, Route `/orders`)

Spalten:

- **Anfrage** (inquiry)
- **Bestellt** (ordered)
- **Bezahlt** (paid)
- **In Produktion** (in_production)
- **Versendet** (shipped)
- **Abgeschlossen** (completed)
- **Problem** (issue, cancelled)

Jede Karte zeigt: Belegnummer, Produktname, Plattform-Icon, Kundenname, Betrag, Datum. Drag-and-Drop zwischen Spalten ändert den Status. Klick öffnet Detail-Panel.

**Spezialfall:** Karten mit `tax_locked = true` zeigen ein Schloss-Icon und können nur in den Status `issue` (Stornierung) verschoben werden.

### 4.2 Tabellenansicht (Toggle oben rechts)

Spalten: Belegnummer, Status-Badge, Plattform, Produkt, Kunde, Verkaufspreis, Zahlungseingang, Bestelldatum, Zahlungsstatus, Versandstatus, Locked-Icon. Standard-Filter: nicht-stornierte des laufenden Jahres. Filter: Status (Multi), Plattform, Zeitraum, Bank-Match (matched/unmatched).

### 4.3 Detail-Panel

- Header: Belegnummer + Status-Badge + Locked-Indikator (falls tax_locked)
- Tab "Übersicht": Alle Auftragsfelder als editierbares Formular
- Tab "Timeline": Chronologische Statusänderungen mit Zeitstempel
- Tab "Kosten": Live-berechnete Marge

  ```
  Verkaufspreis:           24,90 €
  + Versanderlös:           4,99 €
  ────────────────────────────────
  Brutto-Einnahme:         29,89 €

  Materialkosten:          -2,40 €
  Versandkosten:           -3,50 €
  Plattformgebühr:         -1,82 €
  ────────────────────────────────
  Marge:                   22,17 € (74,2%)
  ```

  Mit Ampel-Farbe analog Modul 02.

- Tab "Bank-Match": Zeigt verknüpfte Banktransaktion oder "Kein Match" mit Button "Manuell verknüpfen"

### 4.4 Neuer Auftrag (Modal)

Formular:

- Plattform (Pflicht)
- Produkt (Dropdown mit Suche, optional)
- Variante
- Menge (Default: 1)
- Verkaufspreis (Pflicht)
- Versanderlös (optional)
- Kundenname
- Externe Bestell-ID
- Bestelldatum (Default: heute)
- Zahlungseingangsdatum (optional, kann später nachgetragen werden)

**Auto-Befüllung:**

- Material- und Plattformgebühr werden aus Produkt + Settings vorbefüllt
- Belegnummer wird automatisch vergeben (`JAHR-LFD`, lückenlos)
- Status wird auf `ordered` gesetzt (wenn Zahlungseingangsdatum leer) oder `paid` (wenn gesetzt)

**Backfill-Modus:** Checkbox "Vergangener Auftrag" deaktiviert die Datumsvalidierung und erlaubt freie Datumseingabe. Nützlich beim erstmaligen Erfassen alter Aufträge.

### 4.5 Sidebar-Integration

Badge-Counter zeigt Anzahl offener Aufträge (Status: `ordered`, `paid`, `in_production`, `shipped`).

---

## 5. Belegnummern-Generator

### 5.1 Format

`JAHR-LFD` mit 4-stelliger laufender Nummer, jährlich zurückgesetzt:

- `2026-0001`, `2026-0002`, ..., `2026-9999`
- Ab 10000 wird automatisch auf 5 Stellen erweitert

### 5.2 Generierungs-Logik

```typescript
function generateReceiptNumber(year: number): string {
  // SELECT MAX(receipt_number) WHERE receipt_number LIKE 'JAHR-%'
  // Parse last counter, increment, format with leading zeros
}
```

**Wichtig:** Lückenlos. Bei Stornierung bleibt die Nummer erhalten (Auftrag wechselt auf `cancelled`, Belegnummer wird NICHT wiederverwendet). Das ist Pflicht für Finanzamt-Konformität.

### 5.3 Eindeutigkeit

`receipt_number` ist UNIQUE. Bei Race-Conditions (paralleles Anlegen) wird die Generierung in einer Transaktion durchgeführt.

---

## 6. EÜR-Export

### 6.1 Verortung

Neuer Sidebar-Eintrag **"Finanzen"** unter "Analysen" mit drei Tabs:

1. **EÜR-Export** (Hauptzweck)
2. **Banktransaktionen** (N26-Import + Liste)
3. **Belegübersicht** (Audit-Liste aller Buchungen)

### 6.2 Export-Konfiguration

- **Zeitraum**: Monat, Quartal, Jahr (Default: laufendes Jahr), Custom-Range
- **Format**: CSV oder Excel (.xlsx) oder beides
- **Inhalt**: Nur Aufträge mit `payment_received_date` im Zeitraum + alle Ausgaben mit `date` im Zeitraum
- **Optional**: "Tax-Lock setzen nach Export" (Checkbox, Default: an für Jahresexport, aus für Monatsexport)

### 6.3 Spaltenstruktur (CSV und Excel "Einzelposten")

| Spalte             | Beispiel                                              | Quelle                                                      |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------- |
| Beleg-Nr.          | 2026-0042                                             | `orders.receipt_number` / generiert für expenses            |
| Datum              | 2026-04-15                                            | `payment_received_date` (orders) / `date` (expenses)        |
| Art                | Einnahme                                              | "Einnahme" oder "Ausgabe"                                   |
| Buchungstext       | Verkauf Etsy: Cable Organizer (Bestell-Nr. 3421789)   | Auto-generiert aus Produkt + Plattform + external_order_id  |
| Kategorie          | Betriebseinnahmen                                     | EÜR-konforme Kategorie (Mapping siehe 6.5)                  |
| Betrag             | 24,90                                                 | EUR                                                          |
| Plattform/Händler  | Etsy                                                  | `platform` (orders) / `vendor` (expenses)                   |
| Beleg vorhanden    | Ja                                                    | `receipt_attached` (expenses) / immer "Ja" (orders)         |
| Externe Referenz   | 3421789                                               | `external_order_id` / leer bei expenses                     |

### 6.4 Excel-Struktur (4 Sheets)

**Sheet 1: Übersicht**

```
PolyGrid Studio Business OS – EÜR-Auswertung
Zeitraum: 01.01.2026 – 31.12.2026

Summe Einnahmen:           4.234,50 €
Summe Ausgaben:           -1.892,30 €
─────────────────────────────────────
Saldo (Gewinn):            2.342,20 €

Anzahl Aufträge:                  87
Anzahl Ausgaben-Buchungen:        43

Hinweis: Kleinunternehmer gemäß §19 UStG.
Keine Umsatzsteuer ausgewiesen.

Disclaimer: Dieser Export ersetzt keine
steuerliche Buchführung. Bitte alle
Daten vor Abgabe prüfen.
```

**Sheet 2: Einnahmen**

Alle Aufträge im Zeitraum mit Spalten aus 6.3, sortiert nach `payment_received_date`.

**Sheet 3: Ausgaben**

Alle Ausgaben im Zeitraum mit Spalten aus 6.3, sortiert nach `date`.

**Sheet 4: Kategorien-Aggregation**

```
Einnahmen nach Plattform:
  Etsy            3.890,00 €  (87,4%)
  eBay              344,50 €  (7,7%)
  Kleinanzeigen       0,00 €  (0,0%)

Ausgaben nach Kategorie:
  Filament          642,00 €  (33,9%)
  Verpackung        287,50 €  (15,2%)
  Versand           412,80 €  (21,8%)
  Software/SaaS     180,00 €  (9,5%)
  Werbung           120,00 €  (6,3%)
  ...
```

### 6.5 Kategorien-Mapping (EÜR-konform)

| PolyGrid-Quelle               | EÜR-Kategorie                                              |
| ----------------------------- | ---------------------------------------------------------- |
| `orders.*`                    | Betriebseinnahmen aus Lieferungen und Leistungen           |
| `expenses.category=Filament`  | Wareneinkauf                                               |
| `expenses.category=Verpackung`| Wareneinkauf                                               |
| `expenses.category=Werkzeuge` | Geringwertige Wirtschaftsgüter                             |
| `expenses.category=Druckerzubehör`| Reparatur und Instandhaltung                           |
| `expenses.category=Maschinen/Hardware`| Anschaffung Anlagevermögen (Hinweis: ggf. AfA prüfen)|
| `expenses.category=Software/SaaS`| Sonstige betriebliche Aufwendungen                      |
| `expenses.category=Werbung`   | Werbekosten                                                |
| `expenses.category=Versand`   | Porto / Versandkosten                                      |
| `expenses.category=Reisekosten`| Reisekosten                                               |
| `expenses.category=Büro`      | Bürobedarf                                                 |
| `expenses.category=Sonstiges` | Sonstige betriebliche Aufwendungen                         |

### 6.6 Tax-Lock-Mechanismus

- Optional beim Export aktivierbar
- Setzt `tax_locked = true` auf alle exportierten Datensätze
- Locked-Datensätze: nicht editierbar, nicht löschbar (Soft-Delete blockiert)
- Stornierung weiterhin möglich (Status → `cancelled`, plus Anlage einer Gegenbuchung)
- UI-Indikator: Schloss-Icon, ausgegrautes Formular, Hinweis "Steuerlich gesperrt seit JAHR-MM-TT"

### 6.7 Disclaimer

Dauerhaft sichtbar im Finanzen-Bereich (analog zu Modul 04):

> **Diese Auswertung unterstützt die Erfassung deiner Einnahmen und Ausgaben. Sie ersetzt keine steuerliche Buchführung. Bitte konsultiere deinen Steuerberater oder prüfe alle Werte vor Abgabe sorgfältig.**

---

## 7. N26-CSV-Bankimport

### 7.1 N26-CSV-Format

N26 exportiert Umsätze als CSV mit Header (Stand 2026):

```
"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
```

Encoding: UTF-8 mit BOM. Datumsformat: `YYYY-MM-DD`. Dezimaltrennzeichen: Punkt.

### 7.2 Import-Workflow

1. **Datei-Upload**: Drag-and-Drop oder Datei-Auswahl
2. **Spalten-Mapping**: Auto-Detect für N26-Standard-Header, manuell anpassbar (analog Modul 04)
3. **Vorschau**: Erste 10 Zeilen mit erkannten Werten
4. **Duplikatsprüfung**: Transaktionen mit identischem `transaction_date + amount + description` werden nicht doppelt importiert
5. **Auto-Matching**: Siehe 7.3
6. **Import-Bericht**: "X importiert, Y davon auto-gematcht, Z benötigen manuelle Verknüpfung"

### 7.3 Auto-Matching-Logik

Pro importierter Banktransaktion (positiv = Einnahme):

**Schritt 1: Sammelauszahlung erkennen**

- Wenn `counterparty_name` enthält "Etsy", "Etsy Ireland", "Etsy Inc" → markiere als `is_payout = true`, Plattform = etsy
- Wenn `counterparty_name` enthält "eBay", "Ebay Marketplaces" → markiere als `is_payout = true`, Plattform = ebay
- Wenn `counterparty_name` enthält "PayPal" → keine Sammelauszahlung, prüfe gegen einzelne Aufträge

**Schritt 2: Bei Sammelauszahlung**

- Suche alle Aufträge dieser Plattform mit Status `ordered`/`paid`/`shipped` und `payment_received_date IS NULL`
- Berechne Summe der erwarteten Auszahlungen (sale_price - platform_fee) im Zeitfenster (Auftrag-Datum bis 14 Tage vor Auszahlung)
- Wenn Summe ± 1% der Auszahlung entspricht: Match-Vorschlag mit Confidence `high`
- Bei Bestätigung: Junction-Einträge in `bank_payout_orders` für jeden enthaltenen Auftrag, `payment_received_date` gesetzt auf Bank-Datum

**Schritt 3: Bei Einzeltransaktion (nicht Sammelauszahlung)**

- Suche Aufträge mit `sale_price + (shipping_revenue ?? 0) == amount` (±0,02 €) und Status `ordered`/`paid`
- Zeitfenster: Banktransaktion innerhalb 14 Tage nach `order_date`
- Confidence:
  - **high**: Betrag exakt + Kundenname oder Plattformname im Verwendungszweck
  - **medium**: Betrag exakt
  - **low**: Betrag ±0,02 € (Rundungsdifferenz)

**Schritt 4: Bei Ausgang (negative Beträge)**

- Suche Ausgaben mit `amount_gross == abs(amount)` (±0,02 €)
- Zeitfenster: Banktransaktion innerhalb ±7 Tage von `expenses.date`
- Confidence wie oben, plus Bonus wenn `vendor` im Verwendungszweck enthalten

### 7.4 Manuelles Matching

UI-Komponente "Match-Workbench":

- Linke Seite: Liste unverknüpfter Banktransaktionen
- Rechte Seite: Vorgeschlagene Matches (sortiert nach Confidence)
- Buttons: "Verknüpfen", "Ablehnen", "Sammelauszahlung manuell zusammenstellen", "Ignorieren"
- Filter: Nur Eingänge / Nur Ausgänge / Alle

### 7.5 Wirkung bei Bestätigung eines Matches

- Auftrag bekommt `bank_match_id` und `payment_received_date`
- Wenn Auftragsstatus `ordered`: Vorschlag-Dialog "Status auf 'paid' setzen?" (Default: ja)
- Banktransaktion bekommt `match_confidence = manual` (oder behält Auto-Confidence)

---

## 8. Belegübersicht

Tab im Finanzen-Bereich. Zeigt eine konsolidierte Liste aller Aufträge und Ausgaben mit Beleg-Status:

| Datum      | Beleg-Nr. | Art       | Buchungstext            | Betrag    | Beleg | Bank-Match |
| ---------- | --------- | --------- | ----------------------- | --------- | ----- | ---------- |
| 2026-04-15 | 2026-0042 | Einnahme  | Verkauf Etsy: ...       | +24,90 €  | ✓     | ✓ high     |
| 2026-04-14 | E-0089    | Ausgabe   | Filament PLA Sunlu      | -22,90 €  | ✗     | ✓ medium   |

Filter: Zeitraum, Art, Beleg fehlt, Match fehlt, Status. Sortierung: nach Datum DESC.

Zweck: Schnell sehen, welche Belege noch fehlen oder welche Buchungen noch keinen Bank-Match haben.

---

## 9. Akzeptanzkriterien

### 9.1 Kern-Auftragsverwaltung

- Kanban-Board zeigt Aufträge in korrekten Spalten
- Drag-and-Drop ändert Status und persistiert
- Tabellenansicht funktioniert als Alternative
- Detail-Panel zeigt Timeline korrekt
- Kostenberechnung mit Marge wird live aktualisiert
- Sidebar-Badge zeigt korrekte Anzahl offener Aufträge
- Neuer Auftrag bekommt automatisch eindeutige Belegnummer im Format `JAHR-LFD`
- Belegnummern sind lückenlos und werden bei Stornierung nicht wiederverwendet
- Backfill-Modus erlaubt freies Datum
- Soft-Delete funktioniert (außer bei tax_locked)

### 9.2 EÜR-Export

- Sidebar-Eintrag "Finanzen" ist sichtbar und navigierbar
- EÜR-Export erzeugt korrekte CSV mit allen Spalten
- Excel-Export hat 4 Sheets mit korrekten Inhalten
- Zeitraum-Filter (Monat, Quartal, Jahr, Custom) funktionieren
- Disclaimer ist im Excel-Sheet "Übersicht" enthalten
- Tax-Lock setzt `tax_locked = true` auf alle exportierten Datensätze
- Locked-Datensätze sind nicht editierbar
- Kategorien-Mapping ist EÜR-konform

### 9.3 Bankimport

- N26-CSV wird mit Standard-Header automatisch erkannt
- Spalten-Mapping kann manuell angepasst werden
- Duplikatsprüfung verhindert Doppel-Import
- Auto-Matching liefert Confidence-Scores
- Sammelauszahlungen werden erkannt und können auf mehrere Aufträge aufgeteilt werden
- Manuelles Matching über Match-Workbench funktioniert
- Bei Match-Bestätigung wird `payment_received_date` und `bank_match_id` gesetzt
- Status-Vorschlag bei `ordered` → `paid` erscheint und ist bestätigungspflichtig

### 9.4 Belegübersicht

- Liste zeigt alle Aufträge und Ausgaben kombiniert
- Filter "Beleg fehlt" und "Match fehlt" funktionieren
- Sortierung nach Datum funktioniert

---

## 10. Sub-Session-Aufteilung für Codex

Branch: `feat/modul-08-auftragsverwaltung`

| #   | Inhalt                                                                                                          | Endzustand                                          |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 8.1 | Schema-Migration: orders final, bank_transactions, import_batches, bank_payout_orders. Zod-Schemas. Belegnummer-Generator mit Tests | DB-Migration läuft, Generator getestet              |
| 8.2 | Auftrags-CRUD: Modal "Neuer Auftrag", Tabellen-Ansicht, Soft-Delete mit tax_locked-Check, Filter, Backfill-Modus | Aufträge anlegbar/editierbar, Tabelle funktional    |
| 8.3 | Kanban-Board mit dnd-kit, Status-Workflow, Sidebar Badge-Counter                                                | Kanban funktioniert, Drag-and-Drop persistiert      |
| 8.4 | Detail-Panel: Timeline, Kostenaufstellung mit Live-Marge, Tracking-Eingabe, Zahlungseingangsdatum, Bank-Match-Tab | Detail-Panel zeigt alles, editierbar                |
| 8.5 | Sidebar-Bereich "Finanzen", EÜR-Export (CSV + xlsx via exceljs), Filter, Tax-Lock-Mechanismus                   | EÜR-Export erzeugt korrekte Dateien                 |
| 8.6 | N26-CSV-Import: Spalten-Mapping, Auto-Matching mit Confidence, Match-Workbench, Sammelauszahlungs-Erkennung    | Bankimport läuft, Matches werden vorgeschlagen      |
| 8.7 | Belegübersicht-Tab mit konsolidierter Liste und Filtern                                                         | Belegübersicht funktional                           |

Nach 8.7 PR und Merge auf main.

---

## 11. Hinweise für die Implementierung

- **exceljs** für Excel-Export (npm install exceljs)
- **dnd-kit** ist bereits aus Modul 05 verfügbar
- **TanStack Table v8** für Tabellenansichten und Match-Workbench
- **Recharts** ist nicht nötig in diesem Modul
- **Belegnummer-Generator** muss in einer Drizzle-Transaktion laufen, um Race-Conditions zu vermeiden
- **CSV-Parser** für N26-Import: Bereits aus Modul 04 verfügbar (papaparse)
- **Tax-Lock-Validierung** als Drizzle-Middleware oder Zod-Refine, sodass Updates auf locked Datensätze fehlschlagen
