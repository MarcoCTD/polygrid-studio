# Modul 10: Analysen/Dashboard – Entscheidungsdokument

PolyGrid Studio Business OS | Mai 2026

---

## E1: Chart-Bibliothek

**Frage**: Welche Chart-Bibliothek verwenden?

**Entscheidung**: **Recharts**

**Begründung**: Recharts ist bereits im Tech-Stack definiert (PROJEKTREGELN §3), in Modul 04 (Ausgaben Header-Widget) bereits im Einsatz. React-nativ, deklarative API, gute shadcn/ui-Kompatibilität. Keine neue Dependency nötig.

**Constraints**: Recharts-Komponenten verwenden die Design-System-Tokens (`--accent-primary`, `--accent-success` etc.) für Farben. Keine hartcodierten Hex-Werte in Charts.

---

## E2: Dashboard-Layout

**Frage**: Wie wird das Dashboard strukturiert?

**Entscheidung**: **Festes Layout, nicht konfigurierbar im MVP**

**Begründung**: Drag-and-Drop Widget-Konfiguration ist ein Feature mit hohem Aufwand und geringem Nutzen für einen Einzelunternehmer. Das Dashboard hat ein festes Layout:

1. **KPI-Karten** (obere Reihe, 4 Karten nebeneinander, responsive auf 2x2)
2. **Widgets** (darunter, 2-Spalten-Grid statt 3-Spalten wie in der Original-Spec, da bei wenigen Daten 3 Spalten zu leer wirken)
3. **Schnellaktionen** (als Button-Leiste unter den KPI-Karten, nicht als eigenes Widget)

**Layout-Detail**:
- KPI-Row: `grid grid-cols-4 gap-4` (responsive: `grid-cols-2` auf schmalen Viewports)
- Schnellaktionen: Inline unter KPI-Row als `flex flex-wrap gap-2`
- Widget-Grid: `grid grid-cols-2 gap-4` (responsive: `grid-cols-1`)

---

## E3: Widget-Konfigurierbarkeit

**Frage**: Können Widgets ein-/ausgeblendet oder neu angeordnet werden?

**Entscheidung**: **Nein, nicht im MVP**

**Begründung**: Konfigurierbare Widgets erfordern Persistierung der Widget-Konfiguration, Drag-and-Drop-Logik und einen Settings-Bereich. Aufwand steht in keinem Verhältnis zum Nutzen für einen einzelnen Nutzer. Post-MVP-Kandidat.

---

## E4: KPI-Snapshot-Timing

**Frage**: Wann werden KPI-Snapshots erstellt?

**Entscheidung**: **Bei App-Start, wenn ein neuer Monat oder eine neue Kalenderwoche begonnen hat**

**Logik**:
1. Bei App-Start: Letzten `kpi_records`-Eintrag für `period_type = 'month'` laden
2. Wenn `period_start` nicht dem aktuellen Monat entspricht → neuen Monats-Snapshot für den *vergangenen* abgeschlossenen Monat erstellen
3. Analog für `period_type = 'week'` (ISO-Woche, Montag bis Sonntag)
4. Snapshots werden für den *abgeschlossenen* Zeitraum erstellt, nicht für den laufenden
5. Manueller Refresh-Button auf der Analysen-Seite erstellt/aktualisiert den Snapshot für den aktuellen laufenden Zeitraum (UPSERT via unique constraint)

**Unique Constraint**: `(period_type, period_start)` verhindert doppelte Einträge.

**Setting**: `dashboard_kpi_snapshot_auto` (Default: true) steuert, ob Auto-Snapshots bei App-Start erstellt werden.

---

## E5: KI-Zusammenfassung

**Frage**: Wird die KI-Zusammenfassung im MVP implementiert?

**Entscheidung**: **Ja, als optionaler Button, nicht als Standard**

**Begründung**: Die KI-Architektur (Modul 06) ist komplett implementiert, der Aufwand ist gering (ein Prompt + Rendering eines Textblocks). Es wäre verschenktes Potenzial, die existierende Infrastruktur nicht zu nutzen.

**Umsetzung**:
- Button "KI-Analyse erstellen" auf der Analysen-Seite (unter den Charts)
- Verwendet den existierenden `product_analyst` Agent (kein neuer Agent nötig)
- Input: Aktuelle KPIs + Top/Bottom Produkte nach Marge + Umsatzverteilung
- Output: 3-5 Sätze Klartextanalyse, gerendert als Info-Card
- Wird in `ai_jobs` geloggt mit `agent: 'product_analyst'`, `action: 'dashboard_analysis'`
- Button wird deaktiviert wenn kein KI-Provider verfügbar
- Ergebnis wird nicht persistiert (bei jedem Klick neu generiert)

---

## E6: Zeitraum-Logik Dashboard vs. Analysen

**Frage**: Welchen Zeitraum zeigen Dashboard und Analysen-Seite?

