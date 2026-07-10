# Entscheidungen Modul 17 Addendum – PolyGrid-Layout und Bausteine

PolyGrid Studio Business OS | Juli 2026
Spec: `docs/specs/MODUL_17_ADDENDUM_BAUSTEINE.md` | Branch: `feat/modul-17-bausteine`

Dieses Dokument hält alle Design-Entscheidungen fest, die die Addendum-Spec
offen lässt oder bei denen die Umsetzung von der wörtlichen Lesart abweicht.

---

## EA-01: Migrationsnummer 0016, ein flaches Baustein-Schema statt Union

Nächste freie Nummer ist **0016** (`0016_modul_17_addendum_content_blocks.sql`),
registriert wie üblich nur über `src/services/database/migrations.ts` (E17-01).
Die Spec skizziert `items: string[] | text: string` – umgesetzt ist EIN flaches
Zod-Objekt mit beiden Feldern (`items` Default `[]`, `text` Default `''`);
`body_type` entscheidet, welches gerendert wird. Das vermeidet eine
Discriminated Union über `body_type` und macht das Editor-Formular (Umschalten
ohne Datenverlust) und die JSON-Migration alter Werte trivial.

## EA-02: content_blocks NULL (Alt-Dokumente) parst als leere Liste

Dokumente aus der Zeit vor Migration 0016 haben `content_blocks = NULL`. Sie
parsen als `[]` – der Editor zeigt dann keine Bausteine, „Auf Standard
zurücksetzen" lädt sie bei Bedarf. Bewusst KEIN automatisches Nachladen der
Defaults beim Lesen: Lesen bliebe sonst nicht deterministisch (Defaults liegen
in app_settings) und ein Alt-ENTWURF würde sich beim bloßen Öffnen inhaltlich
verändern. Ausgestellte Alt-Dokumente rendern ohnehin nur ihren Snapshot, der
per Schema-Default ebenfalls `content_blocks: []` erhält.

## EA-03: Startwerte der Standard-Bausteine – Referenz verallgemeinert

