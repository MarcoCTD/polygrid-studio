# Modul 10: Analysen und Dashboard

PolyGrid Studio Business OS
Anforderungsdokument | Version 2.0 | Mai 2026

> **Diese Version 2.0 ersetzt die Original-Spec (v1.0 vom April 2026).** Sie berücksichtigt die Entscheidungen aus `MODUL_10_ENTSCHEIDUNGEN.md`, den tatsächlichen Datenbank-Stand (DATABASE_SCHEMA v1.3) und den aktuellen Code-Stand aller abgeschlossenen Module.

---

## 1. Scope und Ziel

Dieses Modul implementiert das Dashboard (Startseite `/`) mit KPI-Karten, Schnellaktionen und Widgets sowie die Analysen-Seite (`/analytics`) mit Charts und KPI-Snapshots. Es aggregiert Daten aus allen vorherigen Modulen und stellt sie visuell dar.

### 1.1 Lieferergebnisse

- Dashboard-Seite mit 4 KPI-Karten, Schnellaktionen-Leiste und 5 Widgets
- Analysen-Seite mit Zeitraum-Selector, 4 Chart-Widgets und optionaler KI-Zusammenfassung
- KPI-Aggregation-Service (SQL-basiert, performante Aggregation)
- KPI-Snapshot-Service (automatisch bei App-Start, manuell auf Analysen-Seite)
- DB-Migration: `kpi_records` Tabelle erweitern (neue Felder, unique constraint)
- Command-Palette-Erweiterung
- Dashboard-spezifische Settings-Keys

### 1.2 Abhängigkeiten

- Foundation (App Shell, DB, Routing, Design-System)
- Produktverwaltung (Modul 02) für Produktdaten, Margen
- Ausgabenverwaltung (Modul 04) für Ausgabendaten
- Listing-Verwaltung (Modul 05) für Listing-Daten
- Auftragsverwaltung (Modul 08) für Umsatz, Aufträge
- KI-Architektur (Modul 06) für optionale KI-Zusammenfassung
- Aufgaben-Modul (Modul 09) für offene Tasks

### 1.3 Explizit NICHT im Scope

- Keine konfigurierbaren/verschiebbaren Widgets (Post-MVP)
- Keine Echtzeit-Updates (Dashboard wird bei Seitenaufruf aktualisiert)
- Keine neuen KI-Agenten (nutzt existierenden `product_analyst`)
- Keine Export-Funktion für Charts (Post-MVP)

---

## 2. Datenmodell

### 2.1 kpi_records (erweitert)

Die bestehende `kpi_records`-Tabelle wird um folgende Felder erweitert:

| Feld                 | Typ         | Pflicht | Beschreibung                                          | Neu? |
| -------------------- | ----------- | ------- | ----------------------------------------------------- | ---- |
| id                   | TEXT (UUID) | Ja      | Primärschlüssel                                      | Nein |
| period_type          | TEXT        | Ja      | week, month                                           | Nein |
| period_start         | TEXT (ISO)  | Ja      | Beginn des Zeitraums (YYYY-MM-DD)                     | Nein |
| period_end           | TEXT (ISO)  | Ja      | Ende des Zeitraums (YYYY-MM-DD)                       | Nein |
| revenue              | REAL        | Ja      | Summe sale_price completed Orders                     | Nein |
| expenses_total       | REAL        | Ja      | Summe amount_gross Expenses                           | Nein |
| orders_count         | INTEGER     | Ja      | Anzahl abgeschlossener Aufträge im Zeitraum           | Nein |
| open_orders          | INTEGER     | Ja      | Offene Aufträge zum Stichtag                          | **Ja** |
| open_tasks           | INTEGER     | Ja      | Offene Tasks zum Stichtag                             | **Ja** |
| completed_orders     | INTEGER     | Ja      | Im Zeitraum abgeschlossene Aufträge                   | **Ja** |
| active_products      | INTEGER     | Ja      | Produkte mit status=online                            | Nein |
| active_listings      | INTEGER     | Ja      | Listings mit status=online                            | Nein |
| avg_margin           | REAL        | Nein    | Durchschnittliche Marge in %                          | Nein |
| revenue_by_platform  | TEXT (JSON) | Nein    | `{"etsy": 150, "ebay": 80, "direkt": 20}`            | **Ja** |
| expenses_by_category | TEXT (JSON) | Nein    | `{"Filament": 45, "Verpackung": 12, ...}`             | **Ja** |
| created_at           | TEXT (ISO)  | Ja      |                                                       | Nein |

