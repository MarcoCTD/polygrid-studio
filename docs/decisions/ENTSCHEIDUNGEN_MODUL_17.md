# Entscheidungen Modul 17 – Angebote und Rechnungen

PolyGrid Studio Business OS | Juli 2026
Spec: `docs/specs/MODUL_17_ANGEBOTE_RECHNUNGEN.md` | Branch: `feat/modul-17-dokumente`

Dieses Dokument hält alle Design-Entscheidungen fest, die die Spec offen lässt
oder bei denen die Umsetzung von der wörtlichen Lesart abweicht.

---

## E17-01: Migrationsnummer 0015, Registrierung nur über migrations.ts

Die Dateien `drizzle/0000…0014` sind lückenlos, die nächste freie Nummer ist
**0015** (`0015_modul_17_documents.sql`). Wie seit Modul 08 etabliert (siehe
E16-01) ist allein die Tag-Registry in `src/services/database/migrations.ts`
maßgeblich; das Drizzle-Meta-Journal wird nicht gepflegt.

## E17-02: Additive Spalte clients.address für die Empfänger-Anschrift

Die Pflichtangaben-Validierung (Spec 2.3) verlangt die vollständige Anschrift
des Empfängers, die `clients`-Tabelle aus Modul 16 hat aber kein Adressfeld.
Statt die Adresse pro Dokument doppelt zu erfassen, wurde `clients` additiv um
eine nullable Spalte `address` (mehrzeiliger Freitext) erweitert – Migration
0015, Drizzle-Schema und Kunden-UI (Detail-Panel, Neuer-Kunde-Modal) ziehen
nach. Bestehende Kunden bleiben gültig; ohne Adresse ist lediglich das
Ausstellen einer RECHNUNG an diesen Kunden blockiert (mit klarer Meldung).
Freitext statt Einzelfelder (Straße/PLZ/Ort), weil die Anschrift nur gerendert,
nie ausgewertet wird.

## E17-03: Statuswerte und erlaubte Übergänge

`status`-Werte: `draft`, `issued`, `accepted`/`rejected` (nur quote),
`paid`/`cancelled` (nur invoice). Übergänge ausschließlich über dedizierte
Service-Funktionen:

- `issueDocument`: draft → issued (Nummer + Snapshot, Pflichtangaben-Gate)
- `markQuoteAccepted`/`markQuoteRejected`: issued → accepted/rejected
- `convertQuoteToInvoice`: erzeugt Rechnungs-DRAFT, setzt das Angebot
  (falls noch issued) auf accepted – die Umwandlung ist die Annahme
- `markInvoicePaid`: issued → paid
- `cancelInvoice`: issued/paid → cancelled + neue Gegenrechnung

Statuswechsel und Link-Felder (`order_id`, `pdf_path`) sind KEINE inhaltliche
Änderung – der Snapshot und alle Inhaltsfelder bleiben nach dem Ausstellen
unangetastet. `updateDocument`/`softDeleteDocument` arbeiten strikt nur auf
Drafts (Service-Ebene, zusätzlich UI-Sperre).

## E17-04: Logo als Data-URL in app_settings statt Datei im App-Datenverzeichnis

Die Spec nennt "Dateiauswahl, Kopie im App-Datenverzeichnis". Umgesetzt ist die
Kopie als Base64-Data-URL im Setting `invoice_logo` (die SQLite-DB liegt im
App-Datenverzeichnis, die Kopie damit auch). Gründe:

1. Kein neuer Rust-Command und keine erweiterten fs-Capabilities nötig
   (`fs:allow-read-file` reicht zum Einlesen der gewählten Datei).
2. Die Druck-/PDF-Ansicht kann das Logo ohne Asset-Protokoll direkt einbetten –
   zuverlässig auch im Print-Kontext und im E2E-Mock.
3. Der Snapshot friert das Logo als Data-URL ein; ein später gelöschtes oder
   getauschtes Logo kann ausgestellte Dokumente nicht mehr verändern (bei einem
   Dateipfad wäre genau das passiert).

Größen-Limit 1 MB pro Logo (Validierung bei der Auswahl), empfohlen PNG/JPG.

## E17-05: Nummernkreis – Konstanten, Format, Parallelität

Format fix über Konstanten (`DOCUMENT_NUMBER_PREFIXES`, `MIN_COUNTER_DIGITS=3`):
`A-JJJJ-NNN` bzw. `R-JJJJ-NNN`, ab Zähler 1000 automatisch mehr Stellen.
Implementierung analog `receiptNumber.ts` (Modul 08): MAX-Query über die
`documents.number`-Spalte + Reservierungs-Cache pro DB-Instanz + globale
Promise-Queue. Zusätzlich ist die GESAMTE Ausstell-Operation (inkl. Persistieren)
über dieselbe Queue serialisiert – paralleles Ausstellen zweier Drafts erzeugt
verschiedene Nummern, paralleles Ausstellen DESSELBEN Drafts schlägt für den
zweiten Aufruf fehl. Ein partieller Unique-Index auf `number` (WHERE number IS
NOT NULL) sichert die Eindeutigkeit zusätzlich auf DB-Ebene ab.

## E17-06: Storno stellt sofort aus und übernimmt den Empfänger aus dem Original-Snapshot

