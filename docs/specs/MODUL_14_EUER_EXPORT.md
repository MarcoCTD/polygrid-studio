# Modul 14: EÜR-Jahresexport

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026

## 1. Scope und Ziel

Dieses Modul erstellt einen Jahresexport als Einnahmen-Überschuss-Rechnung (EÜR) für einen Kleinunternehmer nach §19 UStG (keine Umsatzsteuer, Bruttobeträge). Der Export aggregiert Einnahmen aus Aufträgen und Ausgaben aus der Ausgabenverwaltung zu einer Excel-Datei. Zusätzlich wird eine Kleinunternehmergrenzen-Anzeige eingebaut.

Rechtlicher Rahmen: Die App ist keine Steuersoftware. Der Export ist eine Vorbereitung für die Steuererklärung bzw. Übergabe an einen Steuerberater. Der bestehende Disclaimer-Grundsatz aus Modul 04 gilt: dauerhafter Hinweis "Ersetzt keine steuerliche Beratung" auf der Export-Seite und im Excel-Dokument selbst.

### 1.1 Lieferergebnisse

- Neue Seite oder Abschnitt "Steuer-Export" unter Analysen (Route /analytics, eigener Tab) oder Settings-Sicherheit, Entscheidung beim Implementieren dokumentieren
- Jahresauswahl (Dropdown, alle Jahre mit Daten)
- Excel-Export (exceljs) mit vier Sheets: Übersicht, Einnahmen, Ausgaben, Monatsübersicht
- Kleinunternehmergrenzen-Widget (Jahresumsatz vs. 25.000 EUR Vorjahresgrenze / 100.000 EUR laufende Grenze, Stand 2025er Reform)
- Speicherung wahlweise über nativen Speichern-Dialog oder direkt nach /01_Finanzen/Exporte/ im OneDrive-Ordner

### 1.2 Abhängigkeiten

Foundation, Auftragsverwaltung (Modul 08), Ausgabenverwaltung (Modul 04), Dateimanager (Modul 03, für OneDrive-Zielordner, optional), Settings (Firmenname für den Kopf des Dokuments).

### 1.3 Explizit NICHT im Scope

- Keine Anlage-EÜR-Formularzeilen-Zuordnung (ELSTER-Kennziffern)
- Keine Umsatzsteuerberechnung (Kleinunternehmer)
- Keine AfA/Abschreibungslogik. Ausgaben werden im Zahlungsjahr voll ausgewiesen, mit Hinweis im Übersichts-Sheet, dass Anschaffungen über 800 EUR netto ggf. abzuschreiben sind und der Steuerberater das prüfen muss
- Kein PDF-Export (nur Excel)

## 2. Fachliche Regeln

### 2.1 Einnahmen (Zuflussprinzip, pragmatisch angenähert)

- Basis: Aufträge mit Status completed sowie shipped, deren payment_status = paid ist
- Maßgebliches Datum: Zeitpunkt der Statusänderung auf paid aus der Auftrags-Timeline (Modul 08). Falls kein Timeline-Eintrag existiert (Altdaten): order_date als Fallback, im Export in einer Spalte "Datumsquelle" kenntlich gemacht
- Betrag: sale_price * quantity plus vom Kunden gezahlte Versandkosten, sofern shipping_cost als Einnahme erfasst ist. WICHTIG: Beim Implementieren prüfen wie shipping_cost in Modul 08 semantisch verwendet wird (Kosten des Verkäufers vs. vom Käufer gezahlt). Falls unklar: nur sale_price * quantity verwenden und Entscheidung dokumentieren
- Stornierte/refundierte Aufträge (payment_status refunded/disputed) werden ausgewiesen aber nicht summiert (eigener Abschnitt "Nicht enthalten")

### 2.2 Ausgaben

- Alle Ausgaben des Jahres mit tax_relevant = true, nach date
- Gruppierung nach category, Unterkategorien als Detailzeilen
- Bruttobeträge (amount_gross), Kleinunternehmer zieht keine Vorsteuer
- Nicht steuerrelevante Ausgaben in eigenem Abschnitt ausgewiesen, nicht summiert

### 2.3 Überschuss

Überschuss = Summe Einnahmen minus Summe steuerrelevante Ausgaben. Prominent im Übersichts-Sheet.

### 2.4 Kleinunternehmergrenze

Widget auf der Export-Seite und als Dashboard-Karte: laufender Jahresumsatz (Einnahmen-Definition wie 2.1, laufendes Jahr) mit Fortschrittsbalken gegen 25.000 EUR. Ampel: grün unter 80%, gelb 80 bis 100%, rot über 100% mit Hinweis "Grenze überschritten, Steuerberater kontaktieren, Regelbesteuerung droht ab Folgejahr". Werte für die Grenzen als Konstante mit Kommentar (Gesetzesstand 2025), in Settings NICHT konfigurierbar.

## 3. Excel-Struktur (exceljs)

Dateiname: euer_{jahr}_{firmenname-slug}.xlsx

- Sheet "Übersicht": Firmenname, Jahr, Erstellungsdatum, Summen (Einnahmen, Ausgaben je Kategorie aggregiert, Überschuss), Disclaimer-Textblock, Hinweis zu Anschaffungen über 800 EUR
- Sheet "Einnahmen": eine Zeile pro Auftrag: Datum, Datumsquelle, Plattform, Bestellnummer (external_order_id, Fallback interne ID), Produkt, Menge, Betrag. Summenzeile
- Sheet "Ausgaben": eine Zeile pro Ausgabe: Datum, Händler, Kategorie, Unterkategorie, Zweck, Beleg (Ja/Nein), Betrag. Zwischensummen pro Kategorie, Gesamtsumme
- Sheet "Monatsübersicht": 12 Zeilen, Spalten Einnahmen, Ausgaben, Saldo, plus Jahreszeile
- Formatierung: EUR-Zahlenformat, Kopfzeilen fett, Spaltenbreiten sinnvoll, druckbar

## 4. UI

- Jahresauswahl, Vorschau der Summen (Einnahmen, Ausgaben, Überschuss) vor dem Export, damit man Plausibilität sieht bevor die Datei entsteht
- Warnhinweise in der Vorschau: Anzahl Ausgaben ohne Beleg, Anzahl Aufträge ohne Zahlungsdatum (Fallback verwendet), Anzahl completed Aufträge mit payment_status != paid (Dateninkonsistenz)
- Export-Button mit Zielauswahl: Speichern-Dialog oder OneDrive /01_Finanzen/Exporte/
- Toast mit Pfad und Öffnen-Button nach Erfolg

## 5. Akzeptanzkriterien

- Export erzeugt valide xlsx mit allen vier Sheets und korrekten Summen
- Einnahmen nutzen das paid-Timeline-Datum, Fallback order_date wird gekennzeichnet
- Refundierte Aufträge und nicht steuerrelevante Ausgaben sind ausgewiesen aber nicht in den Summen
- Zwischensummen pro Ausgabenkategorie stimmen mit der Ausgaben-Seite überein
- Kleinunternehmergrenzen-Widget zeigt korrekten Jahresumsatz und Ampelfarbe
- Vorschau-Warnungen erscheinen bei fehlenden Belegen und Fallback-Daten
- Disclaimer auf Seite und im Excel vorhanden
- E2E-Tests: Summenlogik mit Fixture-Daten (inkl. refunded, tax_relevant false, Jahresgrenzfälle 31.12./01.01.), Grenzen-Widget-Ampel
- TypeScript strict, ESLint, Prettier, cargo check grün