**Migration**: ALTER TABLE um neue Spalten + neuer Unique-Index auf `(period_type, period_start)`.

### 2.2 Neue Settings-Keys

| Key                             | Typ     | Default | Beschreibung                       |
| ------------------------------- | ------- | ------- | ---------------------------------- |
| `dashboard_kpi_snapshot_auto`   | Boolean | true    | Auto-Snapshot bei App-Start        |
| `dashboard_low_margin_threshold`| Number  | 30      | Schwellenwert für schwache Margen  |

---

## 3. KPI-Aggregation-Service

Zentraler Service unter `src/features/analytics/services/kpiService.ts`.

### 3.1 Live-KPIs (für Dashboard)

Berechnet den aktuellen Stand per SQL-Aggregation, keine Snapshots:

```typescript
interface DashboardKPIs {
  // KPI-Karten
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  revenueChangePercent: number;
  expensesCurrentMonth: number;
  expensesPreviousMonth: number;
  expensesChangePercent: number;
  openOrdersCount: number;
  oldestOpenOrderDate: string | null;
  openTasksCount: number;
  nextTaskDueDate: string | null;
}
```

**SQL-Queries** (alle mit Indizes abgedeckt):

- Umsatz: `SELECT SUM(sale_price) FROM orders WHERE status = 'completed' AND order_date >= ? AND order_date < ? AND deleted_at IS NULL`
- Ausgaben: `SELECT SUM(amount_gross) FROM expenses WHERE date >= ? AND date < ? AND deleted_at IS NULL`
- Offene Aufträge: `SELECT COUNT(*) FROM orders WHERE status IN ('ordered','paid','in_production','ready') AND deleted_at IS NULL`
- Offene Tasks: `SELECT COUNT(*) FROM tasks WHERE status IN ('todo','in_progress') AND deleted_at IS NULL`
- Ältester offener Auftrag: `SELECT MIN(order_date) FROM orders WHERE status IN ('ordered','paid','in_production','ready') AND deleted_at IS NULL`
- Nächste fällige Aufgabe: `SELECT MIN(due_date) FROM tasks WHERE status IN ('todo','in_progress') AND due_date IS NOT NULL AND deleted_at IS NULL`

### 3.2 Widget-Daten

Separate Funktionen pro Widget, jeweils als eigene SQL-Query:

```typescript
interface WidgetData {
  recentProducts: Array<{id, name, status, updated_at}>;           // Top 5 nach updated_at
  lowMarginProducts: Array<{id, name, estimated_margin, status}>;  // Marge < threshold, max 5
  incompleteListings: Array<{id, title, platform, completeness}>; // Fehlende Tags/Beschreibung
  pipelineProducts: Array<{id, name, status}>;                     // Status: idea, review, test_print
  // Schnellaktionen sind statisch, brauchen keine Daten
}
```

### 3.3 Chart-Daten (für Analysen-Seite)

```typescript
interface AnalyticsData {
  revenueByPlatform: Array<{platform, month, revenue}>;       // Letzte N Monate
  expensesByCategory: Array<{category, amount}>;               // Aktueller Zeitraum
  marginByProduct: Array<{id, name, estimated_margin}>;        // Sortiert
  listingStatusDistribution: Array<{status, count}>;           // draft/online/paused/archived
  avgMarginTrend: Array<{period, avg_margin}>;                 // Aus kpi_records
}
```

