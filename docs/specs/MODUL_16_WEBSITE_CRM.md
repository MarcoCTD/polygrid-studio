# Modul 16: Website-CRM

PolyGrid Studio Business OS
Anforderungsdokument | Version 1.0 | Juli 2026

## 1. Scope und Ziel

Verwaltung des Website-Geschäfts als zweites Standbein neben dem 3D-Druck: Kunden, Website-Projekte (einmalig), laufende Leistungen (Wartung, Hosting, Domains) und Zugangsdaten, alles auf einer Seite. Einnahmen laufen über die bestehende Auftragsverwaltung (neue Plattform "website"), damit EÜR-Export und Verkaufsstatistik ohne Änderung stimmen (Kleinunternehmer §19 UStG, Bruttobeträge, keine USt). Wiederkehrende Kosten (Hosting, Domains) erzeugen automatisch Ausgaben in Modul 04. Keine Kontakthistorie.

### 1.1 Lieferergebnisse

- Neue Tabellen: clients, website_projects, website_services (eine Migration, nächste freie Nummer, vorher verifizieren)
- Neuer Sidebar-Eintrag "Websites" (Route /websites, Lucide-Icon Globe)
- Plattform "website" in der Auftragsverwaltung (Zod-Enum, Filter, Kanban, Plattformgebühr 0)
- Recurring-Engine: fällige wiederkehrende Posten erzeugen beim App-Start automatisch Ausgaben (Kosten) bzw. Auftrags-Entwürfe (Einnahmen), idempotent
- Zugangsdaten pro Kunde/Projekt: Metadaten in DB, Secret im OS-Keychain
- 3 neue Smart-Action-Regeln (Registry aus Modul 15 erweitern)
- E2E- und Unit-Tests

### 1.2 Abhängigkeiten

Foundation, Aufträge (08), Ausgaben (04), Smart Actions (15), EÜR-Export (14, nur passiv), Keychain-Infrastruktur (06/11).

### 1.3 Explizit NICHT im Scope

- Keine Kontakt-/Kommunikationshistorie, kein E-Mail-Versand
- Keine Rechnungserstellung (nur Auftrags-Entwürfe, Rechnung schreibt der Nutzer extern)
- Keine automatische Domain-Abfrage (WHOIS), Ablaufdaten werden manuell gepflegt
- Keine Zeiterfassung

## 2. Datenmodell

### 2.1 clients

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | |
| name | TEXT | Ja | Firmen- oder Personenname |
| contact_person | TEXT | Nein | |
| email | TEXT | Nein | |
| phone | TEXT | Nein | |
| notes | TEXT | Nein | |
| created_at / updated_at / deleted_at | TEXT (ISO) | | Soft-Delete wie überall |

### 2.2 website_projects

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | |
| client_id | TEXT (FK) | Ja | |
| name | TEXT | Ja | z.B. "Relaunch Malerbetrieb Weber" |
| status | TEXT | Ja | inquiry, quoted, in_progress, review, live, archived |
| price | REAL | Nein | Vereinbarter Projektpreis (brutto) |
| deadline | TEXT (ISO) | Nein | |
| url | TEXT | Nein | Live-URL |
| order_id | TEXT (FK) | Nein | Verknüpfter Auftrag (Einnahme), wird beim Abrechnen gesetzt |
| notes | TEXT | Nein | |
| created_at / updated_at / deleted_at | | | |

### 2.3 website_services (laufende Posten: Hosting, Domain, Wartung)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| id | TEXT (UUID) | Ja | |
| client_id | TEXT (FK) | Ja | |
| project_id | TEXT (FK) | Nein | Optional einem Projekt zugeordnet |
| type | TEXT | Ja | hosting, domain, wartung, sonstiges |
| label | TEXT | Ja | z.B. "malerweber.de" oder "Hetzner Webspace" |
| cost_out | REAL | Nein | Was ICH zahle (erzeugt Ausgabe), brutto |
| cost_out_vendor | TEXT | Nein | Händler für die Ausgabe (z.B. Hetzner) |
| price_in | REAL | Nein | Was der KUNDE zahlt (erzeugt Auftrags-Entwurf), brutto |
| interval | TEXT | Ja | monthly, yearly |
| next_due | TEXT (ISO) | Ja | Nächste Fälligkeit |
| expires_at | TEXT (ISO) | Nein | Ablaufdatum (v.a. Domains) |
| active | BOOLEAN | Ja | Default true |
| notes | TEXT | Nein | |
| created_at / updated_at / deleted_at | | | |

Mindestens eines von cost_out und price_in muss gesetzt sein (Zod-Refinement). Ein Posten kann beides haben (Hosting: ich zahle 5 EUR, Kunde zahlt 15 EUR).

### 2.4 Zugangsdaten