**Entscheidung**:
- **Dashboard** (`/`): Immer aktueller Monat (live berechnet aus DB, keine Snapshots)
- **Analysen** (`/analytics`): Konfigurierbarer Zeitraum mit Dropdown (Aktueller Monat, Letzter Monat, Letzte 3 Monate, Letzte 6 Monate, Laufendes Jahr, Gesamtzeitraum)

**Begründung**: Das Dashboard soll den Ist-Zustand zeigen. Die Analysen-Seite dient der historischen Betrachtung und nutzt dafür sowohl Live-Daten als auch KPI-Snapshots.

---

## E7: Umsatz-Definition

**Frage**: Was zählt als "Umsatz"?

**Entscheidung**: **Summe `sale_price` aller Orders mit `status = 'completed'`**

**Nicht enthalten**: `shipping_revenue` (separate Kennzahl), stornierte/refundierte Aufträge, offene Aufträge.

**Begründung**: Entspricht der EÜR-Logik (Zufluss nach §11 EStG). Für die Dashboard-KPI-Karte wird der Einfachheit halber auf `status = 'completed'` gefiltet statt auf `payment_received_date`, da die Detailgenauigkeit der EÜR bereits in Modul 08 abgedeckt ist.

---

## E8: "Schwache Margen"-Widget

**Frage**: Ab welcher Marge gilt ein Produkt als "schwach"?

**Entscheidung**: **Unter 30% (konfigurierbar via `dashboard_low_margin_threshold`)**

**Logik**:
- Nur Produkte mit `status = 'online'` und vorhandener `estimated_margin` anzeigen
- Sortiert nach Marge aufsteigend, max 5 Einträge
- Farbcodierung gemäß bestehendem Margen-Ampel-System (Modul 02)
- Klick navigiert zum Produkt-Detail-Panel

---

## E9: Routing und Sidebar

**Frage**: Wie wird das Dashboard in die Navigation integriert?

**Entscheidung**:
- Dashboard bleibt auf Route `/` (bereits in Foundation definiert)
- Analysen-Seite auf Route `/analytics` (bereits in Foundation als Platzhalter vorhanden)
- Sidebar-Eintrag "Dashboard" zeigt `/`, "Analysen" zeigt `/analytics`
- Beide sind separate Seiten, kein Tab-System innerhalb einer Seite

---

## E10: Leerzustand

**Frage**: Was zeigt das Dashboard wenn keine Daten vorhanden sind?

**Entscheidung**: **Empty States pro Widget/KPI-Karte**

- KPI-Karten zeigen "0" bzw. "–" statt Fehlermeldung
- Widgets zeigen einen freundlichen Empty-State ("Noch keine Produkte angelegt" etc.) mit CTA-Button zum relevanten Modul
- Charts zeigen den leeren Chart-Rahmen mit "Keine Daten für diesen Zeitraum"
- Keine Error-States für leere Daten, nur für echte Fehler (DB nicht erreichbar etc.)

---

## E11: Performance

**Frage**: Wie wird Performance sichergestellt bei vielen Datensätzen?

**Entscheidung**:
- Dashboard-KPIs werden bei Seitenaufruf per SQL-Aggregation berechnet (nicht alle Rows laden und im Frontend summieren)
- Queries nutzen existierende Indizes (`status`, `order_date`, `date`, `category`)
- Charts laden Daten lazy (erst beim Scroll in den Viewport oder beim Tab-Wechsel auf der Analysen-Seite)
- KPI-Snapshots entlasten historische Queries (statt Aggregation über alle alten Orders wird der Snapshot gelesen)
- Max. 6 Monate für plattformbasierte Charts als Default

---

## E12: Sub-Session-Aufteilung

**Frage**: Wie wird Modul 10 in Sub-Sessions aufgeteilt?

**Entscheidung**: 4 Sub-Sessions:

| # | Sub-Session | Inhalt |
|---|------------|--------|
| 1 | KPI-Service + Dashboard-KPIs | SQL-Aggregation-Service, KPI-Karten-Komponenten, Schnellaktionen, Dashboard-Page |
| 2 | Dashboard-Widgets | 5 Widgets (letzte Produkte, schwache Margen, fehlende Listing-Daten, Pipeline-Produkte, leere/volle Widgets), Empty States |
| 3 | Analysen-Seite + Charts | Analysen-Page, Zeitraum-Selector, 4 Chart-Widgets (Umsatz nach Plattform, Ausgaben nach Kategorie, Marge nach Produkt, Listing-Status), KPI-Snapshot-Service |
| 4 | KI-Zusammenfassung + Polish | KI-Analyse-Button, Snapshot-Auto-Erstellung bei App-Start, Command-Palette-Erweiterung, Responsive-Fixes, Edge Cases |

---

## Zusammenfassung der neuen Settings-Keys

| Key | Typ | Default | Beschreibung |
|-----|-----|---------|-------------|
| `dashboard_kpi_snapshot_auto` | Boolean | true | Auto-Snapshot bei App-Start |
| `dashboard_low_margin_threshold` | Number | 30 | Schwellenwert für "Schwache Margen"-Widget |