---

## 4. KPI-Snapshot-Service

### 4.1 Automatische Erstellung

Bei App-Start (in der Root-Komponente oder einem Init-Hook):

1. Prüfe `dashboard_kpi_snapshot_auto` Setting → wenn false, überspringe
2. Lade letzten Monats-Snapshot: `SELECT * FROM kpi_records WHERE period_type = 'month' ORDER BY period_start DESC LIMIT 1`
3. Wenn kein Snapshot existiert oder `period_start` nicht dem Vormonat entspricht:
   - Berechne KPIs für den vergangenen abgeschlossenen Monat
   - INSERT in `kpi_records` (UPSERT via unique constraint)
4. Analog für Wochen-Snapshot (ISO-Woche)

### 4.2 Manueller Refresh

Button auf der Analysen-Seite erstellt/aktualisiert den Snapshot für den laufenden Zeitraum. Nutzt INSERT OR REPLACE (SQLite UPSERT).

---

## 5. UI-Spezifikation

### 5.1 Dashboard-Seite (Route: `/`)

#### 5.1.1 KPI-Karten (obere Reihe)

4 Karten in `grid grid-cols-4 gap-4` (responsive: `grid-cols-2`):

| Karte           | Hauptwert                              | Subtext                                    | Icon (Lucide) |
| --------------- | -------------------------------------- | ------------------------------------------ | ------------- |
| Umsatz          | EUR-Betrag aktueller Monat             | ↑/↓ X% vs. Vormonat (grün/rot)            | TrendingUp    |
| Ausgaben        | EUR-Betrag aktueller Monat             | ↑/↓ X% vs. Vormonat (rot = mehr = schlecht)| Receipt       |
| Offene Aufträge | Anzahl                                 | Ältester: "vor X Tagen"                    | ShoppingCart   |
| Offene Aufgaben | Anzahl                                 | Nächste fällig: Datum oder "Keine"         | CheckSquare    |

**Design**: `bg-elevated` Karte mit `rounded-lg`, Icon links in `--accent-primary-subtle` Kreis, Wert als `text-2xl font-semibold`, Subtext als `text-xs text-secondary`. Änderung als farbiger Badge (grün = positiv bei Umsatz, rot = positiv bei Ausgaben).

#### 5.1.2 Schnellaktionen

Horizontal unter KPI-Karten als `flex flex-wrap gap-2`:

| Aktion         | Icon (Lucide) | Navigation/Aktion          |
| -------------- | ------------- | -------------------------- |
| Neue Ausgabe   | Plus          | Öffnet Ausgaben-Schnellerfassung |
| Neues Produkt  | Plus          | Öffnet Neues-Produkt-Modal |
| Neues Listing  | Plus          | Öffnet Neues-Listing-Modal |
| Neuer Auftrag  | Plus          | Öffnet Neuer-Auftrag-Modal |

**Design**: Ghost-Buttons mit Icon + Text, `text-sm`, `text-secondary` auf Hover `bg-hover`.

#### 5.1.3 Widgets (unter Schnellaktionen)

2-Spalten-Grid (`grid grid-cols-2 gap-4`, responsive: `grid-cols-1`):

**Widget 1: Zuletzt bearbeitete Produkte**
- 5 Einträge, sortiert nach `updated_at DESC`
- Zeigt: Produktname, Status-Badge (farbcodiert), relatives Datum ("vor 2 Tagen")
- Klick navigiert zu `/products` und öffnet Detail-Panel
- Empty State: "Noch keine Produkte angelegt" + Button "Erstes Produkt erstellen"

**Widget 2: Produkte mit schwacher Marge**
- Max 5 Produkte mit `estimated_margin < dashboard_low_margin_threshold` und `status = 'online'`
- Sortiert nach Marge aufsteigend
- Zeigt: Produktname, Marge als farbiger Badge (Ampel-System aus Modul 02)
- Klick navigiert zu Produkt-Detail (Kosten-Tab)
- Empty State: "Alle Margen über X%" (positiv formuliert)

