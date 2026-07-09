# Entscheidungen Modul 14 – EÜR-Jahresexport

PolyGrid Studio Business OS | Juli 2026
Ergebnis der Prüfaufträge vor der Implementierung. Referenz: `docs/specs/MODUL_14_EUER_EXPORT.md`.

---

## 1. Semantik von `shipping_cost` und Einnahmen-Formel (Spec 2.1)

**Befund:** Modul 08 trennt die beiden Richtungen sauber in zwei Felder
(`src/services/database/schema.ts`, `docs/specs/DATABASE_SCHEMA.md`):

| Feld | Bedeutung |
|---|---|
| `shipping_revenue` | Vom Kunden gezahlte Versandkosten (Einnahme) |
| `shipping_cost` | Tatsächliche Versandkosten des Verkäufers (DHL, Hermes – Kostenseite) |

`shipping_cost` ist also eindeutig **Verkäuferkosten** und fließt NICHT in die
Einnahmen ein. Die vom Käufer gezahlten Versandkosten stehen in
`shipping_revenue` und werden als Einnahme mitgezählt. Das ist konsistent zum
bestehenden Modul-08-EÜR-Export und zum N26-Bank-Matching, die beide mit
`sale_price + COALESCE(shipping_revenue, 0)` arbeiten.

**Zusatzbefund zur Spec-Formel `sale_price * quantity`:** `sale_price` ist im
gesamten Bestand der **Gesamtbetrag des Auftrags**, kein Stückpreis. Belege:

- Bank-Matching (Modul 08): sucht Transaktionen mit
  `sale_price + (shipping_revenue ?? 0) == Betrag` – ohne quantity.
- Dashboard/Analytics (Modul 10): Umsatz = `SUM(sale_price)` – ohne quantity.
- Bestehender EÜR-Export (Modul 08): `sale_price + COALESCE(shipping_revenue, 0)`.

Eine Multiplikation mit `quantity` würde alle Aufträge mit Menge > 1 doppelt
zählen und die harte Regel „Summen müssen mit den bestehenden Anzeigen
übereinstimmen“ verletzen.

**Entscheidung:**
`Einnahme pro Auftrag = sale_price + COALESCE(shipping_revenue, 0)`.
`shipping_cost` bleibt außen vor. Keine quantity-Multiplikation (bewusste,
dokumentierte Abweichung vom Spec-Wortlaut zugunsten der Datenkonsistenz).
Die Menge wird im Einnahmen-Sheet als eigene Spalte informativ ausgewiesen.

---

## 2. Timeline und paid-Zeitpunkt (Spec 2.1)

**Befund:** Die Timeline ist eine **eigene Tabelle** `order_events`
(Modul 08, `src/services/database/schema.ts` Abschnitt 6c) mit
`event_type = 'status_change'`, `from_value`, `to_value`, `created_at`.

Der paid-Zeitpunkt ist daraus allein NICHT zuverlässig extrahierbar:

1. Ein Auftrag kann `ordered → shipped → completed` durchlaufen, ohne je den
   Status `paid` zu tragen (Zahlung wird über `payment_status` geführt).
   Für solche Aufträge existiert kein `to_value = 'paid'`-Event.
2. `created_at` des Events ist der Klick-Zeitpunkt in der App, nicht
   zwingend der Zufluss-Zeitpunkt (Nacherfassung).
3. Es existiert bereits das Feld `orders.payment_received_date`
   („Zuflussdatum für EÜR, §11 EStG“ – so explizit im DB-Schema und in
   `docs/decisions/MODUL_08_ENTSCHEIDUNGEN.md`). Es wird vom Order-Service
   beim Statuswechsel auf paid/completed automatisch gesetzt, vom
   N26-Bank-Import mit dem Bank-Buchungsdatum überschrieben und ist manuell
   korrigierbar.

**Entscheidung (Fallback-Kaskade, pro Auftrag):**

1. `payment_received_date` – Datumsquelle „Zahlungsdatum“ (der fachlich
   korrekte Zufluss nach §11 EStG; deckt auch Bank-Import-Fälle ab).
2. Frühestes `order_events`-Event mit `status_change` auf `paid` oder
   `completed` – Datumsquelle „Timeline“.
3. `order_date` – Datumsquelle „Bestelldatum (Fallback)“; wird im Export in
   der Spalte „Datumsquelle“ gekennzeichnet und in der Vorschau als Warnung
   gezählt.

Damit wird der Spec-Intention (echter Zuflusszeitpunkt statt Bestelldatum)
entsprochen und Altdaten bleiben exportierbar.

---

## 3. Platzierung der Export-Seite (Spec 1.1)

**Befund zur bestehenden Navigation:**

- `/analytics` (Modul 10): eine Seite ohne Tabs (KPIs, Charts).
- `/finance` (Modul 08): Tabs „EÜR-Export“ (zeitraumbasierter Buchungsexport
  CSV/Excel mit Tax-Lock), „Banktransaktionen“, „Belegübersicht“.
- `/settings` (Modul 11): 5 Tabs, „Sicherheit“ behandelt Backups/Keys.

**Entscheidung: `/analytics`, eigener Tab „Steuer-Export“.**

Begründung:
- Die Spec bietet genau zwei Optionen an (Analytics-Tab oder
  Settings-Sicherheit). Settings-Sicherheit ist thematisch Backups/API-Keys –
  ein Jahresabschluss-Export würde dort schlecht auffindbar sein.
