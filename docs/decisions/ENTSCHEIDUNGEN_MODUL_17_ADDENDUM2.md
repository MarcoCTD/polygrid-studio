# Entscheidungen Modul 17 Addendum 2 – Dokument-Konfigurator

PolyGrid Studio Business OS | Juli 2026
Spec: `docs/specs/MODUL_17_ADDENDUM2_KONFIGURATOR.md` | Branch: `feat/modul-17-konfigurator`

Dieses Dokument hält alle Design-Entscheidungen fest, die die Addendum-2-Spec
offen lässt oder bei denen die Umsetzung von der wörtlichen Lesart abweicht.

---

## Vorbemerkung: Branch-Basis

`feat/modul-17-konfigurator` war von `main` abgezweigt und enthielt die
Addendum-1-Implementierung (Bausteine, polygrid-Layout) nicht, auf der
Addendum 2 aufbaut. `feat/modul-17-bausteine` wurde deshalb zu Beginn in
diesen Branch gemergt (Merge-Commit, keine Historie umgeschrieben).

## EK2-01: items-Kompatibilität als reine Lese-Normalisierung

Die Erweiterung `items: string[]` → `{ text, enabled }[]` läuft ausschließlich
über einen Zod-Transform beim Parsen (`ContentBlockItemCompatSchema`): nackte
Strings werden als `enabled: true` interpretiert. Es gibt KEINEN
Migrationslauf und kein Zurückschreiben – gespeicherte Dokument-Zeilen und
insbesondere eingefrorene Snapshots bleiben byte-identisch (Test:
Lesen + `updateDocumentPdfPath` verändern die Snapshot-Spalte nicht).
Draft-Dokumente wechseln beim nächsten regulären Speichern im Editor auf das
neue Format – das ist eine erlaubte Inhaltsänderung an einem Entwurf.

## EK2-02: Standard-Keys bleiben, Migration ist Migration-on-read

Die Spec verlangt „Migration der vorhandenen Keys beim ersten Laden, alte
Werte übernehmen". Umgesetzt: Der Konfigurator pflegt DIESELBEN Keys
(`document_default_blocks_quote`/`_invoice`), die bisher „Als Standard
speichern" beschrieb. Alte Werte (items als string[]) werden beim Lesen durch
EK2-01 normalisiert und beim nächsten Speichern im neuen Format abgelegt –
kein Datenverlust, kein separater Migrationsschritt, kein zweiter Key.

## EK2-03: Snapshot friert nur aktivierte Stichpunkte ein

Konsequenz aus EA-06 (Snapshot = Render-Kopie): deaktivierte Stichpunkte
werden nicht gerendert und daher nicht eingefroren. Die vollständige
Konfiguration inkl. deaktivierter Punkte bleibt am Dokument
(`content_blocks`) erhalten. Der Renderer filtert zusätzlich defensiv auf
`enabled` – für alte Snapshots ist das neutral, weil deren Punkte per
Transform alle `enabled: true` sind (Rendering unverändert, harte Regel).

## EK2-04: Seed-Texte der Positionsvorlagen – Referenz verallgemeinert

Spec 2.2 sagt für „Komplettpaket" „Beschreibung aus referenz-angebot.pdf
übernehmen"; die PDF-Beschreibung ist aber auftragsspezifisch
(Fahrschul-Website). Wie bei den Standard-Bausteinen (EA-03) übernehmen die
Seeds Struktur, Ton und Preis der Referenz ohne Branchen-Spezifika
(„Leistungs- und Preisbereich" statt „Führerscheinklassen", „Ihre E-Mail"
statt „Fahrschul-Mail"). Titel: „Website-Erstellung (Komplettpaket)",
„Website-Erstellung Onepager" (Beispiel aus Spec 2.2), „Website-Refresh".
Alle Texte bleiben im Konfigurator frei editierbar.

## EK2-05: Positionsvorlagen – leere Liste ist gültig, Seed nur bei fehlendem Key

Anders als bei den Baustein-Standards (EA-09, `[]` = „nicht gesetzt") ist eine
bewusst geleerte Vorlagen-Liste ein gültiger Nutzerzustand: Wer alle Vorlagen
löscht, bekommt sie nicht beim nächsten Start zurück. Geseedet wird nur, wenn
der Key `document_position_templates` fehlt (erster Start); der Seed wird
dabei persistiert, damit die ids stabil bleiben. Unlesbare Werte fallen
in-memory auf den Seed zurück, ohne den gespeicherten Wert zu überschreiben.

## EK2-06: Standard-Einleitungstexte als vier skalare Settings-Keys

`document_default_intro_quote/_invoice` und `document_default_outro_quote/
_invoice` stehen (anders als die Baustein-Arrays, EA-09) in den
Settings-DEFAULTS – es sind einfache Strings. Vorbelegt wird in
`createDocument` NUR, wenn der Aufrufer das Feld gar nicht mitgibt
(`undefined`); ein explizites `null` bleibt „kein Text". Dadurch übernimmt
die Umwandlung Angebot→Rechnung weiterhin die Angebots-Texte (auch ein leerer
bleibt leer), Storno und „Abrechnen mit Rechnung" behalten ihre eigenen
Texte, und nur wirklich NEUE Dokumente (Modal, Command-Palette) erhalten die
Vorbelegung. Variablen werden wie bisher erst beim Ausstellen aufgelöst.

## EK2-07: Positionsvorlage → Position: Titel wird erste Beschreibungszeile

`line_items` hat weiterhin nur EIN Beschreibungsfeld (kein Schema-Umbau).
`lineItemFromPositionTemplate` setzt den Vorlagen-Titel als erste Zeile und
die Beschreibung darunter – das polygrid-Layout rendert die erste Zeile fett
als Positionstitel (EB-03), modern/classic zeigen den Text mehrzeilig.
Nachträgliche Änderungen wirken nur im Dokument, nie zurück auf die Vorlage
(die Position ist eine Kopie, keine Referenz).
