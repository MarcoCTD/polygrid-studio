# Modul 12: Platform Sync

PolyGrid Studio Business OS
Anforderungsdokument | Version 0.9 (Stub) | April 2026

> **Status: Stub-Spec**
> Dieses Dokument beschreibt das geplante Modul 12. Es wird erst implementiert, nachdem Module 05 bis 11 abgeschlossen sind. Es dient bereits jetzt als Referenz für das Datenmodell von Modul 05, damit die spätere Anbindung ohne Umbau möglich ist.

---

## 1. Scope und Ziel

Modul 12 implementiert die echte Synchronisation von Listings mit den Plattformen Etsy und eBay. Kleinanzeigen wird NICHT angebunden (keine offizielle API). Das Modul ersetzt die Stub-Buttons aus Modul 05 durch funktionsfähige API-Calls.

### 1.1 Lieferergebnisse (geplant)

- Provider-Pattern analog zur KI-Architektur (Modul 06): `PlatformSyncProvider` Interface
- EtsyProvider (basierend auf Etsy Open API v3)
- EbayProvider (basierend auf eBay Sell Inventory API)
- OAuth 2.0 Flow für beide Plattformen mit Token-Refresh
- Push-Operationen: createListing, updateListing, pauseListing, deleteListing
- Pull-Operationen: getListing, getListings, getOrders (für Auftragserkennung)
- Sync-Konflikt-Behandlung (lokal vs. remote geändert)
- Bestandsabgleich bei stock-Modus
- Sync-Log-Tabelle (jeder API-Call wird protokolliert)
- Settings-Erweiterungen: API-Credentials, Sync-Intervalle, Standardprofile

### 1.2 Abhängigkeiten

- Foundation
- Listing-Verwaltung (Modul 05) für Datenbasis
- Auftragsverwaltung (Modul 08) für Order-Sync
- Settings (Modul 11) für Credentials und Konfiguration
- Modul 03 (Dateimanager) für Bild-Upload zu Plattformen

### 1.3 Explizit NICHT im Scope

- Keine Kleinanzeigen-Anbindung (keine API verfügbar)
- Keine Echtzeit-Bestandssynchronisation (im MVP nur scheduled sync)
- Keine automatische Konfliktauflösung (Konflikte werden dem Nutzer zur Entscheidung vorgelegt)

---

## 2. Architektur (geplant)

### 2.1 Provider-Interface

```typescript
interface PlatformSyncProvider {
  platform: 'etsy' | 'ebay';
  isAuthenticated(): Promise<boolean>;
  authenticate(): Promise<void>; // OAuth-Flow starten
  refreshToken(): Promise<void>;

  pushListing(listing: ResolvedListing): Promise<PushResult>;
  updateListing(listing: ResolvedListing, externalId: string): Promise<PushResult>;
  pauseListing(externalId: string): Promise<void>;
  deleteListing(externalId: string): Promise<void>;
  getListing(externalId: string): Promise<RemoteListing>;

  getOrders(since: Date): Promise<RemoteOrder[]>;
}
```

### 2.2 Etsy-Spezifika

- OAuth 2.0 mit `listings_r`, `listings_w`, `listings_d`, `shops_r`, `transactions_r` Scopes
- Personal Access reicht für 1 Shop (genau dein Fall)
- Endpoint-Basis: `https://openapi.etsy.com/v3/application/`
- Listing-Erstellung in zwei Schritten: createDraftListing → uploadListingImage → updateListing (publish)
- Processing Profiles ersetzen Shipping Profiles ab Q1 2026 (siehe Etsy-Migration-Guide)

### 2.3 eBay-Spezifika

- OAuth 2.0 mit `sell.inventory`, `sell.account` Scopes
- Endpoint-Basis: `https://api.ebay.com/sell/inventory/v1/`
- Workflow: createOrReplaceInventoryItem → createOffer → publishOffer
- Variants als Inventory Item Group (createOrReplaceInventoryItemGroup)
- Business Policies für Payment, Fulfillment, Return müssen vorab in eBay angelegt sein
- Image-Hosting: Bilder via Trading API UploadSiteHostedPictures hochladen, Resultate in createOrReplaceInventoryItem referenzieren

