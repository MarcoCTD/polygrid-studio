# Modul 17: Angebote und Rechnungen

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026

## 1. Scope und Ziel

Erstellung von Angeboten und Rechnungen als professionell gestaltete PDF-Dokumente, primär für das Website-Geschäft (Modul 16), nutzbar auch für Direktverkäufe im 3D-Druck. Kleinunternehmer nach §19 UStG: keine Umsatzsteuer, Pflichthinweis auf jeder Rechnung. Dokumente sind nach Ausstellung unveränderbar (GoBD-Gedanke, analog zum Tax-Lock aus Modul 08).

Rechtlicher Rahmen: Die App erzwingt die Pflichtangaben strukturell, ersetzt aber keine steuerliche oder rechtliche Beratung. Dauerhafter Hinweis im Modul: "Lass eine Beispielrechnung von deinem Steuerberater prüfen." Hinweis zur E-Rechnung: Kleinunternehmer sind von der Pflicht zur AUSSTELLUNG von E-Rechnungen befreit (JStG 2024), PDF bleibt zulässig; dieser Hinweis erscheint einmalig als Info-Box in den Dokument-Einstellungen.

### 1.1 Lieferergebnisse

- Neue Tabelle documents (eine Migration, nächste freie Nummer verifizieren)
- Dokumenttypen: Angebot, Rechnung (Gutschrift/Storno als negativer Betrag über neue Rechnung mit Referenz, kein eigener Typ)
- Positionseditor (Beschreibung, Menge, Einzelpreis, Zeilensumme)
- Nummernkreise: Angebote A-JJJJ-NNN, Rechnungen R-JJJJ-NNN, lückenlos, pro Jahr neu startend, gelöschte Nummern werden nie wiedervergeben (Rechnungen sind ohnehin nicht löschbar nach Ausstellung)
- Zwei mitgelieferte Layouts (modern-minimalistisch, klassisch), Farbe folgt der App-Akzentfarbe oder fester Markenfarbe aus den Einstellungen
- PDF-Erzeugung über Druck-Ansicht (HTML/CSS Print-Stylesheet, macOS-Druckdialog "Als PDF sichern"), zusätzlich direkter Export in den OneDrive-Ordner /01_Finanzen/
- Statusfluss und Verknüpfung mit Kunden, Projekten und Aufträgen
- Umwandlung Angebot zu Rechnung per Klick
- Firmen-Stammdaten in den Einstellungen (Adresse, Steuernummer, Bankverbindung, Zahlungsziel)

### 1.2 Abhängigkeiten

Foundation, Website-CRM (Modul 16, Kunden), Aufträge (08, Verknüpfung und Belegnummern-Muster), Vorlagen-Variablen-Registry, Settings (11), Dateimanager (03, PDF-Ablage).

### 1.3 Explizit NICHT im Scope

- Keine E-Rechnung (XRechnung/ZUGFeRD), kein E-Mail-Versand aus der App
- Keine Mahnungen (Smart-Action-Karte reicht, siehe 6)
- Keine USt-Berechnung (Kleinunternehmer, fix)
- Kein Bearbeiten ausgestellter Rechnungen (nur Storno-Rechnung mit Referenz)

## 2. Datenmodell

