# Entscheidungsdokument Modul 08: Auftragsverwaltung

PolyGrid Studio Business OS | April 2026

Dieses Dokument hält alle Architektur- und Designentscheidungen fest, die vor der Implementierung von Modul 08 getroffen wurden. Es ist Pflichtlektüre für Codex und ergänzt die Spec `MODUL_08_AUFTRAGSVERWALTUNG.md`.

---

## Kontext

Marco betreibt einen 3D-Druck-Shop auf Etsy und eBay als Einzelunternehmer. Modul 08 wird vor Modul 06 (KI) und Modul 07 (Vorlagen) implementiert, weil das EÜR-Tracking für die Steuererklärung dringend benötigt wird. Modul 08 hängt nur von Foundation und Modul 02 (Produkte) ab — beide sind abgeschlossen.

---

## Geschäftliche Eckdaten

| Punkt                       | Wert                                                |
| --------------------------- | --------------------------------------------------- |
| Unternehmensform            | Einzelunternehmen                                   |
| Steuerstatus                | Kleinunternehmer nach §19 UStG                      |
| USt.-Verarbeitung           | Keine (brutto = netto)                              |
| Buchführung                 | Einnahmen-Überschuss-Rechnung (EÜR)                 |
| Steuerberater-Software      | Keine (selbst gemacht)                              |
| Bestandsbewertung Material  | Sofortaufwand im Kaufmonat (Standard EÜR)           |
| Bankkonto                   | N26 (privat)                                        |
| Plattformen                 | Etsy, eBay (Kleinanzeigen optional)                 |

---

## Entscheidungen

### E1: Status-Modell vereinfachen (10 → 8 Werte)

**Original-Spec:** inquiry, quoted, ordered, paid, in_production, ready, shipped, completed, issue, cancelled (10 Werte)

**Entscheidung:** inquiry, ordered, paid, in_production, shipped, completed, issue, cancelled (8 Werte)

**Begründung:** Einzelunternehmer im B2C-Geschäft macht keine Angebote (`quoted`) und unterscheidet nicht zwischen "fertig" und "versendet" (`ready` vs. `shipped`). Was fertig gepackt ist, geht direkt zur Post.

---

### E2: Kein USt.-Tracking

**Entscheidung:** Felder `tax_amount`, `amount_net`, `vat_rate` werden NICHT aufgenommen. `sale_price` ist immer brutto = netto.

**Begründung:** Kleinunternehmer §19 UStG. Komplexität spart, Fehlerquellen reduziert. Bei späterem Wechsel zur Regelbesteuerung wird das Schema migriert.

**Konsequenz für UI:** Kein USt.-Feld im Auftragsformular, kein USt.-Hinweis in EÜR-Export, dafür Footer-Disclaimer "Kleinunternehmer §19 UStG" in jedem Export.

---

### E3: N26-Anbindung via CSV-Import (keine Live-API)

**Optionen geprüft:**

1. PSD2/FinTS via finAPI/Tink → kostenpflichtig, Banking-Lizenz-Workarounds, komplex
2. CSV-Import aus N26-Web-Banking → manuell, aber zuverlässig
3. Reine manuelle Eingabe → ineffizient bei vielen Aufträgen

**Entscheidung:** Option 2 (CSV-Import) für MVP. Nutzer exportiert monatlich oder quartalsweise CSV aus N26 und importiert sie in PolyGrid. Auto-Matching schlägt Verknüpfungen vor.

**Begründung:** Wartungsarm, kostenfrei, DSGVO-unkritisch, ausreichend für Einzelunternehmen. Live-API kann später als Modul 13 nachgerüstet werden.

---

### E4: Eigener Sidebar-Bereich "Finanzen"

**Optionen geprüft:**

1. EÜR-Export als Button im Auftragsmodul → unsauber, weil Export auch Ausgaben umfasst
2. EÜR-Export im Settings-Tab → versteckt, schlechte UX
3. Eigener Sidebar-Eintrag "Finanzen" → klar, erweiterbar

**Entscheidung:** Option 3 mit drei Tabs: EÜR-Export, Banktransaktionen, Belegübersicht.

**Begründung:** Sauberer mentaler Modell. Alle steuerrelevanten Aufgaben an einem Ort. Erweiterbar für Modul 13 (Banking-API), Modul 14 (Steuerberater-Schnittstelle) etc.

**Sidebar-Position:** Unter "Analysen", über "KI-Assistent". Icon: `Wallet` aus Lucide.

---

### E5: Belegnummern-Format `JAHR-LFD`

