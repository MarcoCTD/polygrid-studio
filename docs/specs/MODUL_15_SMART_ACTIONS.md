# Modul 15: Verkaufszahlen und Smart Actions

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026

## 1. Scope und Ziel

Zwei zusammengehörige Teile: (1) Verkaufsstatistik pro Produkt, aggregiert aus den Aufträgen. (2) Smart Actions: klickbare Hinweis-Karten, die einen Zustand in den Daten erkennen und die logische Folgeaktion anbieten (Klick springt direkt zur gefilterten Ansicht oder öffnet den passenden Dialog). Keine KI, alles regelbasiert. Keine neuen Tabellen.

### 1.1 Lieferergebnisse

- Verkaufszahlen pro Produkt: neuer Tab "Verkäufe" im Produkt-Detail-Panel, neue Spalte "Verkauft" in der Produktliste, Widget "Top-Seller" auf dem Dashboard
- Smart-Action-Registry (erweiterbares Registry-Pattern analog Command Registry)
- 8 Start-Regeln (siehe Abschnitt 4)
- Dashboard-Bereich "Empfohlene Aktionen" mit den aktiven Smart Actions
- Verwerfen-Funktion pro Karte (Snooze 7 Tage, persistiert in app_settings)

### 1.2 Abhängigkeiten

Foundation, Produkte (02), Ausgaben (04), Listings (05), Aufträge (08), Aufgaben (09), Dashboard (10), Settings (11), EÜR-Export (14, für die Grenzen-Regel).

### 1.3 Explizit NICHT im Scope

- Keine KI-generierten Empfehlungen
- Keine Push-/OS-Benachrichtigungen
- Keine eigene Tabelle für Smart Actions (Zustand wird live berechnet, Snooze in app_settings)
- Keine Bestandsführung/Lagerverwaltung

## 2. Verkaufszahlen pro Produkt

### 2.1 Definition

Ein Verkauf = Auftrag mit payment_status = paid und Status nicht cancelled, gruppiert nach product_id. Menge = Summe quantity, Umsatz = Summe sale_price * quantity. Aufträge ohne product_id werden ignoriert. Soft-deleted Aufträge ausgeschlossen. Die Berechnung liegt in einem eigenen Service (salesStatsService) mit Zeitraum-Parameter (gesamt, laufendes Jahr, letzte 30 Tage).

### 2.2 UI

- Produkt-Detail-Panel, neuer Tab "Verkäufe": Kennzahlen (verkauft gesamt, Umsatz gesamt, letzte 30 Tage), Mini-Balkendiagramm Verkäufe pro Monat (letzte 12 Monate, Recharts), Liste der letzten 10 Aufträge dieses Produkts mit Klick zum Auftrag
- Produktliste: neue sortierbare Spalte "Verkauft" (Menge gesamt). Performance beachten: eine aggregierte Query für alle Produkte, kein N+1
- Dashboard-Widget "Top-Seller": Top 5 Produkte nach Menge der letzten 90 Tage, mit Umsatz, Klick öffnet das Produkt

## 3. Smart-Action-Architektur

### 3.1 Registry

Jede Regel ist ein Objekt: id, category (orders/products/listings/expenses/tasks/system), evaluate() liefert null (nichts zu tun) oder { count, message, severity: info|warning|danger, targetRoute, targetSearchParams? , targetDialog? }. Regeln werden zentral registriert (src/features/smart-actions/registry.ts), Module können später eigene Regeln ergänzen ohne die Registry-Datei zu ändern (gleiches Muster wie Command Registry aus Foundation).

### 3.2 Anzeige

- Dashboard-Bereich "Empfohlene Aktionen" oberhalb der bestehenden Widgets: Karten mit Icon nach category, Message, Count-Badge, Severity-Farbe (bestehende Statusfarben), Pfeil-Hinweis dass sie klickbar sind
- Klick navigiert per TanStack Router zur Zielroute inklusive vorgesetzter Filter (Search-Params), oder öffnet den Zieldialog. Die Zielmodule müssen die Filter aus den Search-Params initial übernehmen (wo das noch nicht geht, nachrüsten)
- Verwerfen-Button (X) pro Karte: Regel-ID wird mit Ablaufdatum (+7 Tage) in app_settings gespeichert (key smart_action_snoozes, ein JSON-Objekt). Nach Ablauf oder wenn sich der Zustand verschärft hat (count gestiegen), erscheint die Karte wieder
- Maximal 5 Karten gleichzeitig, sortiert nach Severity dann Count. Wenn nichts ansteht: Bereich komplett ausgeblendet, kein leerer Platzhalter

### 3.3 Berechnung

Evaluierung beim Dashboard-Mount und danach höchstens alle 5 Minuten (Cache). Alle evaluate()-Queries müssen leichtgewichtig sein (Aggregat-Queries, keine Volltabellen-Ladung).

## 4. Start-Regeln

| ID | Bedingung | Severity | Ziel bei Klick |
|----|-----------|----------|----------------|
| orders_stuck | Aufträge länger als 5 Tage in in_production | warning | Kanban, gefiltert auf in_production |
| orders_unshipped | Aufträge ready älter als 2 Tage | warning | Kanban, gefiltert auf ready |
| product_no_listing | Produkt mit 3+ Verkäufen ohne aktives Listing auf mindestens einer Standard-Plattform | info | Produkt-Detail, Tab Listings |
| expenses_no_receipt | Steuerrelevante Ausgaben ohne Beleg (laufendes Jahr) | info | Ausgabenliste, Filter Beleg fehlt |
| tasks_overdue | Überfällige Aufgaben | danger | Aufgaben-Listenansicht, Filter überfällig |
| listings_incomplete | Listings mit roter Vollständigkeits-Ampel, Status online oder draft | info | Listing-Liste, Filter Vollständigkeit rot |
| margin_low_seller | Produkt mit Verkäufen in den letzten 90 Tagen und Marge unter 15% | warning | Produkt-Detail, Tab Kosten |
| backup_stale | Letztes Backup älter als 7 Tage | danger | Settings, Tab Sicherheit |

Schwellenwerte (5 Tage, 2 Tage, 3 Verkäufe, 15%, 7 Tage) als zentrale Konstanten mit Kommentar, im MVP nicht in Settings konfigurierbar.

## 5. Akzeptanzkriterien

- Tab "Verkäufe" zeigt korrekte Kennzahlen, Monatsdiagramm und letzte Aufträge
- Spalte "Verkauft" in der Produktliste ist korrekt und sortierbar, eine Aggregat-Query statt N+1
- Top-Seller-Widget zeigt Top 5 der letzten 90 Tage
- Alle 8 Regeln feuern bei passenden Fixture-Daten und bleiben still ohne
- Klick auf jede Karte landet in der korrekten, vorgefilterten Zielansicht
- Snooze blendet die Karte 7 Tage aus, Verschärfung (höherer Count) holt sie zurück
- Kein leerer Bereich wenn keine Aktionen anstehen
- Refundierte, stornierte und soft-deleted Aufträge fließen nicht in Verkaufszahlen ein
- E2E-Tests für Verkaufslogik, jede Regel, Navigation mit Filterübernahme und Snooze
- TypeScript strict, ESLint, Prettier, cargo check grün