**Widget 3: Listings mit fehlenden Daten**
- Listings mit `status != 'archived'` und fehlenden Tags ODER fehlender Beschreibung
- Zeigt: Plattform-Icon, Titel, Vollständigkeits-Prozent, fehlende Felder als Tags
- Klick navigiert zum Listing-Editor
- Empty State: "Alle Listings vollständig"

**Widget 4: Produkte in Pipeline**
- Produkte mit `status IN ('idea', 'review', 'test_print')`
- Gruppiert nach Status, Anzahl pro Status anzeigen
- Zeigt: Statusname, Anzahl als Badge, Liste der Produktnamen (max 3 pro Status, dann "+X weitere")
- Klick navigiert zu `/products` mit voreingestelltem Status-Filter
- Empty State: "Keine Produkte in der Pipeline"

**Widget 5: Auftrags-Timeline**
- Letzte 5 Aufträge mit Statusänderung (sortiert nach `updated_at DESC`)
- Zeigt: Plattform-Icon, Produktname, Status-Badge, Datum
- Klick navigiert zum Auftrag
- Empty State: "Noch keine Aufträge erfasst" + Button "Ersten Auftrag anlegen"

**Widget-Design**: Jedes Widget ist eine `bg-elevated` Card mit: Titel als `text-base font-semibold`, optional ein "Alle anzeigen →"-Link der zum vollen Modul navigiert, Content als Liste mit Hover-Effekt auf jedem Eintrag.

### 5.2 Analysen-Seite (Route: `/analytics`)

#### 5.2.1 Zeitraum-Selector

Oben auf der Seite als Dropdown:

| Option             | Logik                              |
| ------------------ | ---------------------------------- |
| Aktueller Monat    | 1. des Monats bis heute            |
| Letzter Monat      | 1. bis letzter Tag Vormonat        |
| Letzte 3 Monate    | 3 Monate zurück bis heute          |
| Letzte 6 Monate    | 6 Monate zurück bis heute          |
| Laufendes Jahr     | 1. Januar bis heute                |
| Gesamtzeitraum     | Frühester Datensatz bis heute      |

Default: "Aktueller Monat".

#### 5.2.2 KPI-Zusammenfassung (obere Reihe)

3 kompakte KPI-Karten für den gewählten Zeitraum:

| Karte              | Wert                                |
| ------------------ | ----------------------------------- |
| Gesamtumsatz       | Summe sale_price im Zeitraum        |
| Gesamtausgaben     | Summe amount_gross im Zeitraum      |
| Durchschnittsmarge | Mittelwert estimated_margin online-Produkte |

#### 5.2.3 Chart-Widgets

4 Charts in 2-Spalten-Grid:

**Chart 1: Umsatz nach Plattform (Balkendiagramm)**
- Recharts `BarChart` mit gruppierten Balken pro Monat
- Eine Farbe pro Plattform (Etsy: `--accent-primary`, eBay: `--accent-warning`, Direkt: `--accent-info`, Kleinanzeigen: `--text-muted`)
- X-Achse: Monate (MMM YYYY), Y-Achse: EUR
- Daten: `SELECT platform, strftime('%Y-%m', order_date) as month, SUM(sale_price) FROM orders WHERE status = 'completed' AND ... GROUP BY platform, month`

**Chart 2: Ausgaben nach Kategorie (Donut-Chart)**
- Recharts `PieChart` mit `innerRadius` (Donut)
- Farben: Top 5 Kategorien bekommen feste Farben, Rest wird als "Sonstiges" zusammengefasst
- Legende rechts neben dem Chart
- Daten: `SELECT category, SUM(amount_gross) FROM expenses WHERE ... GROUP BY category ORDER BY SUM(amount_gross) DESC`