**Entscheidung:** `2026-0001`, `2026-0002`, ..., jährlich zurückgesetzt, lückenlos, 4-stellig (erweiterbar auf 5).

**Begründung:** Finanzamt verlangt lückenlose Nummerierung. Format ist menschenlesbar und sortierbar. Jahresreset hält Zahlen kurz.

**Kritische Regel:** Bei Stornierung bleibt die Nummer erhalten. Nummer wird NIE wiederverwendet, auch nicht nach Soft-Delete. Bei Hard-Delete (theoretisch) müsste eine Storno-Buchung als separater Datensatz angelegt werden.

---

### E6: Tax-Lock-Mechanismus

**Problem:** Steuerrelevante Daten dürfen nach Abgabe nicht mehr geändert werden (10 Jahre Aufbewahrung). Soft-Delete reicht nicht, weil auch Editieren gesperrt sein muss.

**Entscheidung:** Boolean-Feld `tax_locked` auf `orders` und `expenses`. Beim EÜR-Export optional aktivierbar. Locked-Datensätze sind:

- Nicht editierbar (Frontend + Backend-Validation)
- Nicht soft-deletable
- Nur stornierbar (Status → cancelled, plus Anlage einer Gegenbuchung als neuer Datensatz)

**UI-Indikator:** Schloss-Icon, ausgegrautes Formular, Hinweis "Steuerlich gesperrt seit YYYY-MM-DD".

**Default beim Export:** Tax-Lock ist beim Jahresexport ON (Checkbox vorausgewählt), beim Monatsexport OFF (Checkbox leer).

---

### E7: Sammelauszahlungs-Erkennung (n:m)

**Problem:** Etsy und eBay zahlen nicht jeden Auftrag einzeln aus, sondern aggregieren wöchentlich oder bei einem Mindestbetrag. Eine Banktransaktion entspricht also oft mehreren Aufträgen.

**Entscheidung:** Junction-Tabelle `bank_payout_orders` mit Feldern `bank_transaction_id`, `order_id`, `allocated_amount`. Erkennung über `counterparty_name` (z.B. "Etsy Ireland") und Summen-Match aller offenen Aufträge im Zeitfenster.

**Begründung:** Reine 1:1-FK reicht nicht aus. Junction-Tabelle ist sauberer als JSON-Array, weil Drizzle native Joins erlaubt.

---

### E8: Confidence-System für Auto-Matching

**Entscheidung:** Vier Stufen (high, medium, low, manual) plus `unmatched`.

| Stufe   | Kriterium                                                          |
| ------- | ------------------------------------------------------------------ |
| high    | Betrag exakt + Kundenname/Plattformname im Verwendungszweck        |
| medium  | Betrag exakt                                                       |
| low     | Betrag ±0,02 € (Rundungsdifferenz)                                 |
| manual  | Vom Nutzer manuell verknüpft                                       |
| unmatched | Kein Match gefunden                                              |

**Auto-Bestätigung:** Bei Confidence `high` wird der Match nicht automatisch übernommen. **Alle Matches müssen vom Nutzer bestätigt werden.** Das ist explizite Designentscheidung, weil Bankdaten finalen Status für die EÜR haben — keine Fehlertoleranz.

---

### E9: Excel-Export mit exceljs

**Entscheidung:** Library `exceljs` für Excel-Generierung. Alternative `xlsx` (SheetJS) wurde nicht gewählt, weil exceljs bessere Formatierungs-API hat (Cell-Styles, Merging, mehrere Sheets) und MIT-Lizenz.

**4 Sheets:** Übersicht, Einnahmen, Ausgaben, Kategorien-Aggregation.

**Format:** .xlsx. Native Excel-Formate werden korrekt erzeugt (Datumstyp, Zahlentyp, Währungsformat).

---

### E10: EÜR-Kategorien-Mapping

**Entscheidung:** Hartcodiertes Mapping zwischen PolyGrid-Kategorien und EÜR-konformen Bezeichnungen (siehe Spec Abschnitt 6.5).

**Begründung:** Vereinfacht den Export. User muss sich nicht um EÜR-Begriffe kümmern. Bei Bedarf (z.B. wenn der Steuerberater andere Bezeichnungen will) kann das Mapping in Settings erweiterbar gemacht werden — aber nicht im MVP.

**Hinweis Maschinen/Hardware:** Bei Anschaffungen über 800 € netto greift AfA (Abschreibung). Das ist für Einzelfälle relevant und wird im Export als Hinweistext markiert, aber NICHT automatisch berechnet. Verantwortung beim Nutzer.

