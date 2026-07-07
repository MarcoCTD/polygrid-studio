# Entscheidungen Modul 13 — Playbooks (Automatisierung)

Design-Entscheidungen, die die Spec (`docs/specs/MODUL_13_PLAYBOOKS.md`) offen lässt.
Stand: Juli 2026, Branch `feat/modul-13-playbooks`.

## E13-01: Variablen-Registry per Cherry-Pick übernommen

Die Spec setzt die zentrale Variablen-Registry aus der Fix-Session Juli 2026 voraus
(`src/features/templates/variableRegistry.ts`). Diese lag nur auf dem unmergten Branch
`fix/settings-gemini-templates`. Der Registry-Commit (`1202228`) wurde einzeln auf den
Feature-Branch gecherry-pickt — die beiden anderen Commits jenes Branches (Settings-Zahlenfelder,
KI-Modelllisten) gehören nicht zum Modul-Scope und wurden nicht übernommen.

## E13-02: Seed der Beispiel-Playbooks in der Migration selbst

„Beim ersten Start nach der Migration" wird umgesetzt als `INSERT`-Statements am Ende der
Migration `0013_modul_13_playbooks.sql` (feste UUIDs, `enabled = 0`). Das Migrations-Tracking
garantiert Genau-einmal-Ausführung, ohne zusätzlichen First-Run-Code im App-Start.

## E13-03: Feature-Ordner `src/features/playbooks/`

Playbooks sind eine eigene Fachdomäne (Engine + Schemas + Services), auch wenn die UI im
Settings-Tab lebt. Analog zum bestehenden, nachträglich ergänzten `src/features/finance/`
wurde ein eigener Feature-Ordner angelegt; die Settings-UI importiert daraus.

## E13-04: Engine feuert auch beim Anlegen eines Auftrags

Ein neu angelegter Auftrag „erreicht" seinen Anfangsstatus (z.B. Direktverkauf sofort `paid`).
`createOrder` ruft daher denselben Hook wie `updateOrder`. Der Idempotenz-Index verhindert
Doppelläufe, falls der Status später erneut erreicht wird.

## E13-05: Engine wird awaited, aber fehlerisoliert

Der Hook `triggerPlaybooksAfterStatusPersist` läuft NACH dem `UPDATE`/`INSERT` des Status,
wird awaited (deterministisch für UI und Tests) und ist doppelt abgesichert: Die Engine
selbst wirft nie nach außen, und der Hook hat zusätzlich try/catch. Eine fehlgeschlagene
Playbook-Ausführung kann die Statusänderung damit weder blockieren noch zurückrollen
(expliziter Test in `playbookEngine.test.ts`).

## E13-06: create_expense — Verknüpfung und Kennzeichnung

- `order_id` der erstellten Ausgabe wird auf den auslösenden Auftrag gesetzt (Spec nennt nur
  `product_id`; die Verknüpfung macht die Herkunft nachvollziehbar und die Auftragskalkulation korrekt).
- `import_source` bleibt `manual` — das Enum gehört Modul 04 und wird nicht erweitert.
  Stattdessen vermerkt `notes` die Herkunft: „Automatisch erstellt durch Playbook …".
- „Leerer Wert" bei `amount_source` heißt `NULL` **oder** `<= 0` (eine Ausgabe über 0 € ist
  fachlich sinnlos und würde die Zod-Validierung von Modul 04 ohnehin nicht passieren).

## E13-07: Dry-Run ignoriert enabled/Plattform-Filter, meldet den Filter aber

Der Test-Button soll auch deaktivierte oder gefilterte Playbooks prüfbar machen. Ein Dry-Run
läuft daher immer; würde der Plattform-Filter den gewählten Auftrag im Echtbetrieb
ausschließen, wird das als Hinweis-Zeile im Ergebnis ergänzt.

## E13-08: Skip zählt als `partial`, `error` nur wenn ALLE Aktionen fehlschlagen