**Chart 3: Marge nach Produkt (horizontales Balkendiagramm)**
- Recharts `BarChart` mit `layout="vertical"`
- Balkenfarbe nach Margen-Ampel (grün/gelb/orange/rot)
- Nur Produkte mit `status = 'online'` und `estimated_margin IS NOT NULL`
- Max 10 Produkte, sortiert nach Marge aufsteigend (schlechteste oben für Handlungsbedarf)

**Chart 4: Listing-Status-Verteilung (Donut-Chart)**
- Recharts `PieChart`
- Segmente: Draft, Online, Paused, Archived
- Farben: Draft = `--text-muted`, Online = `--accent-success`, Paused = `--accent-warning`, Archived = `--text-disabled`

#### 5.2.4 KI-Zusammenfassung (optional)

Unter den Charts:

- Button "KI-Analyse erstellen" (deaktiviert wenn kein Provider verfügbar)
- Beim Klick: Spinner, dann Ergebnis als Info-Card
- Nutzt `product_analyst` Agent mit `action: 'dashboard_analysis'`
- Prompt enthält: aktuelle KPIs, Top 3 Produkte nach Umsatz, Bottom 3 nach Marge, Ausgaben-Top-Kategorien
- Output: 3-5 Sätze Klartextanalyse
- Ergebnis wird NICHT persistiert, bei jedem Klick neu generiert
- Wird in `ai_jobs` geloggt

#### 5.2.5 Snapshot-Refresh

Button "Snapshots aktualisieren" (klein, rechts neben dem Zeitraum-Selector):
- Erstellt/aktualisiert Monats- und Wochen-Snapshot für den aktuellen laufenden Zeitraum
- Feedback: Toast mit "Snapshot für Mai 2026 erstellt/aktualisiert"

---

## 6. Command-Palette-Erweiterung

Neue Commands registrieren:

| Command              | Aktion                              |
| -------------------- | ----------------------------------- |
| Zu Dashboard         | Navigation `/` (existiert bereits)  |
| Zu Analysen          | Navigation `/analytics`             |
| KI-Analyse erstellen | Triggert KI-Zusammenfassung         |

---

## 7. Sub-Session-Aufteilung

### Sub-Session 1: KPI-Service + Dashboard-KPIs + Schnellaktionen

**Dateien**:
- `src/features/analytics/services/kpiService.ts` (KPI-Aggregation-Queries)
- `src/features/analytics/services/snapshotService.ts` (Snapshot-Erstellung)
- `src/features/analytics/types.ts` (Interfaces)
- `src/features/analytics/components/KpiCard.tsx` (wiederverwendbare KPI-Karte)
- `src/features/analytics/components/QuickActions.tsx` (Schnellaktionen-Leiste)
- `src/features/dashboard/DashboardPage.tsx` (Dashboard-Seite, ersetzt Platzhalter)
- DB-Migration für `kpi_records` Erweiterung + neue Settings-Keys

**Gate**: Dashboard zeigt 4 KPI-Karten mit echten Daten (oder 0/– bei leerer DB). Schnellaktionen navigieren korrekt. `npm run tauri dev` grün.

### Sub-Session 2: Dashboard-Widgets

**Dateien**:
- `src/features/analytics/services/widgetService.ts` (Widget-Daten-Queries)
- `src/features/analytics/components/RecentProductsWidget.tsx`
- `src/features/analytics/components/LowMarginWidget.tsx`
- `src/features/analytics/components/IncompleteListingsWidget.tsx`
- `src/features/analytics/components/PipelineWidget.tsx`
- `src/features/analytics/components/OrderTimelineWidget.tsx`
- `src/features/analytics/components/WidgetCard.tsx` (wiederverwendbarer Widget-Container)
- `src/features/dashboard/DashboardPage.tsx` (Widgets einbinden)

**Gate**: Alle 5 Widgets zeigen Daten oder Empty States. Klick-Navigation funktioniert. `npm run tauri dev` grün.