---

### E11: Backfill-Modus für Alt-Aufträge

**Problem:** Beim ersten Einsatz müssen Aufträge aus früheren Monaten/Jahren nachgetragen werden.

**Entscheidung:** Checkbox "Vergangener Auftrag" im Neu-Auftrags-Modal. Bei Aktivierung:

- Datumsvalidierung lockerer (auch weit zurück erlaubt)
- Belegnummer kann manuell überschrieben werden (für historische Konsistenz)
- Status kann beliebig gesetzt werden (auch direkt `completed`)

**Begründung:** Vermeidet Frust beim erstmaligen Befüllen. Nach dem initialen Backfill nicht mehr nötig.

---

### E12: Plattform-Auszahlungs-Logik bei Bank-Match

**Entscheidung:** Bei einer Sammelauszahlung wird `payment_received_date` auf das Bank-Buchungsdatum gesetzt — für ALLE in der Auszahlung enthaltenen Aufträge gleich. Das entspricht dem Zuflussprinzip §11 EStG.

**Wichtig:** Das `order_date` bleibt unverändert. Es ist möglich, dass ein Auftrag ein `order_date` von z.B. 28.12.2025 hat, aber `payment_received_date` von 04.01.2026. Für die EÜR zählt 04.01.2026 (Steuerjahr 2026).

---

### E13: Reihenfolge nach Modul 08

**Entscheidung:**

| Reihenfolge | Modul | Begründung                                                         |
| ----------- | ----- | ------------------------------------------------------------------ |
| Nach 08     | 06    | KI-Architektur erweckt Listing-Editor (Modul 05) zum Leben         |
| Dann        | 09    | Aufgaben-Modul ist Quality-of-Life, hilft im Tagesgeschäft         |
| Dann        | 07    | Vorlagen sind ohne KI-Umformulierung nur halb so wertvoll          |
| Dann        | 10    | Dashboard braucht alle anderen Module als Datenquelle              |
| Dann        | 11    | Settings-Finalisierung                                             |
| Post-MVP    | 12    | Platform Sync (Etsy/eBay APIs)                                     |

---

## Offene Punkte (für später)

- **AfA für Anlagevermögen**: Im aktuellen MVP nicht berechnet. Bei Anschaffungen > 800 € netto wird Hinweis im Export angezeigt.
- **Mehrere Bankkonten**: Aktuell nur N26 berücksichtigt. Bei zukünftigem Geschäftskonto (z.B. Holvi, Qonto) muss CSV-Mapping erweitert werden.
- **Reverse-Charge bei EU-Auslandsbestellungen**: Für Kleinunternehmer irrelevant, solange unter Schwellenwerten. Wird relevant bei Wechsel zur Regelbesteuerung.
- **Echte Live-Banking-API**: Modul 13 (Post-MVP), falls relevant.
- **Kassenbuch-Funktion**: Aktuell nicht geplant, da Online-Geschäft bargeldlos ist.

---

## Abweichungen von der Original-Spec

| Original                                       | Neu                                                            | Grund                                  |
| ---------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| 10 Status-Werte                                | 8 Status-Werte (kein quoted, kein ready)                       | Vereinfachung für Einzelunternehmer    |
| Kein receipt_number                            | receipt_number Pflichtfeld, auto-generiert                     | Finanzamt-Anforderung                  |
| Kein payment_received_date                     | payment_received_date als separates Feld                       | EÜR Zuflussprinzip                     |
| Kein payout_amount                             | payout_amount für Plattform-Netto-Auszahlung                   | Sammelauszahlungs-Tracking             |
| Kein tax_locked                                | tax_locked als Pflichtfeld                                     | 10-Jahres-Aufbewahrungspflicht         |
| Kein bank_transactions                         | Neue Tabelle bank_transactions + import_batches + bank_payout_orders | N26-Bankimport                   |
| EÜR-Export nicht erwähnt                       | Komplettes EÜR-Export-Konzept ergänzt                          | Pflicht für Steuererklärung            |
| Sidebar nur "Aufträge"                         | Zusätzlich "Finanzen"-Bereich                                  | Saubere Trennung Aufgaben vs. Steuer   |

---

## Bestätigung

Diese Entscheidungen sind verbindlich für die Implementierung von Modul 08. Abweichungen müssen vor Umsetzung in einem aktualisierten Entscheidungsdokument dokumentiert werden.

Erstellt: April 2026
Status: Final, freigegeben für Implementierung
