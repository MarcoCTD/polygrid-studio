# Entscheidungen Modul 15 – Verkaufszahlen und Smart Actions

Stand: Juli 2026 | Bezug: `docs/specs/MODUL_15_SMART_ACTIONS.md`

## 1. Verkaufszahlen

### 1.1 Ort des Service

`salesStatsService` liegt in `src/features/orders/services/salesStatsService.ts`, weil er ausschließlich Auftragsdaten aggregiert. Produkte, Dashboard und Produktliste importieren ihn direkt (kein Umweg über den Orders-Barrel nötig, aber er wird auch über `features/orders/services` re-exportiert).

### 1.2 Datumsbasis

Verkäufe werden nach `order_date` zeitlich eingeordnet (nicht `payment_received_date`). Begründung: Die Verkaufsstatistik ist eine Vertriebs-Sicht, keine EÜR-Sicht; `order_date` ist Pflichtfeld, `payment_received_date` optional. Der EÜR-Export bleibt davon unberührt.

### 1.3 Zeitraum-Parameter

Zusätzlich zu den in der Spec genannten Zeiträumen (gesamt, laufendes Jahr, letzte 30 Tage) gibt es `last_90_days`, weil das Top-Seller-Widget und die Regel `margin_low_seller` ein 90-Tage-Fenster brauchen.

### 1.4 „Letzte 10 Aufträge" im Verkäufe-Tab

Die Liste zeigt alle nicht gelöschten Aufträge des Produkts (auch stornierte/refundierte), da sie als Auftragshistorie dient. Die Kennzahlen darüber folgen strikt der Verkaufsdefinition. Der Klick zum Auftrag nutzt den neuen Search-Param `/orders?order=<id>`, der das Detail-Panel öffnet.

### 1.5 Spalte „Verkauft"

Eine einzige `GROUP BY product_id`-Query liefert die Mengen für alle Produkte (kein N+1). Bereits persistierte Spaltenkonfigurationen werden beim Laden um neue Spalten ergänzt (`mergeWithDefaultColumns`), damit Bestandsnutzer die Spalte sehen.

### 1.6 Unit-Tests gegen echtes SQLite

Die Tests von `salesStatsService` laufen gegen sql.js (In-Memory-SQLite) mit den echten Drizzle-Migrationen statt gegen gemockte `select()`-Antworten – so ist das SQL selbst getestet. Dafür wurde `vitest` in `vite.config.ts` auf `src/**/*.test.ts` begrenzt; vorher sammelte `npm run test` fälschlich auch die Playwright-Specs ein und schlug fehl.

## 2. Smart Actions

### 2.1 Registry-Muster

`src/features/smart-actions/registry.ts` spiegelt die Command Registry aus Foundation: Modul-Level-Map, `registerSmartActionRules()` überschreibt keine bestehenden IDs. Die 8 Start-Regeln registrieren sich beim Laden von `smartActionsService.ts` selbst; spätere Module können Regeln ergänzen, ohne Registry- oder Regeldatei anzufassen.

### 2.2 Abweichung von der Spec: `orders_unshipped`

Die Spec verlangt „Aufträge **ready** älter als 2 Tage" – der Status `ready` existiert im Auftragsmodell nicht (Statusse: inquiry, ordered, paid, in_production, shipped, completed, issue, cancelled; `ready` gibt es nur bei Listings). Mapping: **bezahlte Aufträge (status = paid), die nach 2 Tagen noch nicht versendet sind** (shipping_status nicht shipped/delivered). Ziel-Kanban wird auf `paid` gefiltert. Falls später ein echter „versandbereit"-Status eingeführt wird, muss nur die Regel angepasst werden.

### 2.3 „Zeit im Status" über order_events

`orders_stuck`/`orders_unshipped` messen die Verweildauer über den letzten `status_change`-Event (`order_events`), Fallback `updated_at` für Aufträge ohne Events. Correlated Subquery auf indiziertem `order_id` – leichtgewichtig.

### 2.4 `product_no_listing`: Definition „aktives Listing"

Aktiv = Listing nicht gelöscht, Status `online`, und mindestens ein aktivierter Plattform-Override (`is_active = 1`) auf einer Standard-Plattform (**Etsy oder eBay**; Kleinanzeigen ist laut PROJEKTREGELN optional). Bei mehreren Treffern navigiert die Karte zum Produkt mit den meisten Verkäufen; der Count zählt alle betroffenen Produkte.

