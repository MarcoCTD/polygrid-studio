# Modul 17 Addendum: PolyGrid-Layout und Text-Bausteine

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026 | Erweitert MODUL_17_ANGEBOTE_RECHNUNGEN.md

## 1. Scope und Ziel

Zwei Erweiterungen des Dokumente-Moduls: (1) Ein neues Standard-Layout "polygrid", das dem bestehenden, manuell erstellten Angebots-Design des Nutzers entspricht (Referenz: docs/assets/referenz-angebot.pdf), für Angebote UND Rechnungen. (2) Ein Baustein-System: vorgefertigte Textblöcke (Leistungsumfang, Nicht enthalten, Mitwirkung, Ablauf, Zahlungsbedingungen, Optionales Zusatzangebot, Unterschrift), die pro Dokument per Checkbox an- und abwählbar, editierbar und umsortierbar sind.

## 2. Layout "polygrid" (neues Default-Layout)

Referenzdatei liegt in docs/assets/referenz-angebot.pdf. Aufbau Seite 1:

- Kopf: Logo links (aus Settings), rechts der Dokumenttyp in Großbuchstaben, sehr groß, fett, leicht gesperrt (ANGEBOT / RECHNUNG), darunter rechtsbündig die Metazeilen
- Angebot-Metazeilen: "Datum: TT.MM.JJJJ"
- Rechnung-Metazeilen: "Rechnungsnr.: R-JJJJ-NNN", "Rechnungsdatum: ...", "Leistungsdatum/-zeitraum: ...", "Fällig bis: ..."
- Darunter eine kräftige horizontale Linie in der Markenfarbe (ca. 3px)
- Zwei Spalten: links Label "VON" (Markenfarbe, Versalien, klein, gesperrt), darunter Aussteller fett plus Adresse, E-Mail, Telefon; rechts Label "AN", Empfänger fett, Ansprechpartner, Adresse, E-Mail
- Anrede und Einleitungstext (intro_text, Variablen erlaubt)
- Positionstabelle: Kopfzeile mit dunklem Hintergrund (fast schwarz), weiße Versalien-Beschriftung POS. / BESCHREIBUNG / BETRAG. Positionstitel fett, darunter mehrzeilige Beschreibung in kleinerer, grauer Schrift. Betrag rechtsbündig
- Summenzeile: "Gesamtbetrag (Festpreis)" bzw. "Gesamtbetrag" fett, größer, oben und unten kräftige Linien
- Direkt darunter kursiv, klein: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
- Fußzeile jede Seite: zentriert, klein, grau: Firmenname · Inhaber · E-Mail · Website (aus Settings), darüber feine Linie

Folgeseiten: Bausteine (siehe 3) fließen nach der Summenzeile, mit sauberen Umbrüchen (kein Baustein-Titel allein am Seitenende). Mengen-Spalte: wenn alle Positionen Menge 1 haben, wird die Mengenspalte ausgeblendet (wie in der Referenz); sonst POS. / BESCHREIBUNG / MENGE / EINZELPREIS / BETRAG.

Das bisherige Layout "modern" und "classic" bleiben wählbar, "polygrid" wird neues Default.

## 3. Baustein-System

### 3.1 Datenmodell

Additive Migration: neue Spalte content_blocks (TEXT JSON) an documents. Array geordneter Blöcke: { id, kind, enabled, title, body_type: 'bullets' | 'paragraph', items: string[] | text: string }. Der Snapshot friert content_blocks mit ein (läuft automatisch über composeDocumentSnapshot, verifizieren).

### 3.2 Standard-Bausteine (Konstanten, Texte editierbar pro Dokument)

| kind | Titel | Default bei | Inhalt (Startwert) |
|------|-------|-------------|--------------------|
| included | Im Festpreis enthalten | Angebot: an | Bullet-Liste, frei editierbar |
| excluded | Nicht enthalten (separat möglich) | Angebot: an | Bullet-Liste |
| cooperation | Ihre Mitwirkung | Angebot: an | Bullet-Liste |
| process | Ablauf & Zeitrahmen | Angebot: an | Absatz |
| payment_terms | Zahlungsbedingungen | beide: an | Absatz mit Variablen: {{zahlungsziel_tage}}, {{iban}}, {{bic}}, {{kontoinhaber}} aus den Rechnungsstellungs-Settings |
| optional_offer | Optional, nicht Teil dieses Auftrags | Angebot: aus | Absatz |
| validity_signature | Gültigkeit und Auftragserteilung | Angebot: an, Rechnung: nie | Absatz mit {{gueltig_bis}}, darunter Unterschriftslinien "Ort, Datum" und "Unterschrift {{kundenname}}" |
| custom | Eigener Baustein | aus | Frei, beliebig viele hinzufügbar |

Rechnung: payment_terms ist Standard und enthält Fälligkeit plus Bankverbindung; included/excluded/cooperation sind auch bei Rechnungen wählbar (aus als Default), validity_signature existiert bei Rechnungen nicht.

### 3.3 Standardwerte pro Nutzer

Button "Als meinen Standard speichern" im Editor: speichert die aktuelle Baustein-Konfiguration (inkl. Texte) als Vorbelegung für neue Dokumente des Typs in app_settings (Keys document_default_blocks_quote / _invoice). "Auf Standard zurücksetzen" lädt sie erneut.

### 3.4 Editor-UI

Im bestehenden Split-View-Editor links neuer Abschnitt "Bausteine": Liste mit Checkbox (enabled), Titel, Auf/Ab-Pfeile (Reihenfolge), Aufklappen zum Editieren (Titel, Bullets als dynamische Liste mit Enter-Hinzufügen, Absätze als Textarea). Live-Vorschau rechts aktualisiert sofort. Variablen-Einfügen-Buttons wie gehabt.

### 3.5 Umwandlung Angebot zu Rechnung

Übernimmt Positionen wie bisher, Bausteine werden NICHT übernommen, stattdessen die Rechnungs-Standardwerte geladen (eine Rechnung braucht keine Mitwirkungs-Liste).

## 4. Akzeptanzkriterien

- Layout polygrid entspricht der Referenz: Kopf, Markenfarben-Linie, VON/AN-Spalten, dunkle Tabellenkopfzeile, Summenzeile, §19-Satz kursiv, Fußzeile auf jeder Seite
- Rechnung im selben Stil mit Rechnungsnummer, Leistungsdatum und Fällig-bis im Kopf
- Alle 8 Baustein-Typen an-/abwählbar, editierbar, umsortierbar, Vorschau live
- payment_terms rendert IBAN/BIC/Kontoinhaber/Zahlungsziel aus den Settings über Variablen
- validity_signature erscheint nur bei Angeboten, mit Unterschriftslinien
- "Als Standard speichern" und "Zurücksetzen" funktionieren pro Dokumenttyp
- Snapshot friert Bausteine ein: nachträgliche Änderung der Standard-Bausteine verändert ausgestellte Dokumente nicht (Test)
- Mengenspalte erscheint nur wenn mindestens eine Position Menge > 1 hat
- Seitenumbruch: kein Baustein-Titel verwaist am Seitenende (Print-CSS break-inside/break-after)
- Bestehende Layouts modern/classic funktionieren unverändert, Regressionslauf zweimal grün
- TypeScript strict, ESLint, Prettier, cargo check grün