Die Referenz-PDF enthält auftragsspezifische Texte (Fahrschul-Website). Die
Konstanten übernehmen Struktur, Reihenfolge und Ton der Referenz, aber ohne
Auftrags-Spezifika (z.B. „Konzeption und Umsetzung der Website" statt
„Übersicht der Führerscheinklassen"). Titel exakt nach Spec-Tabelle 3.2 –
auch `optional_offer` heißt „Optional, nicht Teil dieses Auftrags" (Spec)
statt „Optional - nicht Teil dieses Auftrags" (Referenz-PDF).

## EA-04: payment_terms mit getrenntem Startwert-Text je Dokumenttyp

Spec 3.2: bei Rechnungen enthält `payment_terms` „Fälligkeit plus
Bankverbindung", bei Angeboten die Festpreis-Formulierung der Referenz. Beide
Varianten nutzen `{{zahlungsziel_tage}}`, `{{iban}}`, `{{bic}}`,
`{{kontoinhaber}}`; `{{kontoinhaber}}` fällt beim Ausstellen auf den
Firmennamen zurück, wenn kein Inhabername gepflegt ist.

## EA-05: §19-Satz jetzt auch auf Angeboten (Wortlaut unverändert)

Die Referenz (ein ANGEBOT) trägt den §19-Satz direkt unter der Summenzeile,
und die Addendum-Spec führt ihn als festen Layout-Bestandteil. Bisher setzte
`composeDocumentSnapshot` den Satz nur bei Rechnungen. Neu: IMMER gesetzt
(fachlich korrekt – im Preis ist nie USt enthalten). Eingefrorene
Alt-Snapshots bleiben unverändert; modern/classic zeigen den Satz auf neu
ausgestellten Angeboten jetzt ebenfalls. Der WORTLAUT bleibt die bestehende
Konstante `KLEINUNTERNEHMER_SATZ` („Gemäß §19 UStG …"); die Schreibweise der
Referenz („§ 19" mit Leerzeichen) übernimmt das Addendum bewusst nicht –
harte Regel: der Satz bleibt fest.

## EA-06: Snapshot friert nur AKTIVIERTE Bausteine ein

Der Snapshot ist die Render-Kopie (Spec 2.2: „alle gerenderten Daten").
Abgewählte Bausteine werden nicht gerendert und daher nicht eingefroren;
die vollständige Konfiguration (inkl. disabled) bleibt am Dokument in
`content_blocks` erhalten. Variablen in Titel, Text und Bullets werden beim
Einfrieren aufgelöst; `validity_signature` wird bei Rechnungen auch defensiv
gefiltert, falls er per Datenmanipulation in einem Rechnungs-Draft steckt.

## EA-07: Storno übernimmt keine Bausteine

Die Gegenrechnung (E17-06) entsteht ohne Bausteine (`content_blocks = []`):
Zahlungsbedingungen wären irreführend (kein Zahlungsziel, due_date NULL),
Leistungs-Blöcke gehören zum Original. Der Storno-Snapshot bleibt damit
minimal wie bisher.

## EA-08: Aussteller-Kontakt (E-Mail/Telefon/Website) als neue Settings

Der VON-Block und die Fußzeile des polygrid-Layouts brauchen E-Mail, Telefon
und Website des Ausstellers – dafür gab es keine Settings. Additiv ergänzt:
`invoice_email`, `invoice_phone`, `invoice_website` (Default `""`, keine
Pflichtangaben; leere Werte werden im Layout schlicht weggelassen). Das
Snapshot-Schema erweitert `issuer` um diese Felder und `recipient` um `email`
(aus `clients.email`, Modul 16) – alle mit Zod-Defaults, damit vor dem
Addendum eingefrorene Snapshots unverändert weiter parsen.

## EA-09: Nutzer-Standards über getSetting/setSetting, leeres Array als „nicht gesetzt"

`document_default_blocks_quote`/`_invoice` stehen NICHT in den
Settings-DEFAULTS (das sind komplexe JSON-Arrays, kein skalarer Default).
Gelesen wird direkt über `getSetting`; `null`, leeres Array oder unlesbare
Werte fallen still auf die mitgelieferten Konstanten zurück. Ein gespeicherter
Nutzer-Standard ist nie leer (abgewählte Blöcke bleiben mit `enabled: false`
im Array), daher ist `[]` als „nicht gesetzt"-Sentinel eindeutig.

## EB-01: Bausteine rendern in allen drei Layouts

Die Spec beschreibt das Fließen der Bausteine nur für polygrid. Bausteine
sind aber Dokument-INHALT, keine Layout-Dekoration: Ein aktivierter Baustein,
der beim Umschalten auf modern/classic aus der Live-Vorschau verschwände,
wäre irreführend. modern/classic rendern die Snapshot-Bausteine daher über
eine gemeinsame `ContentBlocksSection` (schlicht gestylt) nach dem
Summen-/§19-Bereich. Alt-Dokumente haben leere Snapshot-Bausteine – deren
Rendering bleibt exakt unverändert (Regressions-Kriterium).

## EB-02: Fußzeile auf jeder Seite über tfoot-Wiederholung

Das polygrid-Blatt ist ein Rahmen-`<table>` (`pg-polygrid-frame`): der
gesamte Inhalt liegt in einer tbody-Zelle, die Fußzeile im `<tfoot>`.
Browser wiederholen thead/tfoot beim Druck auf jeder Seite – ohne
`position: fixed` (Überlappungsrisiko mit Inhalt) und ohne JS-Paginierung.
Die dunkle Positions-Kopfzeile wiederholt sich analog über ihren `<thead>`.

## EB-03: Positionstitel = erste Zeile der Beschreibung

Die Referenz zeigt Positionen mit fettem Titel und grauem Detailtext;
`line_items` hat aber nur EIN Beschreibungsfeld. polygrid rendert die erste
Zeile der Beschreibung fett als Titel, alle weiteren Zeilen kleiner/grau –
ohne Datenmodell-Änderung, mehrzeilige Bestandsdaten sehen automatisch
richtig aus. modern/classic bleiben bei der unveränderten Darstellung.

## EB-04: Mengenspalte bei Menge ≠ 1 (nicht nur > 1)

Spec Abschnitt 2 blendet die Mengenspalte aus, „wenn alle Positionen Menge 1
haben"; das Akzeptanzkriterium formuliert „mindestens eine Position Menge
> 1". Umgesetzt ist Menge ≠ 1: auch Bruchmengen (z.B. 0,5 Stunden) brauchen
die Spalte, sonst wäre der Einzelpreis nicht nachvollziehbar.

## EB-05: „Gesamtbetrag (Festpreis)" bei Angeboten, „Gesamtbetrag" bei Rechnungen

Die Spec nennt beide Varianten ohne Zuordnung („bzw."). Die Referenz (ein
Angebot) trägt „(Festpreis)" – zugeordnet nach Typ: Angebote versprechen den
Festpreis, Rechnungen weisen schlicht den Betrag aus (bei Storno mit
negativem Betrag wäre „Festpreis" zudem falsch).

## EB-06: Angebots-Metazeile „Angebotsnr.:" ergänzt

Die Spec listet für Angebote nur „Datum:" (die manuell erstellte Referenz
hatte keinen Nummernkreis). Da ausgestellte Angebote eine lückenlose Nummer
tragen, zeigt polygrid sie als erste Metazeile – sonst wäre die Nummer
nirgends auf dem Dokument sichtbar.

## EB-07: E2E-Anpassung an das neue Default-Layout

`documents.spec.ts` prüfte den Modern-Titel („Rechnung R-JJJJ-NNN" in einem
Element). Im polygrid-Kopf stehen Typ (groß) und Nummer (Metazeile) getrennt –
die Assertion wurde auf `doc-title` (Typ) + `doc-meta` (Nummer) aufgeteilt.
Kein Verhaltens-Fix „am Test vorbei": das Default-Layout hat sich gewollt
geändert, Tests mit explizitem Layout modern/classic laufen unverändert.

## EA-10: Umwandlung Angebot→Rechnung lädt Rechnungs-Defaults im Service

Spec 3.5 verortet das Verhalten im Editor (Etappe C), umgesetzt ist es eine
Ebene tiefer: `convertQuoteToInvoice` ruft `createDocument` OHNE
`content_blocks` auf, wodurch automatisch die Rechnungs-Standardwerte
(Nutzer-Standard oder Konstanten) geladen werden. Damit gilt die Regel auch
für jeden anderen Aufrufer (z.B. „Abrechnen mit Rechnung", Command-Palette),
nicht nur für den Editor-Button.