### 2.5 `margin_low_seller`: Margenquelle

Verwendet `products.estimated_margin` (persistierte Marge), analog zum bestehenden LowMarginWidget aus Modul 10. Produkte ohne persistierte Marge werden nicht bewertet. Bei mehreren Treffern navigiert die Karte zum Produkt mit der schlechtesten Marge.

### 2.6 `listings_incomplete`: SQL-Näherung der roten Ampel

Die exakte Ampel (`calculateCompleteness`) lebt in TypeScript und bräuchte eine Volltabellen-Ladung. Die Regel bildet die Rot-Bedingungen in SQL nach: Master-Titel leer, Basispreis ≤ 0, Tags leer, oder effektiver Titel (Override, sonst Master) über dem Plattform-Limit (Kleinanzeigen 65 / eBay 80 / Etsy 140). Nicht abgebildet: rote Fälle durch Tags-Overrides (selten). Die Zielansicht filtert mit der exakten Logik – minimale Abweichungen zwischen Badge-Count und Listenlänge sind möglich und akzeptiert.

### 2.7 `backup_stale`: Count = Tage seit Backup

Der Count der Karte ist die Anzahl Tage seit dem letzten Backup (bzw. 1 bei „noch nie"). Dadurch greift die Verschärfungs-Logik automatisch: Jeder weitere Tag erhöht den Count und holt eine gesnoozte Karte zurück. Ziel ist `/settings/data` („Daten & Sicherheit" – die Spec nennt den Tab „Sicherheit", der reale Tab heißt `data`).

### 2.8 Snooze-Persistenz

`app_settings`-Key `smart_action_snoozes`: `{ "<ruleId>": { "until": ISO, "count": n } }`. Ausgeblendet solange `now < until` **und** `count_aktuell <= count_beim_Verwerfen`. Abgelaufene Einträge werden beim nächsten Schreiben entfernt. Keine neue Tabelle.

### 2.9 Cache

Modul-lokaler Cache (5 Minuten) in `smartActionsService`. Ein Reload/Neustart der App leert ihn (JS-Modulzustand). Verwerfen einer Karte aktualisiert den Cache sofort. Fehler einzelner Regeln werden geloggt und blockieren die übrigen Regeln nicht.

### 2.10 Navigation

Regeln liefern `targetRoute` + `targetParams` + `targetSearchParams`. Nachgerüstete Filterübernahme aus der URL:

| Route | Search-Params | Verhalten |
|---|---|---|
| `/orders` | `view`, `status` (Komma-Liste), `order` | Ansicht + Statusfilter vorsetzen, `order` öffnet Detail-Panel |
| `/expenses` | `receipt=missing`, `period` | neuer Toolbar-Filter „Beleg", setzt zusätzlich steuerrelevant=Ja |
| `/tasks` | `view=list`, `overdue=1` | Listenansicht mit aktivem Überfällig-Filter |
| `/listings` | `completeness`, `status` (Komma-Listen) | Store-Filter werden vorgesetzt |
| `/products/$productId` | `tab` | Tab-Vorauswahl (auch neuer Tab `sales`) |

`targetDialog` ist im Typ vorgesehen, wird von den 8 Start-Regeln aber nicht genutzt (alle Ziele sind Ansichten).

### 2.11 Einordnung im Dashboard

Der Bereich sitzt zwischen Kopfzeile und KPI-Karten („oberhalb der bestehenden Widgets"). Severity-Farben nutzen die bestehenden Statusfarben (`danger`, `warning`, `info` inkl. `-subtle`-Flächen), Icons folgen der Kategorie (orders → ShoppingCart, products → Package, listings → FileText, expenses → Receipt, tasks → CheckSquare, system → ShieldAlert).

## 3. Sonstiges

- Keine neuen Tabellen, keine Migrationsänderungen, keine neuen Dependencies.
- Neuer Feature-Ordner `src/features/smart-actions/` gemäß expliziter Spec-Vorgabe (Abschnitt 3.1).
- `getOrderById` liefert jetzt `OrderListItem` (inkl. `product_name`) statt `Order` – abwärtskompatibel, da `OrderListItem extends Order`.
- E2E: 16 neue Tests (Verkaufslogik, jede Regel, Navigation mit Filterübernahme, Snooze inkl. Ablauf und Verschärfung, Sortierung, leerer Bereich). Gesamtlauf 32/32 grün.
