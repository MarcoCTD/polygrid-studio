# Entscheidungen Modul 16 – Website-CRM

PolyGrid Studio Business OS | Juli 2026
Spec: `docs/specs/MODUL_16_WEBSITE_CRM.md` | Branch: `feat/modul-16-website-crm`

Dieses Dokument hält alle Design-Entscheidungen fest, die die Spec offen lässt
oder bei denen die Umsetzung von der wörtlichen Lesart abweicht.

---

## E16-01: Migrationsnummer 0014, Registrierung nur über migrations.ts

Die Dateien `drizzle/0000…0013` sind lückenlos, die nächste freie Nummer ist
**0014** (`0014_modul_16_website_crm.sql`). Das Drizzle-Meta-Journal
(`drizzle/meta/_journal.json`) endet historisch bei 0008 und wird seit Modul 08
nicht mehr gepflegt – maßgeblich ist allein die Tag-Registry in
`src/services/database/migrations.ts`. Das Journal wurde bewusst NICHT
angefasst, bestehende Migrationsdateien sind unverändert.

## E16-02: Keine Rust-Änderungen für Zugangsdaten

Die generischen Tauri-Commands `keychain_set/get/delete` (Service
`polygrid-studio`) existieren seit Modul 06/11 und decken das Account-Schema
`polygrid_credential_{id}` bereits ab. Der TS-Service
`features/websites/services/credentialsService.ts` ruft sie direkt per
`invoke` auf – exakt dieselbe Infrastruktur wie die API-Keys, `cargo check`
bleibt ohne Änderung grün. Der E2E-Mock (`tauriMock.ts`) bedient die Commands
unverändert über die In-Memory-Keychain-Map.

## E16-03: cost_out / price_in sind strikt positiv (nicht nur "gesetzt")

Die Spec verlangt "mindestens eines von cost_out und price_in gesetzt".
Zusätzlich gilt: Wenn gesetzt, muss der Wert > 0 sein. Grund: Der
Expense-Service verlangt `amount_gross > 0`; ein Posten mit 0 € würde in der
Engine unweigerlich scheitern. Das Update prüft das Refinement gegen den
gemergten Zustand im Service (Zod-Partial kann den Gesamtzustand nicht sehen).

## E16-04: Kunden-Löschung wird bei aktiven Projekten/Posten blockiert

Statt Kaskaden-Soft-Delete: `softDeleteClient` wirft, solange aktive
(nicht gelöschte) Projekte oder laufende Posten am Kunden hängen. Das ist
das einfachste Verhalten ohne Wiederherstellungs-Ambiguität und verhindert
verwaiste Posten, die die Recurring-Engine weiter bebuchen würde.

## E16-05: Idempotenz der Recurring-Engine – dreifach statt nur Feld

Spec: `last_generated_until` + "Engine-Log light". Umgesetzt:

1. `last_generated_until` am Posten (Perioden ≤ Datum gelten als erledigt)
2. Ausgaben tragen `import_ref = {posten_id}` und das Fälligkeitsdatum als
   `date` – vor dem Anlegen wird auf Existenz geprüft
3. Aufträge tragen `external_order_id = "website:{posten_id}:{datum}"` –
   ebenfalls mit Existenzprüfung

Damit sind auch Teilfehler abgesichert (Ausgabe angelegt, Auftrag
fehlgeschlagen → nächster Lauf holt nur den Auftrag nach) und mehrfacher
App-Start am selben Tag erzeugt nie Duplikate. "Engine-Log" ist wie in der
Spec erlaubt das bestehende Logging-Muster (`console.info/error` mit
`[WebsiteRecurring]`-Präfix), keine neue Tabelle. Hinweis: Der technische
Idempotenz-Schlüssel ist im Feld "Externe Bestell-ID" des Auftrags sichtbar
(und im EÜR-Buchungstext) – bewusst in Kauf genommen, er macht die Herkunft
nachvollziehbar.

## E16-06: Engine-Läufe sind serialisiert

`runWebsiteRecurringEngine` läuft über eine Promise-Queue (Muster
`receiptNumber.runExclusive`). Grund: Der Init-Effekt in `App.tsx` feuert im
React-StrictMode (Dev) doppelt, und "Jetzt prüfen" kann während des
App-Start-Laufs geklickt werden. Ohne Serialisierung wären Check+Insert
racebehaftet. Der zweite Lauf findet dank Idempotenz nichts mehr und erzeugt
keinen Erfolgs-Toast.

## E16-07: Nachhol-Limit – die JÜNGSTEN 12 Perioden werden erzeugt

Bei mehr als 12 verpassten Perioden werden die 12 jüngsten nachgeholt, ältere
verfallen ersatzlos (Warn-Toast nennt den Posten). `next_due` steht danach in
der Zukunft, das Limit greift also nur einmal. Die jüngsten statt der
ältesten, damit der aktuelle Abrechnungsstand (letzte 12 Monate) korrekt ist.

## E16-08: "3 Monate zurück = 3 Posten" – Zählweise