- Der Export ist inhaltlich eine Jahres-Auswertung (Aggregation von Einnahmen/
  Ausgaben) und passt zur Analysen-Seite; das Kleinunternehmergrenzen-Widget
  ist ohnehin Analytics-Natur.
- Die Analysen-Seite erhält dazu eine Tab-Leiste („Auswertung“ = bisheriger
  Inhalt als Default, „Steuer-Export“ = neu). Bestehendes Verhalten und
  bestehende Tests bleiben unverändert.

**Abgrenzung zum Modul-08-Export:** Der bestehende Tab „EÜR-Export“ unter
Finanzen (buchungszeilenorientiert, CSV+Excel, Monat/Quartal/Jahr, Tax-Lock)
bleibt **unangetastet** – er ist Modul-08-Scope. Modul 14 liefert den
strukturierten **Jahres**-Abschlussexport nach eigener Spec (vier Sheets,
Monatsübersicht, Datumsquelle, Nicht-enthalten-Abschnitte, OneDrive-Ziel).
Eine spätere Konsolidierung beider Exporte ist möglich, aber nicht Scope von
Modul 14. Ein Tax-Lock wird im Modul-14-Export bewusst nicht ausgelöst
(nicht in der Spec; wer sperren will, nutzt weiterhin den Modul-08-Export).

---

## 4. Weitere Implementierungsentscheidungen

### 4.1 Einnahmen-Basis und Abschnitt „Nicht enthalten“

Gemäß Spec 2.1: Basis sind Aufträge mit `status IN (completed, shipped)` UND
`payment_status = 'paid'` (Soft-Delete ausgenommen). Aufträge derselben
Statusmenge mit `payment_status IN (refunded, disputed)` werden im
Einnahmen-Sheet unter „Nicht enthalten“ ausgewiesen, aber nicht summiert.
Completed-Aufträge mit `payment_status = 'pending'` erzeugen die
Dateninkonsistenz-Warnung in der Vorschau (Spec 4). Hinweis: Der
Modul-08-Export zählt zusätzlich Status `paid` mit – für den
Jahresabschluss gilt die engere Spec-14-Definition.

### 4.2 Konsistenz-Anker für Summen

- **Ausgaben:** identische Semantik wie Ausgaben-Seite/Analytics
  (`SUM(amount_gross)`, `deleted_at IS NULL`, Gruppierung nach `category`).
  Die Ausgaben-Seite summiert ohne `tax_relevant`-Filter; deshalb gilt:
  steuerrelevante Summe + nicht-steuerrelevante Summe = Seitensumme.
  Ein Test verifiziert das pro Kategorie.
- **Dashboard:** Die neue Kleinunternehmergrenzen-Karte verwendet auf
  Dashboard und Export-Seite dieselbe Service-Funktion (Einnahmen-Definition
  Spec 2.1, laufendes Jahr) – identische Werte per Konstruktion, per E2E-Test
  abgesichert. Die bestehende Dashboard-Umsatz-KPI (nur `completed`, nach
  `order_date`, Monatsfenster) hat eine bewusst andere Definition und bleibt
  unverändert.

### 4.3 Kleinunternehmergrenzen

Konstanten im Code mit Kommentar (Gesetzesstand 2025er Reform, §19 UStG):
Vorjahresgrenze 25.000 EUR, laufende Grenze 100.000 EUR. Nicht konfigurierbar.
Ampel: grün < 80 % von 25.000, gelb 80–100 %, rot > 100 % mit Hinweistext.

### 4.4 Schreiben nach OneDrive `/01_Finanzen/Exporte/`

Der Dateimanager (Modul 03) bietet nur Rust-Commands für Verzeichnis-/
Verschiebe-Operationen, kein binäres Schreiben; das `fs`-Plugin-Capability
umfasst nur `write-text-file`. Entscheidung: neuer Rust-Command
`write_export_file` im bestehenden `filesystem::commands`-Modul, mit derselben
Basis-Pfad-Validierung wie die übrigen Commands (OneDrive-Ziel) bzw.
`base_path = None` für den vom Nutzer per nativem Speichern-Dialog gewählten
Pfad. Keine neue Dependency, keine Capability-Änderung, kein Schema-Bruch.
Der Zielordner wird vor dem Schreiben per `create_dir_all` sichergestellt.

### 4.5 Dateiname

`euer_{jahr}_{firmenname-slug}.xlsx`; Slug = Kleinbuchstaben, Umlaute
transliteriert (ä→ae …), Sonderzeichen entfernt, Leerzeichen → Bindestrich
(gleiche Normalisierungsregel wie Produktordner in Modul 03). Firmenname aus
Setting `company_name` (Default „PolyGrid Studio“).

### 4.6 Code-Ablage

Fachlogik unter `src/features/finance/` (Domäne EÜR/Steuern):
`services/euerYear.ts` (reine Aggregation, unit-getestet),
`services/euerYearWorkbook.ts` (exceljs),
`services/euerYearService.ts` (DB-Zugriff, Export, Warnungen),
`components/SteuerExportTab.tsx`, `components/KleinunternehmerGrenzeCard.tsx`.
Die Analysen-Seite bindet den Tab ein; das Dashboard bindet die Karte ein
(Cross-Feature-Import ist etabliertes Muster, vgl. Dashboard → Analytics).