### 2.1 documents

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | |
| type | TEXT | Ja | quote, invoice |
| number | TEXT | Nein | Vergeben erst bei Ausstellung (A-2026-001 / R-2026-001) |
| status | TEXT | Ja | draft, issued, paid (nur invoice), rejected/accepted (nur quote), cancelled |
| client_id | TEXT (FK) | Ja | |
| project_id | TEXT (FK) | Nein | |
| order_id | TEXT (FK) | Nein | Verknüpfter Auftrag (bei Rechnung aus Abrechnung) |
| related_document_id | TEXT (FK) | Nein | Angebot zu Rechnung, Storno zu Original |
| line_items | TEXT (JSON) | Ja | Array {description, quantity, unit_price} |
| total | REAL | Ja | Berechnet, brutto = netto (Kleinunternehmer) |
| issue_date | TEXT (ISO) | Nein | Gesetzt bei Ausstellung |
| due_date | TEXT (ISO) | Nein | Rechnungen: issue_date + Zahlungsziel aus Settings |
| valid_until | TEXT (ISO) | Nein | Angebote |
| service_date | TEXT | Ja bei invoice | Leistungsdatum oder -zeitraum (Pflichtangabe) |
| intro_text / outro_text | TEXT | Nein | Freitext über/unter den Positionen, Variablen erlaubt |
| layout | TEXT | Ja | modern, classic |
| snapshot | TEXT (JSON) | Nein | Bei Ausstellung: eingefrorene Kopie ALLER gerenderten Daten inkl. Firmen-Stammdaten und Kundenadresse |
| pdf_path | TEXT | Nein | Pfad der exportierten PDF |
| created_at / updated_at / deleted_at | | | Soft-Delete nur für drafts |

### 2.2 Unveränderbarkeit

Beim Wechsel auf issued: Nummer wird gezogen, snapshot wird geschrieben, danach sind alle inhaltlichen Felder gesperrt (UI und Service-Ebene). Die Druck-/PDF-Ansicht rendert IMMER aus dem snapshot, nie aus den Livedaten, damit spätere Änderungen an Kunde oder Stammdaten das Dokument nicht verändern. Ausgestellte Rechnungen sind nicht löschbar, nur stornierbar (neue Rechnung mit negativen Positionen und Referenz, eigener Nummernkreis-Eintrag).

### 2.3 Pflichtangaben-Validierung (Rechnung, vor Ausstellung erzwungen)

Vollständiger Name und Anschrift von Aussteller und Empfänger, Steuernummer ODER USt-IdNr des Ausstellers, Ausstellungsdatum, fortlaufende Nummer, Menge und Art der Leistung, Leistungsdatum/-zeitraum, Entgelt, sowie der Satz: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet." Fehlt etwas, ist der Ausstellen-Button deaktiviert mit Liste der fehlenden Angaben. Kleinbetragsregelung (unter 250 EUR) wird NICHT gesondert behandelt, es gelten immer die vollen Angaben (einfacher und immer zulässig).

## 3. Nummernkreise

Eigener Service analog zur Belegnummern-Generierung aus Modul 08: pro Typ und Jahr fortlaufend, Vergabe transaktional beim Ausstellen (nie bei Draft-Anlage), keine Lücken durch verworfene Drafts, da Drafts keine Nummer haben. Format konfigurierbar NUR über Konstante, nicht über Settings (Stabilität).

## 4. Layouts und PDF

- Zwei Print-Layouts als React-Komponenten mit dediziertem Print-Stylesheet (A4, saubere Ränder, Seitenumbruch bei vielen Positionen, Seite 2 mit Kopfwiederholung)
- Modern: viel Weißraum, Akzentfarblinie, Inter; Klassisch: konservativ, schwarz-weiß
- Logo: optionales Bild aus den Einstellungen (Dateiauswahl, Kopie im App-Datenverzeichnis)
- PDF-Weg 1 (Standard): Druck-Ansicht öffnet Systemdruckdialog, macOS "Als PDF sichern". Keine neue Dependency
- PDF-Weg 2: "In OneDrive ablegen" rendert dieselbe Ansicht und speichert über den Tauri-Druckpfad bzw. Webview-Print-to-PDF nach /01_Finanzen/Rechnungen_{JJJJ}/ bzw. Angebote_{JJJJ}/. Falls Tauri 2 Print-to-PDF ohne Zusatz-Plugin nicht hergibt: Entscheidung dokumentieren und auf Weg 1 plus Hinweis zurückfallen, KEINE schwere PDF-Dependency ohne Rückfrage einführen
- Dateiname: {nummer}_{kundenname-slug}.pdf, Pfad wird in pdf_path gespeichert und als file_link verknüpft