Fällige Perioden sind alle Termine `next_due, next_due+Intervall, … ≤ heute`.
Liegt `next_due` exakt 3 Monate zurück und der Monatstag ist bereits erreicht,
sind das 4 Perioden (3 verpasste + die heutige). Der Spec-Grenzfall "3 Posten"
gilt, wenn die aktuelle Periode noch nicht fällig ist – beide Varianten sind
per Unit-Test abgedeckt, der E2E-Test seeded so, dass exakt 3 fällig sind.
Monatsarithmetik mit Monatsende-Klemmung (31.01. → 28.02.), iterativ wie die
Recurring-Engine aus Modul 04.

## E16-09: Ausgaben der Engine tragen recurring=true OHNE Intervall-Felder

Spec: "recurring = true". `recurring_interval`/`recurring_next_date` bleiben
bewusst NULL, sonst würde die Ausgaben-Recurring-Engine aus Modul 04
(`processDueRecurringExpenses`) denselben Posten eigenständig fortschreiben –
Doppelbuchungen. Quelle der Wahrheit für die Fortschreibung ist allein der
laufende Posten.

## E16-10: Neue Ausgaben-Unterkategorien hosting/domain/wartung

"Unterkategorie nach type" braucht passende Enum-Werte: `software_saas`
wurde additiv um `hosting`, `domain`, `wartung` erweitert (Konstanten +
Labels, Modul-04-Datei, rein additiv). Typ `sonstiges` bucht ohne
Unterkategorie (NULL). Vendor-Fallback: fehlt `cost_out_vendor`, wird das
Label als Händler verwendet (Pflichtfeld im Expense-Schema).

## E16-11: Plattformgebühr website = 0 als echte Gebührenkonfiguration

`website` ist in den Plattformgebühren-Settings (Defaults + Settings-UI
"Material & Plattformen") mit 0 %/0 € hinterlegt statt als Sonderfall wie
`direkt` (null). Damit rechnet `getPlatformFee` normal und Aufträge tragen
`platform_fee = 0`. Der Settings-Typ wurde von `Record<Platform, …>` auf
`Record<FeePlatform, …>` (`Platform | 'website'`) verbreitert – das
Produkt-`platformEnum` (etsy/ebay/kleinanzeigen) bleibt unverändert, denn
website ist keine Listing-Plattform.

## E16-12: Neuer Suchparameter platform an der Aufträge-Route

Für die Smart Action `website_order_unpaid` ("Kanban gefiltert") wurde die
Aufträge-Route um `?platform=` ergänzt (kommagetrennt, Zod-validiert), analog
zum bestehenden `?status=`. Der Filter wird in den Toolbar-Zustand übernommen.

## E16-13: Zugangsdaten-UI – Reihenfolge der Schreiboperationen

Anlegen: erst Secret in den Keychain, dann Metadaten in die DB; schlägt die
DB fehl, wird der Keychain-Eintrag zurückgerollt (kein Waisen-Secret).
Löschen: erst Metadaten entfernen, dann Keychain-Eintrag. Soft-Delete eines
Kunden/Projekts löscht Keychain-Einträge NICHT (Wiederherstellung bleibt
möglich); nur das explizite Löschen eines Zugangsdaten-Eintrags entfernt das
Secret. Secrets tauchen in keinem Log, keinem Export und keinem Zod-Schema
auf; E-Mail/Telefon werden bewusst nicht formatvalidiert (freie Texte).

## E16-14: Abrechnen setzt kein Datum in die Vergangenheit

`billWebsiteProject` erzeugt den Auftrag mit `order_date = heute`, Status
`ordered`, `payment_status = pending` (nie paid – EÜR zählt erst bei
Zahlungseingang, den der Nutzer manuell bestätigt). Ohne Projektpreis wird
mit klarer Fehlermeldung abgelehnt; ein zweites Abrechnen ist blockiert
(`order_id` gesetzt, Button zeigt stattdessen den Link zum Auftrag).

## E16-15: Kennzahlen zählen nur aktive Posten und nicht-abgeschlossene Projekte

Monatsnormalisierung: `yearly / 12`, `monthly` unverändert; inaktive Posten
zählen nicht. "Aktive Projekte" = Status nicht in (live, archived).

## E16-16: numberOrNull für optionale Zahlenfelder

React Hook Form reicht auch den Default-Wert (null) durch `setValueAs`;
naives `Number(value)` macht daraus 0 (`Number(null) === 0`) – ein leeres
Kundenpreis-Feld wäre als 0 € gespeichert bzw. an Zod gescheitert. Der
Helfer `features/websites/utils.ts#numberOrNull` behandelt '', null und
undefined als null. (Hinweis: dasselbe Muster in `NewOrderModal` aus Modul 08
hat potenziell dasselbe Verhalten bei `shipping_revenue`; außerhalb des
Modul-Scopes, nicht angefasst.)

## E16-17: Smart-Action-Kategorie websites

Die Karten brauchen eine Kategorie fürs Icon; `SmartActionCategory` wurde um
`websites` (Globe) erweitert. Die drei Regeln liegen im Websites-Feature
(`smartActionRules.ts`) und werden vom `smartActionsService` beim Modul-Load
über `registerSmartActionRules()` registriert – Registry-Mechanismus aus
Modul 15, kein Fork. Schwellenwerte (30/7/14/7 Tage) liegen als Konstanten
bei den Regeln.