`cancelInvoice` erzeugt die Gegenrechnung nicht als Draft, sondern stellt sie
in einem Zug aus (eigene Nummer, eigener Snapshot, Status issued): Ein
Storno-Draft, der editierbar wäre, würde die GoBD-Idee unterlaufen. Inhalte:
negierte Einzelpreise bei gleichen Mengen, Intro "Stornorechnung zur Rechnung
R-… vom …", kein Zahlungsziel (due_date NULL). Der EMPFÄNGER kommt aus dem
Snapshot des Originals (nicht aus den Livedaten), denn das Storno gehört
kaufmännisch zum Original; die AUSSTELLER-Stammdaten kommen aus den aktuellen
Settings, weil das Storno ein neues, heute ausgestelltes Dokument ist.
Stornos selbst (total < 0) können nicht erneut storniert werden. Ein
verknüpfter Auftrag wird beim Storno NICHT automatisch verändert – ob der
Auftrag storniert oder erstattet wird, entscheidet der Nutzer im
Auftragsmodul (Tax-Lock-Regeln aus Modul 08 gelten dort ohnehin).

## E17-07: "Als bezahlt markieren" setzt den Auftrag auf completed

Die EÜR-Aggregation (Modul 14, `EUER_INCOME_STATUSES`) zählt nur Aufträge mit
Status `completed`/`shipped` UND `payment_status = paid`. Nur payment_status
zu setzen (wörtliche Spec-Lesart) würde das Akzeptanzkriterium "Umsatz und EÜR
stimmen danach" verfehlen. Deshalb setzt `markInvoicePaid` am verknüpften
Auftrag `payment_status = paid`, `payment_received_date` (falls leer) und –
sofern der Auftrag noch nicht completed/shipped ist – `status = completed`.
Website-Aufträge haben keinen Versandschritt, completed ist der korrekte
Endzustand. Ohne verknüpften Auftrag erzeugt der Hinweis-Dialog auf Wunsch
einen Auftrag (Plattform website, completed/paid, order_date =
Rechnungsdatum); für Storno-Rechnungen (negativer Betrag) wird kein Auftrag
erzeugt, da Aufträge keine negativen Beträge tragen können.

## E17-08: Pflichtangaben-Umfang für Angebote

Die Pflichtangaben aus Spec 2.3 gelten für Rechnungen. Angebote verlangen beim
Ausstellen nur Kunde und mindestens eine Position – ein Angebot ohne
Steuernummer ist rechtlich unkritisch. Die Stammdaten erscheinen natürlich
trotzdem im Layout, sobald sie gepflegt sind.

## E17-10: Kein Print-to-PDF in Tauri 2 ohne Plugin – dokumentierter Fallback für PDF-Weg 2

Tauri 2 (WKWebView/WebView2) bietet ohne Zusatz-Plugin KEINE programmatische
Print-to-PDF-API; `window.print()` öffnet nur den Systemdruckdialog. Die in
der Spec vorgesehene Rückfall-Entscheidung greift daher: KEINE schwere
PDF-Dependency (kein jsPDF/pdf-lib/Drittanbieter-Plugin) ohne Rückfrage.
"In OneDrive ablegen" ist als geführter Systemdruck umgesetzt:

1. Zielordner `/01_Finanzen/Rechnungen_{JJJJ}/` bzw. `Angebote_{JJJJ}/` wird
   angelegt (bestehende Rust-Commands, kein neuer Code)
2. Dialog zeigt erwarteten Dateinamen `{nummer}_{kundenname-slug}.pdf` und
   Zielordner, mit Buttons "Ordner öffnen" und "Druckdialog öffnen"
   (macOS: "Als PDF sichern")
3. "Gespeichert – prüfen" prüft per `check_path_exists`, ob die PDF am
   erwarteten Pfad liegt; wenn ja werden `pdf_path` gesetzt und ein
   `file_link` (entity_type `document`, file_type `beleg`, relativer Pfad)
   angelegt

Damit ist das Akzeptanzkriterium "PDF-Ablage in OneDrive funktioniert oder
dokumentierter Fallback auf Systemdruck" über den Fallback erfüllt. Sollte
später ein offizielles Print-to-PDF-Plugin freigegeben werden, ist nur
Schritt 2 zu ersetzen.

## E17-11: Positionen umsortieren über Pfeil-Buttons statt Drag-and-Drop

Die Spec verlangt "Zeilen hinzufügen/entfernen/umsortieren", ohne die Technik
vorzugeben. Umgesetzt sind Hoch/Runter-Buttons je Zeile statt dnd-kit:
tastaturbedienbar, ohne Autoscroll-Flakiness in den E2E-Tests (bekanntes
Problem der Kanban-Drag-Gesten) und bei typischen Dokumenten mit wenigen
Positionen mindestens gleich schnell.

## E17-12: Live-Vorschau komponiert über denselben Snapshot-Weg

Die Editor-Vorschau eines Drafts baut ihren Anzeige-Snapshot über dieselbe
pure Funktion `composeDocumentSnapshot`, die auch das Ausstellen verwendet
(Nummer als Platzhalter "R-JJJJ-…", Datum = heute). Vorschau und späteres
Dokument können damit nicht auseinanderlaufen. Ausgestellte Dokumente zeigen
ausschließlich den gespeicherten Snapshot – auch in der Vorschau-Spalte.

## E17-09: Variablen-Auflösung beim Ausstellen in den Snapshot

Intro-/Outro-Texte unterstützen die {{variablen}}-Syntax der Registry
(Modul 07). Aufgelöst werden `{{kundenname}}`, `{{projektname}}`,
`{{firmenname}}` und `{{datum}}` (deutsches Format) – beim AUSSTELLEN, in den
Snapshot hinein (Spec 2.2: Snapshot = alle gerenderten Daten). Unbekannte oder
leere Variablen bleiben sichtbar als `{{name}}` stehen, damit Lücken im
Dokument auffallen statt still zu verschwinden. Die Registry wurde additiv um
die Standard-Variable `projektname` ergänzt (Freitext-Quelle), damit
Editor-Seitenleiste und Dokumente dieselbe Variablenliste kennen.