### 2.4 Datenmodell-Erweiterungen

Neue Tabelle: `sync_jobs`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | TEXT (UUID) | Primärschlüssel |
| platform | TEXT | etsy oder ebay |
| operation | TEXT | push, update, pause, delete, pull |
| listing_id | TEXT (FK) | Referenz auf listings.id |
| status | TEXT | pending, success, error |
| request_payload | TEXT (JSON) | Was wurde gesendet |
| response_payload | TEXT (JSON) | Was wurde zurückgegeben |
| error_message | TEXT | Fehlermeldung wenn status=error |
| started_at | TEXT (ISO) | |
| completed_at | TEXT (ISO) | |

Settings-Keys (in app_settings, sensible Daten im OS-Keychain):
- `etsy_oauth_access_token` (Keychain)
- `etsy_oauth_refresh_token` (Keychain)
- `etsy_shop_id`
- `etsy_default_shipping_profile_id`
- `ebay_oauth_access_token` (Keychain)
- `ebay_oauth_refresh_token` (Keychain)
- `ebay_default_fulfillment_policy_id`
- `ebay_default_payment_policy_id`
- `ebay_default_return_policy_id`
- `ebay_inventory_location_key`
- `sync_interval_minutes` (Default: 30)
- `sync_auto_enabled` (Default: false, MVP nur manuell)

---

## 3. UI-Konzept (geplant)

- In Modul 05: Die "Push to Platform"-Buttons werden aktiv. Klick öffnet Diff-View "Was wird gepusht? Was sind die Unterschiede zur aktuellen Plattform-Version?"
- Neue Seite `/sync` mit Sync-Übersicht: alle Listings, ihr Sync-Status pro Plattform, letzte Sync-Zeit, manueller Trigger
- Settings-Erweiterung: OAuth-Verbindung pro Plattform, Default-Profile, Sync-Intervall
- Sync-Log-Viewer (analog KI-Log in Modul 11)

---

## 4. Offene Fragen für die spätere Konkretisierung

- Wie gehen wir mit Bildern um, die schon auf Etsy hochgeladen sind, wenn der Nutzer in PolyGrid die Reihenfolge ändert? (Komplettes Re-Upload vs. delta)
- Was passiert, wenn ein Auftrag direkt auf der Plattform abgeschlossen wird, aber noch kein Sync gelaufen ist? (Auftragsabgleich)
- Wie gehen wir mit Plattform-spezifischen Item Specifics um, die in unserem Master-Modell nicht abgebildet sind? (platform_metadata-Feld)
- Rate-Limits: Etsy hat 10.000 Calls/Tag, eBay variiert. Wie verhindern wir Limits?
- Soll Auto-Sync optional aktivierbar sein (z.B. alle 30 Min) oder nur manuell?

---

## 5. Akzeptanzkriterien (geplant)

- OAuth-Flow für Etsy funktioniert (Token-Persistenz im Keychain)
- OAuth-Flow für eBay funktioniert
- Listing kann von PolyGrid auf Etsy gepusht werden (createDraftListing + Bild-Upload + publishListing)
- Listing kann von PolyGrid auf eBay gepusht werden (createOrReplaceInventoryItem + createOffer + publishOffer)
- Update eines bestehenden Listings funktioniert auf beiden Plattformen
- Sync-Log protokolliert jeden Call
- Token-Refresh funktioniert automatisch bei Ablauf
- Bei Sync-Fehler: sync_status = error, sync_error_message gesetzt, im UI sichtbar

---

## 6. Hinweis

Diese Spec wird vor dem Start von Modul 12 überarbeitet, basierend auf den Erkenntnissen aus Modulen 05–11 und dem dann aktuellen Stand der Plattform-APIs (besonders Etsy ändert sich oft).