## 5. UI

- Neuer Tab "Dokumente" auf der Websites-Seite (Route /websites, vierter Tab) statt eigenem Sidebar-Eintrag, da primär Website-Geschäft. Zusätzlich Command-Palette: Neues Angebot, Neue Rechnung
- Tabelle: Typ-Badge, Nummer, Kunde, Betrag, Status-Badge, Datum, Fällig/Gültig-bis
- Editor: Kundenauswahl, Positionsliste (Zeilen hinzufügen/entfernen/umsortieren), Summen live, Texte mit Variablen ({{kundenname}}, {{projektname}} über die bestehende Registry), Layout-Umschalter mit Live-Vorschau rechts (Split-View wie Listing-Editor)
- Aktionen je Status: Draft: Bearbeiten, Ausstellen, Löschen. Issued (Angebot): Angenommen/Abgelehnt markieren, In Rechnung umwandeln (übernimmt Positionen, verknüpft related_document_id). Issued (Rechnung): Als bezahlt markieren, Stornieren, PDF erneut öffnen
- "Als bezahlt markieren" bei Rechnung mit verknüpftem Auftrag setzt dessen payment_status auf paid (damit Umsatz/EÜR stimmen); ohne verknüpften Auftrag Hinweis-Dialog mit Option, jetzt einen Auftrag (Plattform website) zu erzeugen
- Aus Modul 16 heraus: "Abrechnen" am Projekt bietet jetzt zusätzlich "Mit Rechnung" an (erzeugt Auftrag UND Rechnungs-Draft mit einer Position aus dem Projektpreis)

## 6. Smart-Action-Regel (Erweiterung)

| ID | Bedingung | Severity | Ziel |
|----|-----------|----------|------|
| invoice_overdue | Rechnung issued, due_date überschritten, nicht paid/cancelled | danger | Dokumente-Tab, gefiltert |

## 7. Settings-Erweiterung (Tab Allgemein, neuer Abschnitt "Rechnungsstellung")

Firmenname (bestehend), Inhabername, Straße, PLZ/Ort, Steuernummer, USt-IdNr (optional), IBAN, BIC, Bank, Zahlungsziel in Tagen (Default 14), Angebots-Gültigkeit in Tagen (Default 30), Logo-Auswahl, Standard-Layout. Info-Box zur E-Rechnungs-Befreiung für Kleinunternehmer.

## 8. Akzeptanzkriterien

- Angebot und Rechnung können als Draft angelegt, bearbeitet und ausgestellt werden
- Ausstellen erzwingt alle Pflichtangaben, zieht die lückenlose Nummer und friert den snapshot ein
- Ausgestellte Dokumente sind inhaltlich unveränderbar und rendern aus dem snapshot
- Rechnung nicht löschbar nach Ausstellung, Storno erzeugt Gegenrechnung mit Referenz
- Angebot zu Rechnung übernimmt Positionen und verknüpft beide
- "Als bezahlt markieren" setzt den verknüpften Auftrag auf paid, Umsatz und EÜR stimmen danach (Test über die bestehende EÜR-Aggregation)
- Beide Layouts rendern korrekt inkl. Seitenumbruch bei 30+ Positionen, §19-Satz steht auf jeder Rechnung
- Nummernkreise: pro Jahr neu, fortlaufend, Drafts verbrauchen keine Nummern, paralleles Ausstellen erzeugt keine Duplikate (Test analog Recurring-Engine-Serialisierung)
- PDF-Ablage in OneDrive funktioniert oder dokumentierter Fallback auf Systemdruck
- Smart-Action invoice_overdue feuert und navigiert gefiltert
- Steuerberater-Hinweis dauerhaft sichtbar im Dokumente-Tab
- Regressionslauf aller bestehenden Tests zweimal grün, TypeScript strict, ESLint, Prettier, cargo check grün