### Sub-Session 3: Analysen-Seite + Charts

**Dateien**:
- `src/features/analytics/services/chartService.ts` (Chart-Daten-Queries)
- `src/features/analytics/components/TimeRangeSelector.tsx`
- `src/features/analytics/components/RevenueByPlatformChart.tsx`
- `src/features/analytics/components/ExpensesByCategoryChart.tsx`
- `src/features/analytics/components/MarginByProductChart.tsx`
- `src/features/analytics/components/ListingStatusChart.tsx`
- `src/features/analytics/components/AnalyticsKpiRow.tsx` (3 kompakte KPI-Karten)
- `src/features/analytics/AnalyticsPage.tsx` (ersetzt Platzhalter)

**Gate**: Analysen-Seite zeigt 4 Charts mit Daten für gewählten Zeitraum. Zeitraum-Wechsel aktualisiert alle Charts. `npm run tauri dev` grün.

### Sub-Session 4: KI-Zusammenfassung + Snapshot-Auto + Polish

**Dateien**:
- `src/features/analytics/components/AiAnalysisSummary.tsx`
- `src/features/analytics/components/SnapshotRefreshButton.tsx`
- `src/features/analytics/hooks/useAutoSnapshot.ts` (App-Start-Hook)
- App.tsx oder Root: `useAutoSnapshot` einbinden
- Command-Palette-Erweiterung (Commands registrieren)
- Responsive-Fixes, Edge Cases, Leer-Daten-Handling

**Gate**: KI-Analyse-Button funktioniert (wenn Provider konfiguriert) oder ist korrekt deaktiviert. Snapshots werden bei App-Start erstellt. Command-Palette enthält neue Commands. Alle Responsive-Breakpoints funktionieren. `npm run tauri dev` grün.

---

## 8. Akzeptanzkriterien

### Dashboard

- [ ] Dashboard zeigt 4 KPI-Karten mit korrekten, live-berechneten Werten
- [ ] Vormonat-Vergleich wird korrekt berechnet und farblich dargestellt
- [ ] Schnellaktionen navigieren korrekt zu den jeweiligen Modulen/Modals
- [ ] Alle 5 Widgets laden und zeigen aktuelle Daten
- [ ] Widgets zeigen freundliche Empty States bei fehlenden Daten
- [ ] Klick auf Widget-Einträge navigiert zum korrekten Modul/Detail
- [ ] Dashboard-Layout ist responsive (4→2 Spalten KPI, 2→1 Spalte Widgets)

### Analysen

- [ ] Analysen-Seite zeigt 4 verschiedene Chart-Typen
- [ ] Zeitraum-Selector filtert alle Charts und KPI-Karten korrekt
- [ ] Charts sind korrekt beschriftet (Achsen, Legende) und nutzen Design-System-Farben
- [ ] Charts zeigen leeren Zustand statt Fehler bei fehlenden Daten
- [ ] KI-Analyse-Button generiert Klartextanalyse und loggt in `ai_jobs`
- [ ] KI-Button ist deaktiviert mit Tooltip wenn kein Provider verfügbar
- [ ] Snapshot-Refresh-Button erstellt/aktualisiert Snapshots mit Toast-Feedback

### KPI-Snapshots

- [ ] Bei App-Start werden automatisch Snapshots für abgeschlossene Monate/Wochen erstellt
- [ ] Unique Constraint verhindert doppelte Snapshots
- [ ] `dashboard_kpi_snapshot_auto = false` deaktiviert Auto-Erstellung

### Allgemein

- [ ] Command-Palette enthält "Zu Analysen" und "KI-Analyse erstellen"
- [ ] Keine TypeScript-Fehler im strict mode
- [ ] SQL-Aggregationen nutzen existierende Indizes
- [ ] Design-System-Tokens werden konsistent verwendet (keine hartcodierten Farben)