Spec-Wortlaut umgesetzt: `success` = alle ok, `partial` = mindestens eine übersprungen oder
fehlgeschlagen, `error` = ausnahmslos alle fehlgeschlagen (Skips verhindern `error`).

## E13-09: Vitest auf `src/` begrenzt

`npm test` (vitest) sammelte bisher auch die Playwright-Specs unter `tests/e2e` ein und
schlug damit immer fehl (vorbestehend, unabhängig von Modul 13). `vite.config.ts` begrenzt
Vitest jetzt auf `src/**/*.test.{ts,tsx}`; E2E läuft weiterhin über `npx playwright test`.

## E13-10: Toast-Navigation per Lazy-Import des Routers

Der Klick auf „Log öffnen" im Toast navigiert über den Router-Singleton. Der Import erfolgt
lazy (dynamischer Import), um den Zyklus ordersService → notifications → router → Routen →
OrdersPage → ordersService zu vermeiden.

## E13-11: CopyDialog erhält optionale Vorbefüllung (Etappe C)

Für das suggest_template-Banner wird der bestehende Kopieren-Dialog um eine optionale,
rückwärtskompatible `initialValues`-Prop erweitert, statt einen zweiten Dialog zu bauen.
Die Werte kommen aus derselben Registry-Auflösung wie in der Engine.

## E13-12: Banner erscheint auch im bereits geöffneten Detail-Panel

Die Spec verlangt das Banner „beim nächsten Öffnen" des Detail-Panels. Umgesetzt ist ein
Superset: Der Banner lädt zusätzlich sofort nach, wenn sich Status/updated_at des Auftrags
im geöffneten Panel ändern — wer den Status direkt im Panel setzt, sieht den Vorschlag
ohne das Panel schließen zu müssen.

## E13-13: Statusänderung erzeugt einen Run auch bei leerem Ergebnis nicht

Passt kein aktives Playbook (falscher Status, Plattform-Filter, deaktiviert), wird KEIN
Run protokolliert — das Log bildet nur tatsächliche Ausführungen ab, keine Prüfungen.

---

Nachträge aus der Verifikations-Session (Juli 2026):

## E13-14: Mehrere Playbooks pro Trigger laufen in Anlage-Reihenfolge

Die Engine sortiert per `ORDER BY created_at, id`. Ohne ORDER BY war die Reihenfolge
SQLite-implementierungsabhängig; jetzt ist sie deterministisch (ältestes Playbook zuerst).

## E13-15: Engine ignoriert soft-gelöschte Aufträge

`loadOrderContext` filtert `deleted_at IS NULL`. Ein Statuswechsel an einem gelöschten
Auftrag (theoretisch nur programmatisch möglich) löst keine Playbooks aus. Der
Produkt-Join bleibt bewusst ungefiltert: `{{produktname}}` ist auch bei inzwischen
soft-gelöschtem Produkt auflösbar — konsistent mit `getOrderById`.

## E13-16: Task-Titel wird nach Variablenersetzung auf 200 Zeichen gekürzt

Das Task-Schema begrenzt Titel auf 200 Zeichen; lange Variablenwerte konnten die Grenze
nach der Ersetzung sprengen und die Aktion sinnlos scheitern lassen. Die Engine kürzt
mit Ellipse (…) statt zu fehlschlagen.

## E13-17: Leere Variablenwerte bleiben Platzhalter, niemals "null" oder Leerstring

Fehlt z.B. der Kundenname am Auftrag, bleibt `{{kundenname}}` als Rohtext im Ergebnis
stehen und wird im Run-Result als nicht auflösbar gemeldet (Spec-Wortlaut). Es wird
nie "null" oder ein Leerstring mitten im Satz eingesetzt. `{{bestellnummer}}` fällt
ohne externe Bestellnummer auf die interne Belegnummer zurück (Registry-Verhalten).