Keine neue Tabelle mit Secrets. Metadaten liegen als JSON-Feld credentials an clients UND website_projects: Array von { id, label, username, url }. Das Passwort/Secret selbst wird über die bestehende Keychain-Infrastruktur gespeichert (Account-Key: polygrid_credential_{id}), analog zu den API-Keys. Löschen eines Eintrags löscht auch den Keychain-Eintrag. Anzeige: maskiert, Auge-Button zum Anzeigen, Kopieren-Button (liest aus Keychain, ohne Anzeige). WICHTIG: Secrets erscheinen niemals in Logs, Exporten oder der DB.

## 3. Recurring-Engine

- Läuft beim App-Start (nach DB-Init), zusätzlich manueller "Jetzt prüfen"-Button auf der Websites-Seite
- Für jeden aktiven Service mit next_due <= heute:
  - cost_out gesetzt: Ausgabe anlegen über den bestehenden Expense-Service (Datum = Fälligkeitstag, Kategorie Software/SaaS, Unterkategorie nach type, vendor = cost_out_vendor, purpose = "{label} {Intervall}", recurring = true)
  - price_in gesetzt: Auftrag anlegen über den bestehenden Order-Service (Plattform website, Status ordered, payment_status pending, sale_price = price_in, Kundenname aus client, notes = "{label}, automatisch erzeugt"). KEIN completed, der Nutzer bestätigt Zahlungseingang manuell, erst dann zählt es in EÜR/Verkaufszahlen
  - next_due um das Intervall weiterschieben. Mehrere verpasste Perioden (App lange nicht gestartet): pro verpasster Periode je ein Posten, maximal 12 nachholen, darüber hinaus Warn-Toast
- Idempotenz: pro Service und Fälligkeitsdatum darf nur einmal erzeugt werden. Absicherung über ein Feld last_generated_until am Service plus Engine-Log analog playbook_runs light: einfacher Eintrag im bestehenden Logging-Muster reicht, keine neue Tabelle
- Fehler bei einem Posten überspringt diesen mit Toast, blockiert nicht die anderen und niemals den App-Start

## 4. UI (Route /websites)

- Kopfbereich: Kennzahlen: aktive Projekte, monatliche wiederkehrende Einnahmen (price_in normalisiert auf Monat), monatliche wiederkehrende Kosten, Saldo
- Tab "Projekte": Tabelle (Kunde, Name, Status-Badge, Preis, Deadline, URL). Detail-Panel mit allen Feldern, Zugangsdaten-Bereich, Button "Abrechnen": erzeugt Auftrag (Plattform website, sale_price = price, Status ordered) und setzt order_id, Button danach deaktiviert mit Link zum Auftrag
- Tab "Kunden": Tabelle (Name, Kontakt, Anzahl Projekte, Anzahl Services). Detail-Panel mit Feldern, Zugangsdaten, Projektliste des Kunden
- Tab "Laufende Posten": Tabelle (Typ-Icon, Label, Kunde, Kosten, Einnahme, Intervall, nächste Fälligkeit, Ablauf, Aktiv-Toggle). Detail-Panel. "Jetzt prüfen"-Button für die Recurring-Engine
- Neues Projekt / Neuer Kunde / Neuer Posten als Command-Palette-Einträge registrieren

## 5. Smart-Action-Regeln (Erweiterung Registry Modul 15)

| ID | Bedingung | Severity | Ziel |
|----|-----------|----------|------|
| domain_expiring | Service type domain, expires_at innerhalb 30 Tagen | warning (danger unter 7 Tagen) | Laufende Posten, gefiltert |
| website_order_unpaid | Auftrag Plattform website, payment_status pending, älter 14 Tage | warning | Kanban gefiltert |
| project_deadline | Projekt in_progress/review, Deadline innerhalb 7 Tagen oder überschritten | warning/danger | Projekte-Tab |

## 6. Akzeptanzkriterien

- Kunde, Projekt und laufender Posten können angelegt, bearbeitet, soft-deleted werden
- "Abrechnen" erzeugt korrekten Auftrag mit Plattform website und verknüpft ihn
- Plattform website erscheint in Auftragsfiltern, Kanban und EÜR-Export (Einnahmen zählen erst bei paid)
- Recurring-Engine erzeugt bei Fälligkeit Ausgabe und/oder Auftrags-Entwurf, exakt einmal pro Periode, auch nach mehrfachem App-Start am selben Tag
- Nachholen verpasster Perioden funktioniert (Test mit next_due 3 Monate zurück, monthly: 3 Posten)
- Zugangsdaten: Secret landet im Keychain, nie in DB/Logs, Kopieren funktioniert, Löschen entfernt Keychain-Eintrag (im E2E-Mock: In-Memory-Keychain wie bei API-Keys)
- Kennzahlen im Kopfbereich rechnen monthly/yearly korrekt auf Monatsbasis um
- Alle 3 Smart-Action-Regeln feuern bei Fixture-Daten und navigieren korrekt gefiltert
- Sidebar-Eintrag, Command-Palette-Einträge, Badge nicht nötig
- Bestehende Tests bleiben grün (Regressionslauf), TypeScript strict, ESLint, Prettier, cargo check grün
