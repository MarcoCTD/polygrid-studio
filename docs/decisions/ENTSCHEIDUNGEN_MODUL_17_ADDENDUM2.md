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

## EK2-08: Konfigurator als eigene Route /documents/templates

„Eigener Unterbereich im Dokumente-Tab … als eigene Ansicht (kein Modal)"
ist als vollwertige Route `/documents/templates` umgesetzt (statischer Pfad
gewinnt beim TanStack-Router-Ranking über `/documents/$documentId`). Die
Abschnitte laufen über den Search-Param `section` (positions/blocks/texts),
der Dokumenttyp des Bausteine-Abschnitts über `type` – damit kann der Editor
per „Standards verwalten" direkt in den passenden Abschnitt verlinken
(Spec 4) und die Ansicht ist per URL adressierbar (Muster: Websites-Tabs).

## EK2-09: Speichern im Konfigurator – Positionen sofort, Bausteine/Texte explizit

Positionsvorlagen persistieren pro Aktion (Dialog-Speichern, Duplizieren,
Löschen mit Bestätigungsdialog – Sicherheit by Default). Bausteine und
Einleitungstexte haben einen expliziten Speichern-Button je Abschnitt bzw.
Typ: Das Settings-Auto-Save-Muster (Debounce pro Key) passt nicht zu einem
komplexen Array, bei dem Zwischenzustände (halb umsortiert, leerer Titel)
nicht als Standard landen sollen. Beim Speichern werden Titel/Stichpunkte
getrimmt und leere Stichpunkte entfernt (gleiches Verhalten wie der Editor).

## EK2-10: Stichpunkt-Checkboxen im geteilten ContentBlocksEditor

Konfigurator (Default-Flags) und Dokument-Editor (Override pro Dokument)
nutzen dieselbe Komponente – die Checkbox pro Stichpunkt ersetzt den
Aufzählungspunkt, deaktivierte Punkte werden durchgestrichen dargestellt.
Dadurch ist das Nutzer-Beispiel („Professionelles Fotoshooting" abschalten,
ohne den Text zu löschen) an beiden Orten identisch bedienbar.

## EK2-11: Positionsbeschreibung wird Textarea (mehrzeilig)

Das Beschreibungsfeld der Positionsliste war ein einzeiliges `<input>` –
Browser verwerfen dort Zeilenumbrüche. Damit wäre der Titel/Beschreibungs-
Split der Vorlagen (EK2-07/EB-03) beim ersten Editieren der Zeile verloren
gegangen und mehrzeilige Positionen wären im Editor gar nicht erfassbar.
Das Feld ist jetzt eine automatisch wachsende Textarea (eine Zeile hoch im
Leerzustand); Enter erzeugt bewusst eine neue Beschreibungszeile statt
eine neue Position.

## EK2-12: Editor-Buttons ersetzt, betroffene E2E-Tests angepasst

„Als meinen Standard speichern" und „Auf Standard zurücksetzen" sind gemäß
Spec 4 ersatzlos durch „Standards verwalten" ersetzt (Deep-Link in den
Konfigurator, Abschnitt Bausteine, passender Dokumenttyp). Die Service-
Funktion `saveDefaultContentBlocksForType` bleibt bestehen – sie ist jetzt
der Speicherweg des Konfigurators. Der Addendum-1-E2E-Test der alten
Buttons wurde auf den Konfigurator-Weg umgeschrieben – wie bei EB-07 kein
„Fix am Test vorbei", sondern eine von der neueren Spec gewollte
Verhaltensänderung. Gleiches gilt für „Position hinzufügen": der Button
öffnet jetzt die Vorlagen-Auswahl, die Test-Helfer klicken zusätzlich
„Leere Position".

## EK2-13: Optional-Kasten – Subtle-Farbe aus der Snapshot-Akzentfarbe berechnet

Die Spec nennt die Design-Tokens `--accent-primary-subtle`/`--accent-primary`.
Das Dokument-Blatt rendert aber bewusst NICHT aus den App-Tokens, sondern aus
der beim Ausstellen eingefrorenen `accent_color` (Hex) im Snapshot – sonst
würde ein späterer Akzentfarben-Wechsel ausgestellte Dokumente umfärben.
Der Kasten-Hintergrund wird deshalb mit derselben Formel wie das
Akzentfarben-System (Sättigung −20, Helligkeit 95 – Hell-Modus, das Blatt
ist immer hell) aus der Snapshot-Farbe berechnet. `print-color-adjust:
exact` liegt direkt auf dem Kasten (`.pg-polygrid-optional`). Der Kasten ist
reine Darstellung des kind `optional_offer` im polygrid-Layout;
modern/classic und bestehende Snapshots rendern unverändert.

## EK2-14: Logo-Diagnose (Spec 5) – Befund und Fixes

Diagnose in der Spec-Reihenfolge, verifiziert per E2E gegen den echten
Render-Weg:

- (a) Layout-Bug? NEIN – polygrid rendert `snapshot.logo` als `<img>`;
  mit konfiguriertem Logo erscheint es oben links in der Vorschau.
- (b) Laden/Einfrieren (E17-04)? NEIN – die Data-URL aus `invoice_logo`
  landet über `loadInvoiceSettings` → `composeDocumentSnapshot` korrekt im
  Snapshot (Test inkl. späterem Logo-Wechsel: Snapshot bleibt unverändert).
- (c) Druck? JA, hier lag ein echter Fehler: `DocumentPrintPortal` wartete
  vor `window.print()` nur zwei Animation-Frames. Das garantiert Layout,
  aber NICHT das Decoding der Bilder – ein großes Data-URL-Logo konnte im
  gedruckten PDF fehlen (leere Stelle oben links), obwohl die Vorschau es
  zeigte. Fix: vor dem Druck `img.decode()` aller Bilder im Print-Portal
  abwarten; Decode-Fehler blockieren den Druck nicht.

Zusätzlich gemäß Spec 5: Der Fallback ohne konfiguriertes Logo rendert den
Firmennamen fett in Markenfarbe (vorher schwarz) – nie eine leere Lücke.
Verbleibende mögliche Ursache beim Nutzer ist eine fehlende Konfiguration
(z.B. Logo-Datei über 1 MB beim Auswählen abgelehnt, E17-04); das deckt der
Fallback jetzt sichtbar ab und gehört in die manuelle Prüfliste.

## EK2-07: Positionsvorlage → Position: Titel wird erste Beschreibungszeile

`line_items` hat weiterhin nur EIN Beschreibungsfeld (kein Schema-Umbau).
`lineItemFromPositionTemplate` setzt den Vorlagen-Titel als erste Zeile und
die Beschreibung darunter – das polygrid-Layout rendert die erste Zeile fett
als Positionstitel (EB-03), modern/classic zeigen den Text mehrzeilig.
Nachträgliche Änderungen wirken nur im Dokument, nie zurück auf die Vorlage
(die Position ist eine Kopie, keine Referenz).
