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

## EA-10: Umwandlung Angebot→Rechnung lädt Rechnungs-Defaults im Service

Spec 3.5 verortet das Verhalten im Editor (Etappe C), umgesetzt ist es eine
Ebene tiefer: `convertQuoteToInvoice` ruft `createDocument` OHNE
`content_blocks` auf, wodurch automatisch die Rechnungs-Standardwerte
(Nutzer-Standard oder Konstanten) geladen werden. Damit gilt die Regel auch
für jeden anderen Aufrufer (z.B. „Abrechnen mit Rechnung", Command-Palette),
nicht nur für den Editor-Button.
