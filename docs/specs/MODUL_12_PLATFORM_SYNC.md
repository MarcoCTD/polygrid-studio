# Modul 12: Platform Sync

PolyGrid Studio Business OS | Modulspezifikation | Version 1.0 | Mai 2026

> **Version 1.0** ersetzt die Stub-Spec v0.9. Diese Version ist die vollständige Implementierungsgrundlage.

---

## 1. Scope und Zielsetzung

Modul 12 verbindet PolyGrid Studio mit Etsy und eBay. Die App bleibt Single Source of Truth: Listings werden lokal erstellt und verwaltet, dann auf die Plattformen gepusht. Bestellungen werden von den Plattformen nach PolyGrid importiert (Pull).

**Wird geliefert:**

- OAuth 2.0 Authentifizierung für Etsy und eBay (Authorization Code Grant)
- Push: Listings von PolyGrid auf Etsy/eBay erstellen, aktualisieren, pausieren, löschen
- Pull: Bestellungen von Etsy/eBay nach PolyGrid importieren
- Diff-View vor jedem Push (lokale Version vs. Plattform-Version)
- Sync-Übersicht (`/sync` Route) mit Status-Tabelle und Sync-Log
- Conflict-Resolution-UI für manuelle Konfliktlösung
- Settings-Erweiterung: Plattform-Verbindungen, Default-Profile, Sync-Konfiguration

**Wird NICHT geliefert (MVP):**

- Kleinanzeigen-Anbindung (keine API)
- eBay Inventory Item Groups (Varianten-Gruppierung)
- Etsy Kategorie-Browser (nur Default-Taxonomy-ID)
- Automatischer Sync im Hintergrund (nur UI-vorbereitet)
- Plattform-seitiges Policy/Profile-Management (wird auf Plattform erstellt, in PolyGrid nur referenziert)

**Branch:** `feat/modul-12-platform-sync`

---

## 2. Abhängigkeiten

| Modul | Abhängigkeit | Art |
|-------|-------------|-----|
| 01 Foundation | App Shell, DB-Setup, Settings-Infrastruktur, Command Palette | Pflicht |
| 02 Produkte | Produktdaten für Listing-Enrichment | Pflicht |
| 03 Dateimanager | Bilder aus `file_links` für Upload | Pflicht |
| 05 Listings | Listing-Daten, Master+Overrides-Konzept | Pflicht |
| 06 KI-Architektur | Provider-Pattern als Vorlage, DiffView-Komponente | Pflicht |
| 08 Aufträge | Order-Schema für importierte Bestellungen | Pflicht |
| 11 Settings | Settings-UI (Tab "Plattformen" bereits als Stub vorhanden) | Pflicht |

---

## 3. Datenmodell

### 3.1 Neue Tabelle: `sync_jobs`

Protokolliert jeden einzelnen API-Call an Etsy oder eBay.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| id | TEXT (UUID) | Ja | Primärschlüssel |
| platform | TEXT | Ja | `"etsy"` oder `"ebay"` |
| operation | TEXT | Ja | `"push_listing"`, `"update_listing"`, `"pause_listing"`, `"delete_listing"`, `"upload_image"`, `"pull_orders"`, `"load_policies"`, `"token_refresh"` |
| listing_id | TEXT (FK → listings.id) | Nein | Referenz auf das betroffene Listing (NULL bei Order-Pull oder Token-Refresh) |
| order_id | TEXT (FK → orders.id) | Nein | Referenz auf den importierten Auftrag (NULL bei Listing-Push) |
| direction | TEXT | Ja | `"push"` oder `"pull"` |
| status | TEXT | Ja | `"pending"`, `"running"`, `"success"`, `"error"`, `"retrying"` |
| request_payload | TEXT | Nein | Request-Body (max 10 KB, bei Bildern nur Dateiname) |
| response_payload | TEXT | Nein | Response-Body (max 10 KB) |
| error_message | TEXT | Nein | Fehlermeldung bei status=error |
| http_status_code | INTEGER | Nein | HTTP-Statuscode der Antwort |
| retry_count | INTEGER | Ja | Anzahl Retry-Versuche (Default: 0) |
| started_at | TEXT (ISO) | Ja | Startzeitpunkt des Calls |
| completed_at | TEXT (ISO) | Nein | Abschlusszeitpunkt (NULL wenn noch laufend) |
| created_at | TEXT (ISO) | Ja | Erstellungszeitpunkt |

**Indizes:** `platform`, `operation`, `status`, `listing_id`, `started_at`, `(platform, started_at)` (Composite)

**Hinweis:** `request_payload` und `response_payload` werden auf max 10 KB gekürzt. Bei Bilduploads wird nur der Dateiname gespeichert, nicht der Binärinhalt.

### 3.2 Erweiterung: `listings`

Neue Felder zum bestehenden Listings-Schema:

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| external_id | TEXT | Nein | Plattform-ID des Listings (Etsy Listing-ID oder eBay Inventory Item SKU). NULL wenn nie gepusht. |
| sync_status | TEXT | Ja | `"not_synced"`, `"synced"`, `"pending"`, `"error"`, `"conflict"` (Default: `"not_synced"`) |
| sync_error_message | TEXT | Nein | Letzte Fehlermeldung vom Sync |
| last_synced_at | TEXT (ISO) | Nein | Zeitpunkt des letzten erfolgreichen Syncs |
| platform_metadata | TEXT (JSON) | Nein | Plattform-spezifische Daten (siehe 3.4) |

### 3.3 Erweiterung: `orders`

Neues Feld:

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| external_synced | INTEGER (Boolean) | Ja | `1` wenn über Platform Sync importiert, `0` wenn manuell erstellt (Default: 0) |

### 3.4 Struktur von `platform_metadata` (JSON)

```json
{
  "etsy": {
    "listing_id": 1234567890,
    "state": "active",
    "shop_section_id": null,
    "shipping_profile_id": 12345,
    "return_policy_id": 67890,
    "taxonomy_id": 339,
    "image_ids": [111, 222, 333],
    "who_made": "i_did",
    "when_made": "2020_2026",
    "last_remote_updated_at": "2026-05-01T12:00:00Z"
  },
  "ebay": {
    "inventory_item_sku": "PG-001",
    "offer_id": "98765",
    "marketplace_id": "EBAY_DE",
    "category_id": "183063",
    "image_urls": ["https://i.ebayimg.com/..."],
    "item_aspects": {
      "Marke": ["PolyGrid Studio"],
      "Material": ["PLA"],
      "Farbe": ["Schwarz"]
    },
    "condition": "NEW",
    "fulfillment_policy_id": "123",
    "payment_policy_id": "456",
    "return_policy_id": "789",
    "inventory_item_group_key": null,
    "last_remote_updated_at": "2026-05-01T12:00:00Z"
  }
}
```

### 3.5 Neue Settings-Keys (in `app_settings`)

Siehe DATABASE_SCHEMA.md v1.5, Abschnitt "Platform Sync (Modul 12)".

### 3.6 Keychain-Keys (im OS-Keychain, NICHT in `app_settings`)

| Key | Beschreibung | Gültigkeit |
|-----|-------------|------------|
| `polygrid_etsy_api_key` | Etsy App API Keystring | Dauerhaft |
| `polygrid_etsy_shared_secret` | Etsy Shared Secret | Dauerhaft |
| `polygrid_etsy_access_token` | OAuth 2.0 Access Token | 1 Stunde |
| `polygrid_etsy_refresh_token` | OAuth 2.0 Refresh Token | 90 Tage |
| `polygrid_etsy_token_expires_at` | ISO-Timestamp Ablaufzeit Access Token | Wird bei jedem Refresh aktualisiert |
| `polygrid_ebay_client_id` | eBay App ID / Client ID | Dauerhaft |
| `polygrid_ebay_client_secret` | eBay Cert ID / Client Secret | Dauerhaft |
| `polygrid_ebay_access_token` | OAuth 2.0 User Access Token | 2 Stunden |
| `polygrid_ebay_refresh_token` | OAuth 2.0 Refresh Token | 18 Monate |
| `polygrid_ebay_token_expires_at` | ISO-Timestamp Ablaufzeit Access Token | Wird bei jedem Refresh aktualisiert |

---

## 4. Provider-Pattern Interface

Analog zum KI-Provider-Pattern aus Modul 06. Jede Plattform implementiert dasselbe Interface.

### 4.1 `PlatformSyncProvider` Interface

```typescript
interface PlatformSyncProvider {
  readonly platform: "etsy" | "ebay";

  // Auth
  startOAuthFlow(): Promise<OAuthResult>;
  refreshToken(): Promise<TokenResult>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getConnectionInfo(): Promise<ConnectionInfo | null>;

  // Listing Sync (Push)
  pushListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult>;
  updateListing(listing: ListingWithProduct, images: FileLink[]): Promise<SyncResult>;
  pauseListing(listing: ListingWithProduct): Promise<SyncResult>;
  deleteListing(listing: ListingWithProduct): Promise<SyncResult>;

  // Remote State (für Diff-View)
  fetchRemoteListing(externalId: string): Promise<RemoteListingData | null>;

  // Order Sync (Pull)
  pullOrders(since?: Date): Promise<PullOrdersResult>;

  // Configuration
  loadProfiles(): Promise<PlatformProfiles>;
}
```

### 4.2 Gemeinsame Types

```typescript
interface OAuthResult {
  success: boolean;
  error?: string;
  shopName?: string;       // Etsy: Shop-Name, eBay: Username
  shopId?: string;         // Etsy: Shop-ID, eBay: nicht nötig
}

interface TokenResult {
  success: boolean;
  error?: string;
  expiresAt?: string;      // ISO-Timestamp
}

interface ConnectionInfo {
  platform: "etsy" | "ebay";
  connected: boolean;
  shopName: string;
  connectedSince: string;  // ISO
  tokenExpiresAt: string;  // ISO
}

interface SyncResult {
  success: boolean;
  externalId?: string;     // Plattform-ID des erstellten/aktualisierten Listings
  error?: string;
  syncJobId: string;       // Referenz auf sync_jobs-Eintrag
}

interface RemoteListingData {
  title: string;
  description: string;
  price: number;
  quantity: number;
  status: string;
  images: string[];        // URLs
  platformSpecific: Record<string, unknown>;
  lastUpdatedAt: string;   // ISO
}

interface PullOrdersResult {
  imported: number;
  skipped: number;         // Bereits vorhanden (Duplikat-Check über external_order_id)
  errors: Array<{ externalId: string; error: string }>;
  syncJobId: string;
}

interface PlatformProfiles {
  platform: "etsy" | "ebay";
  profiles: Array<{ id: string; name: string; type: string }>;
}

// Listing-Daten angereichert mit Produktdaten
interface ListingWithProduct {
  listing: Listing;        // Aus Modul 05
  product: Product;        // Aus Modul 02
  overrides: ListingOverrides;
  platformMetadata: PlatformMetadata;
}
```

### 4.3 Sync-Service (Orchestrierung)

Der `SyncService` orchestriert die Provider und verwaltet den Sync-Status:

```typescript
class SyncService {
  // Provider-Registry (analog AI ProviderRegistry)
  registerProvider(provider: PlatformSyncProvider): void;
  getProvider(platform: "etsy" | "ebay"): PlatformSyncProvider;

  // Sync-Operationen (nutzt Provider + schreibt sync_jobs)
  pushListing(listingId: string, platform: "etsy" | "ebay"): Promise<SyncResult>;
  pushAllPending(platform: "etsy" | "ebay"): Promise<BatchSyncResult>;
  pullOrders(platform: "etsy" | "ebay"): Promise<PullOrdersResult>;

  // Diff
  getDiff(listingId: string, platform: "etsy" | "ebay"): Promise<SyncDiff>;

  // Status
  getSyncStatus(listingId: string): SyncStatusInfo;
  getSyncLog(filters?: SyncLogFilters): Promise<SyncJob[]>;
}
```

---

## 5. Etsy-Spezifika

### 5.1 OAuth 2.0 Flow (Authorization Code Grant mit PKCE)

**Schritt-für-Schritt:**

1. Frontend: Nutzer klickt "Mit Etsy verbinden" in Settings
2. Frontend → Tauri Command `start_oauth_server` → `tauri-plugin-oauth` startet localhost-Server auf zufälligem Port
3. Frontend generiert PKCE Code Verifier (S256) + Code Challenge
4. Frontend öffnet System-Browser mit Etsy Authorization URL:
   ```
   https://www.etsy.com/oauth/connect
     ?response_type=code
     &client_id={api_key}
     &redirect_uri=http://localhost:{port}/callback
     &scope=listings_r+listings_w+listings_d+shops_r+transactions_r
     &state={random_state}
     &code_challenge={challenge}
     &code_challenge_method=S256
   ```
5. Nutzer autorisiert in Etsy (Browser)
6. Etsy redirected auf `http://localhost:{port}/callback?code={auth_code}&state={state}`
7. `tauri-plugin-oauth` fängt den Redirect ab und liefert den Code ans Frontend
8. Frontend → Tauri Command `stop_oauth_server`
9. Frontend tauscht den Code gegen Tokens ein (POST an Etsy Token-Endpoint):
   ```
   POST https://api.etsy.com/v3/public/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &client_id={api_key}
   &redirect_uri=http://localhost:{port}/callback
   &code={auth_code}
   &code_verifier={code_verifier}
   ```
10. Access Token + Refresh Token werden im OS-Keychain gespeichert
11. Frontend ruft `getShop()` auf → Shop-ID wird in `app_settings.etsy_shop_id` gespeichert

**Scopes:** `listings_r listings_w listings_d shops_r transactions_r`

**Token-Refresh:**
```
POST https://api.etsy.com/v3/public/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id={api_key}
&refresh_token={refresh_token}
```

### 5.2 Listing-Push-Workflow (Etsy)

```
1. createDraftListing (POST /v3/application/shops/{shop_id}/listings)
   → Pflichtfelder: title, description, price, quantity, taxonomy_id,
     who_made, when_made, is_supply=false, shipping_profile_id
   → Ergebnis: listing_id

2. uploadListingImage (POST /v3/application/shops/{shop_id}/listings/{listing_id}/images)
   → Für jedes Bild: multipart/form-data mit image-Datei + rank (1-10)
   → Reihenfolge aus file_links (sort_order)
   → Bild-IDs in platform_metadata.etsy.image_ids speichern

3. updateListing state=active (PUT /v3/application/shops/{shop_id}/listings/{listing_id})
   → state: "active"
   → Listing ist jetzt live
```

**Feld-Mapping PolyGrid → Etsy:**

| PolyGrid-Feld | Etsy-Feld | Quelle |
|----------------|-----------|--------|
| listing.title (Override oder Master) | title | Listing (mit Override-Logik) |
| listing.description (Override oder Master) | description | Listing (mit Override-Logik) |
| listing.price_override oder product.sale_price | price | Listing/Produkt |
| listing.quantity_override oder 999 | quantity | Listing (Default: 999 für Made-to-Order) |
| Settings etsy_default_taxonomy_id oder platform_metadata.etsy.taxonomy_id | taxonomy_id | Settings/Metadata |
| Settings etsy_who_made | who_made | Settings |
| Settings etsy_when_made | when_made | Settings |
| `false` (immer) | is_supply | Hardcoded |
| Settings etsy_default_shipping_profile_id oder platform_metadata.etsy.shipping_profile_id | shipping_profile_id | Settings/Metadata |
| Settings etsy_default_return_policy_id oder platform_metadata.etsy.return_policy_id | return_policy_id | Settings/Metadata |
| product.tags (kommasepariert) | tags | Produkt (max 13 Tags bei Etsy) |

### 5.3 Listing-Update-Workflow (Etsy)

```
1. updateListing (PUT /v3/application/shops/{shop_id}/listings/{listing_id})
   → Alle geänderten Felder

2. Falls Bilder geändert:
   a. deleteListingImage für alle bestehenden Bilder (IDs aus platform_metadata)
   b. uploadListingImage für alle aktuellen Bilder (kompletter Re-Upload, siehe E04)
   c. Neue Bild-IDs in platform_metadata speichern
```

### 5.4 Bestellungsimport (Etsy)

```
GET /v3/application/shops/{shop_id}/receipts
  ?was_paid=true
  &min_created={since_timestamp}
  &limit=25
  &offset=0
```

**Mapping Etsy Receipt → PolyGrid Order:**

| Etsy-Feld | PolyGrid-Feld |
|-----------|--------------|
| receipt_id | external_order_id (in notes oder platform-spezifisches Feld) |
| name (Käufername) | customer_name |
| buyer_email | customer_email (falls verfügbar) |
| transactions[0].title | Verknüpfung zu Listing via Etsy listing_id → lokale external_id |
| grandtotal.amount / grandtotal.divisor | total_amount |
| transactions[0].price.amount / divisor | item_price |
| transactions[0].shipping_cost.amount / divisor | shipping_cost |
| create_timestamp | order_date |
| status | status-Mapping: "paid" → "confirmed", "completed" → "shipped" |
| formatted_address | shipping_address (in notes) |

**Duplikat-Check:** Vor dem Import wird geprüft, ob ein Order mit `notes LIKE '%receipt_id:{etsy_receipt_id}%'` bereits existiert. Falls ja, wird der Import übersprungen.

### 5.5 Processing Profiles laden

```
GET /v3/application/shops/{shop_id}/shipping-profiles
```

Liefert Liste von Shipping/Processing Profiles. Wird in Settings als Dropdown angeboten.

---

## 6. eBay-Spezifika

### 6.1 OAuth 2.0 Flow (Authorization Code Grant)

**Voraussetzung:** RuName (Redirect URL Name) muss im eBay Developer Portal konfiguriert sein. Accept-URL: `http://localhost:{port}/callback`.

**Schritt-für-Schritt:**

1. Frontend: Nutzer klickt "Mit eBay verbinden" in Settings
2. Frontend → Tauri Command `start_oauth_server`
3. Frontend öffnet System-Browser mit eBay Authorization URL:
   ```
   https://auth.ebay.com/oauth2/authorize
     ?client_id={client_id}
     &response_type=code
     &redirect_uri={runame}
     &scope=https://api.ebay.com/oauth/api_scope
            https://api.ebay.com/oauth/api_scope/sell.inventory
            https://api.ebay.com/oauth/api_scope/sell.fulfillment
            https://api.ebay.com/oauth/api_scope/sell.account
     &state={random_state}
   ```
   **Hinweis:** eBay nutzt KEIN PKCE. State-Parameter für CSRF-Schutz.
4. Nutzer autorisiert in eBay (Browser)
5. eBay redirected auf die Accept-URL → localhost fängt ab
6. Frontend → Tauri Command `stop_oauth_server`
7. Token Exchange:
   ```
   POST https://api.ebay.com/identity/v1/oauth2/token
   Content-Type: application/x-www-form-urlencoded
   Authorization: Basic {base64(client_id:client_secret)}

   grant_type=authorization_code
   &code={auth_code}
   &redirect_uri={runame}
   ```
8. Access Token + Refresh Token im Keychain speichern

**Scopes:**
- `https://api.ebay.com/oauth/api_scope` (Basis)
- `https://api.ebay.com/oauth/api_scope/sell.inventory` (Inventory API)
- `https://api.ebay.com/oauth/api_scope/sell.fulfillment` (Orders)
- `https://api.ebay.com/oauth/api_scope/sell.account` (Policies)

**Token-Refresh:**
```
POST https://api.ebay.com/identity/v1/oauth2/token
Authorization: Basic {base64(client_id:client_secret)}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
```

### 6.2 Listing-Push-Workflow (eBay)

```
1. Bild-Upload via Trading API (XML)
   POST https://api.ebay.com/ws/api.dll
   Headers: X-EBAY-API-CALL-NAME=UploadSiteHostedPictures
            X-EBAY-API-SITEID=77 (Deutschland)
   Body (XML):
   <?xml version="1.0" encoding="utf-8"?>
   <UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
     <RequesterCredentials>
       <eBayAuthToken>{access_token}</eBayAuthToken>
     </RequesterCredentials>
     <PictureName>{filename}</PictureName>
   </UploadSiteHostedPicturesRequest>
   + Multipart: Bild-Binärdaten

   → Response enthält FullURL → speichern in platform_metadata.ebay.image_urls

2. createOrReplaceInventoryItem (PUT /sell/inventory/v1/inventory_item/{sku})
   Content-Type: application/json
   {
     "availability": {
       "shipToLocationAvailability": {
         "quantity": 999
       }
     },
     "condition": "NEW",
     "product": {
       "title": "...",
       "description": "...",
       "imageUrls": ["https://i.ebayimg.com/..."],
       "aspects": {
         "Marke": ["PolyGrid Studio"],
         "Material": ["PLA"]
       }
     }
   }

3. createOffer (POST /sell/inventory/v1/offer)
   {
     "sku": "PG-001",
     "marketplaceId": "EBAY_DE",
     "format": "FIXED_PRICE",
     "listingDescription": "...",
     "pricingSummary": {
       "price": { "value": "29.99", "currency": "EUR" }
     },
     "listingPolicies": {
       "fulfillmentPolicyId": "...",
       "paymentPolicyId": "...",
       "returnPolicyId": "..."
     },
     "categoryId": "183063",
     "merchantLocationKey": "..."
   }
   → Response enthält offerId

4. publishOffer (POST /sell/inventory/v1/offer/{offerId}/publish)
   → Listing ist jetzt live
   → Response enthält listingId (eBay Item-ID)
```

**Feld-Mapping PolyGrid → eBay:**

| PolyGrid-Feld | eBay-Feld | Hinweis |
|----------------|-----------|---------|
| product.sku oder listing.id (Prefix "PG-") | SKU | Eindeutig pro Inventory Item |
| listing.title | product.title | Im Inventory Item |
| listing.description | listingDescription | Im Offer (kann HTML sein) |
| listing.price_override oder product.sale_price | pricingSummary.price.value | String mit 2 Dezimalstellen |
| listing.quantity_override oder 999 | availability.quantity | Default 999 |
| `"NEW"` | condition | Hardcoded für 3D-Druck |
| platform_metadata.ebay.item_aspects | product.aspects | JSON-Objekt |
| Settings ebay_default_fulfillment_policy_id | fulfillmentPolicyId | Im Offer |
| Settings ebay_default_payment_policy_id | paymentPolicyId | Im Offer |
| Settings ebay_default_return_policy_id | returnPolicyId | Im Offer |
| Settings ebay_default_category_id | categoryId | Im Offer |
| Settings ebay_marketplace_id | marketplaceId | Default: EBAY_DE |
| Settings ebay_inventory_location_key | merchantLocationKey | Im Offer |

### 6.3 Listing-Update-Workflow (eBay)

```
1. Falls Bilder geändert:
   → UploadSiteHostedPictures für neue Bilder
   → Neue URLs in platform_metadata speichern

2. createOrReplaceInventoryItem (PUT, vollständiger Replace)
   → Alle Felder werden gesendet, auch unveränderte

3. updateOffer (PUT /sell/inventory/v1/offer/{offerId})
   → Preis, Beschreibung, Policies aktualisieren
```

### 6.4 Listing pausieren/löschen (eBay)

```
Pausieren:
  POST /sell/inventory/v1/offer/{offerId}/withdraw
  → Offer wird zurückgezogen, Listing deaktiviert

Löschen:
  DELETE /sell/inventory/v1/offer/{offerId}
  DELETE /sell/inventory/v1/inventory_item/{sku}
```

### 6.5 Bestellungsimport (eBay)

```
GET /sell/fulfillment/v1/order
  ?filter=creationdate:[{since}..] AND orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}
  &limit=50
  &offset=0
```

**Mapping eBay Order → PolyGrid Order:**

| eBay-Feld | PolyGrid-Feld |
|-----------|--------------|
| orderId | external_order_id (in notes) |
| buyer.username | customer_name |
| buyer.buyerRegistrationAddress.email | customer_email |
| lineItems[0].title | Verknüpfung via SKU → lokales Produkt |
| pricingSummary.total.value | total_amount |
| lineItems[0].lineItemCost.value | item_price |
| lineItems[0].deliveryCost.shippingCost.value | shipping_cost |
| creationDate | order_date |
| orderFulfillmentStatus | status-Mapping: "NOT_STARTED" → "confirmed", "IN_PROGRESS" → "shipped" |
| fulfillmentStartInstructions[0].shippingStep.shipTo | shipping_address (in notes) |

**Duplikat-Check:** Analog zu Etsy über `notes LIKE '%order_id:{ebay_order_id}%'`.

### 6.6 Business Policies laden

```
GET /sell/account/v1/fulfillment_policy?marketplace_id=EBAY_DE
GET /sell/account/v1/payment_policy?marketplace_id=EBAY_DE
GET /sell/account/v1/return_policy?marketplace_id=EBAY_DE
```

Liefert jeweils Liste der Policies. Werden in Settings als Dropdowns angeboten.

---

## 7. Shared Infrastructure

### 7.1 Token-Management-Service

```typescript
class TokenManager {
  // Liest Token + Ablaufzeit aus Keychain
  async getValidToken(platform: "etsy" | "ebay"): Promise<string>;

  // Prüft ob Token noch > 5 Min gültig, sonst Refresh
  async ensureFreshToken(platform: "etsy" | "ebay"): Promise<string>;

  // Speichert neuen Token + Ablaufzeit im Keychain
  async storeToken(platform: "etsy" | "ebay", accessToken: string, refreshToken: string, expiresIn: number): Promise<void>;

  // Löscht alle Tokens einer Plattform (Disconnect)
  async clearTokens(platform: "etsy" | "ebay"): Promise<void>;

  // Prüft ob ein gültiger Token vorhanden ist
  async hasValidToken(platform: "etsy" | "ebay"): Promise<boolean>;
}
```

### 7.2 Rate-Limiter

```typescript
class RateLimiter {
  constructor(config: { maxPerSecond: number; platform: string });

  // Wartet bis ein Call möglich ist (Token-Bucket)
  async acquire(): Promise<void>;

  // Exponential Backoff bei 429
  async handleRateLimit(retryCount: number): Promise<void>;
}
```

**Konfiguration:**
- Etsy: 10 Calls/Sekunde
- eBay: 5000 Calls/Tag (vereinfacht: ~3 Calls/Sekunde)

**Backoff:** 1s → 2s → 4s → 8s → 16s → 30s (max), maximal 3 Retries

### 7.3 HTTP-Client-Wrapper

```typescript
class PlatformHttpClient {
  constructor(
    private tokenManager: TokenManager,
    private rateLimiter: RateLimiter,
    private platform: "etsy" | "ebay"
  );

  // GET/POST/PUT/DELETE mit automatischem Token, Rate-Limiting, Logging
  async request<T>(config: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    listingId?: string;   // Für sync_jobs-Logging
    operation?: string;   // Für sync_jobs-Logging
  }): Promise<PlatformResponse<T>>;
}
```

Der HTTP-Client:
1. Ruft `tokenManager.ensureFreshToken()` auf
2. Prüft Rate-Limit via `rateLimiter.acquire()`
3. Erstellt einen `sync_jobs`-Eintrag mit status=running
4. Führt den HTTP-Call aus
5. Bei 401: `tokenManager.refreshToken()` → Retry
6. Bei 429: `rateLimiter.handleRateLimit()` → Retry (max 3x)
7. Aktualisiert `sync_jobs`-Eintrag mit Ergebnis

---

## 8. UI-Spezifikation

### 8.1 Neue Route: `/sync`

**Layout:** Full-page mit Tab-Navigation (analog `/orders` oder `/tasks`)

**Tab 1: Sync-Übersicht**

Tabelle (TanStack Table) mit allen Listings die eine Plattform-Zuordnung haben:

| Spalte | Beschreibung |
|--------|-------------|
| Produktname | Link zum Listing |
| Plattform | Badge: "Etsy" / "eBay" / beide |
| Sync-Status | Badge: not_synced (grau), synced (grün), pending (gelb), error (rot), conflict (orange) |
| Letzte Synchronisierung | Relative Zeit ("vor 2 Stunden") |
| Aktionen | Buttons: "Push", "Details", "Diff anzeigen" |

**Toolbar:**
- Filter: Plattform (Etsy/eBay/Alle), Status (Alle/Fehler/Konflikte)
- "Alle Änderungen pushen" Button (Batch-Push aller pending/error Listings)
- "Bestellungen importieren" Dropdown: Etsy / eBay (Einzelbuttons)

**Tab 2: Sync-Log**

Tabelle der letzten 50 `sync_jobs` Einträge:

| Spalte | Beschreibung |
|--------|-------------|
| Zeitpunkt | started_at |
| Plattform | Badge |
| Operation | push_listing, pull_orders, etc. |
| Status | success (grün), error (rot), retrying (gelb) |
| Listing/Auftrag | Link zum betroffenen Eintrag |
| Dauer | completed_at minus started_at |
| Details | Expandable: request/response Payload, Fehlermeldung |

### 8.2 Diff-View (vor Push)

Wird als Dialog/Modal angezeigt. Nutzt die bestehende DiffView-Komponente aus Modul 06 (KI-Architektur).

**Inhalt:**
- Linke Spalte: "Lokal (PolyGrid)" mit allen Feldern die gepusht werden
- Rechte Spalte: "Plattform (Etsy/eBay)" mit den aktuellen Remote-Daten
- Geänderte Felder werden farblich hervorgehoben (grün = neu, gelb = geändert, rot = entfernt)
- Bilder: Thumbnail-Vorschau lokal vs. remote

**Aktionen:**
- "Push bestätigen" → Führt den Push aus
- "Abbrechen" → Zurück zur Übersicht
- Checkboxen pro Feld → Einzelne Felder vom Push ausschließen (nur bei Update)

### 8.3 Conflict-Resolution-Dialog

Wird angezeigt bei sync_status=conflict:

- Zeigt Diff-View (lokal vs. remote)
- Aktionen:
  - "Meine Version pushen" → Überschreibt Remote
  - "Plattform-Version übernehmen" → Überschreibt lokale Daten
  - "Ignorieren" → Setzt sync_status zurück auf synced

### 8.4 Erweiterungen bestehender Module

**Modul 05 (Listing-Editor):**
- Neue Buttons im Listing-Editor Header: "Push to Etsy" / "Push to eBay"
  - Ersetzen die bisherigen Stub-Buttons
  - Deaktiviert wenn nicht verbunden oder Status=draft
  - Klick öffnet Diff-View → Push
- Sync-Status-Badge neben dem Listing-Titel
- Neuer Tab/Abschnitt "eBay-Details" im Listing-Editor:
  - Item Specifics bearbeiten (Key-Value-Paare)
  - Anzeige der aktuellen eBay-Kategorie
  - Override für eBay-spezifische Felder

**Modul 08 (Aufträge):**
- Importierte Aufträge in der Kanban-Ansicht: Badge "Extern importiert" (blau)
- `external_synced` wird angezeigt im Auftragsdetail

**Modul 01 (Sidebar):**
- Badge-Counter für Sync-Fehler (Anzahl Listings mit sync_status=error)
- Wird im Sidebar-Link "Sync" angezeigt

**Modul 01 (Command Palette):**
- Neue Commands: "Sync starten" (öffnet /sync), "Bestellungen importieren" (öffnet Pull-Dialog)

---

## 9. Settings-Erweiterungen (in Modul 11)

Tab "Plattformen" (bereits als Stub in Modul 11 vorhanden) wird vollständig implementiert:

### 9.1 Etsy-Sektion

| Element | Typ | Beschreibung |
|---------|-----|-------------|
| Verbindungsstatus | Badge + Text | "Verbunden als {shop_name}" (grün) oder "Nicht verbunden" (grau) |
| API Key | Password-Input | Etsy API Keystring (wird im Keychain gespeichert) |
| Shared Secret | Password-Input | Etsy Shared Secret (wird im Keychain gespeichert) |
| "Mit Etsy verbinden" | Button | Startet OAuth-Flow |
| "Verbindung trennen" | Button (nur wenn verbunden) | Löscht Tokens aus Keychain |
| Shipping Profile | Dropdown (+ "Profile laden" Button) | Default Shipping/Processing Profile |
| Return Policy | Dropdown (+ "Policies laden" Button) | Default Return Policy |
| Default Taxonomy-ID | Number-Input | Etsy Kategorie-ID |
| who_made | Select | "i_did" / "someone_else" / "collective" |
| when_made | Select | Etsy when_made Optionen |

### 9.2 eBay-Sektion

| Element | Typ | Beschreibung |
|---------|-----|-------------|
| Verbindungsstatus | Badge + Text | "Verbunden als {username}" (grün) oder "Nicht verbunden" (grau) |
| Client ID | Password-Input | eBay App ID (Keychain) |
| Client Secret | Password-Input | eBay Cert ID (Keychain) |
| "Mit eBay verbinden" | Button | Startet OAuth-Flow |
| "Verbindung trennen" | Button | Löscht Tokens |
| Marketplace | Select | EBAY_DE (Default), EBAY_AT, EBAY_CH |
| Inventory Location | Text-Input | Location Key |
| Fulfillment Policy | Dropdown (+ "Policies laden") | Default |
| Payment Policy | Dropdown (+ "Policies laden") | Default |
| Return Policy | Dropdown (+ "Policies laden") | Default |
| Default Kategorie | Text-Input | eBay Kategorie-ID |

### 9.3 Sync-Sektion

| Element | Typ | Beschreibung |
|---------|-----|-------------|
| Sync-Intervall | Number-Input | Minuten (Default: 30, nur relevant wenn Auto-Sync aktiv) |
| Auto-Sync | Toggle | Default: aus (MVP) |
| Automatischer Order-Import | Toggle | Default: aus (MVP) |

---

## 10. Tauri-Commands (Rust-Backend)

Neue Commands die im Rust-Backend implementiert werden müssen:

| Command | Parameter | Rückgabe | Beschreibung |
|---------|-----------|----------|-------------|
| `start_oauth_server` | keine | `{ port: number }` | Startet localhost-Server via tauri-plugin-oauth, gibt den Port zurück |
| `stop_oauth_server` | keine | `void` | Stoppt den OAuth-Server |
| `get_keychain_value` | `key: string` | `string \| null` | Liest Wert aus OS-Keychain |
| `set_keychain_value` | `key: string, value: string` | `void` | Schreibt Wert in OS-Keychain |
| `delete_keychain_value` | `key: string` | `void` | Löscht Wert aus OS-Keychain |
| `read_file_binary` | `path: string` | `number[]` (Bytes) | Liest eine Datei als Binärdaten (für Bild-Upload) |
| `open_external_url` | `url: string` | `void` | Öffnet URL im System-Browser (für OAuth) |

**Hinweis:** `get_keychain_value`, `set_keychain_value` und `delete_keychain_value` existieren möglicherweise bereits aus Modul 06/11 (KI-Provider Keychain-Integration). In dem Fall werden die bestehenden Commands wiederverwendet, nicht dupliziert. Die Namensgebung muss vor der Implementierung geprüft werden.

---

## 11. Akzeptanzkriterien

### 11.1 OAuth

- [ ] Etsy OAuth-Flow: Nutzer kann sich über System-Browser authentifizieren, Tokens werden im Keychain gespeichert
- [ ] eBay OAuth-Flow: Analog zu Etsy
- [ ] Token-Refresh: Abgelaufene Tokens werden automatisch erneuert (proaktiv, 5-Min-Puffer)
- [ ] Disconnect: Tokens werden aus Keychain gelöscht, Verbindungsstatus aktualisiert
- [ ] Bei fehlendem Token wird der Nutzer zur Re-Authentifizierung aufgefordert

### 11.2 Listing Push

- [ ] Ein Listing kann auf Etsy gepusht werden (Draft → Bilder → Active)
- [ ] Ein Listing kann auf eBay gepusht werden (Bilder → Inventory Item → Offer → Publish)
- [ ] Vor jedem Push wird ein Diff-View angezeigt
- [ ] Bereits gepushte Listings können aktualisiert werden (inkl. Bilder)
- [ ] Listings können pausiert werden (Etsy: inactive, eBay: withdrawOffer)
- [ ] Listings können gelöscht werden (mit Bestätigung)
- [ ] Batch-Push: Alle geänderten Listings auf einmal pushen
- [ ] Push nur möglich wenn Status ≠ draft und Pflichtfelder gesetzt sind

### 11.3 Order Pull

- [ ] Bestellungen von Etsy können manuell importiert werden
- [ ] Bestellungen von eBay können manuell importiert werden
- [ ] Duplikate werden über external_order_id erkannt und übersprungen
- [ ] Importierte Aufträge werden als external_synced=true markiert
- [ ] Importierte Aufträge erscheinen in der Kanban-Ansicht mit Badge

### 11.4 Sync-UI

- [ ] `/sync` Route zeigt Sync-Übersicht mit Listing-Tabelle
- [ ] Sync-Log zeigt die letzten 50 API-Calls mit Details
- [ ] Sync-Status-Badges sind in der Listing-Liste sichtbar
- [ ] Conflict-Resolution-Dialog funktioniert
- [ ] Sidebar zeigt Badge-Counter für Sync-Fehler

### 11.5 Settings

- [ ] Etsy-Verbindung: API-Key eingeben, OAuth-Flow, Profile laden
- [ ] eBay-Verbindung: Client-ID eingeben, OAuth-Flow, Policies laden
- [ ] Default-Profile/Policies können per Dropdown gewählt werden
- [ ] Sync-Intervall und Auto-Sync-Toggle funktionieren (Auto-Sync nur UI-vorbereitet)

### 11.6 Fehlerbehandlung

- [ ] Rate-Limit-Fehler (429) werden mit Exponential Backoff behandelt
- [ ] Netzwerkfehler werden abgefangen und in sync_jobs protokolliert
- [ ] Fehlermeldungen sind verständlich und werden in der UI angezeigt
- [ ] Retry-Button bei sync_status=error funktioniert
- [ ] Alle API-Calls haben try/catch

---

## 12. Sub-Session-Aufteilung

### Sub-Session A: Foundation (Backend-Infrastruktur)

**Liefert:** Alle Backend-Bausteine die Etsy- und eBay-Provider brauchen.

**Scope:**
- `tauri-plugin-oauth` installieren und konfigurieren (Cargo.toml + tauri.conf.json)
- `PlatformSyncProvider` Interface definieren (TypeScript)
- `sync_jobs` Tabelle: Drizzle-Schema, Migration, Service-Layer (CRUD + Query-Helpers)
- `listings` Schema erweitern: `external_id`, `sync_status`, `sync_error_message`, `last_synced_at`, `platform_metadata`
- `orders` Schema erweitern: `external_synced`
- `TokenManager` Klasse: Keychain lesen/schreiben, Ablaufzeit-Tracking, Refresh-Logik
- `RateLimiter` Klasse: Token-Bucket pro Plattform, Exponential Backoff
- `PlatformHttpClient` Klasse: Zentraler Fetch mit Token-Injection, Rate-Limiting, sync_jobs-Logging
- `SyncService` Grundstruktur (Provider-Registry, Orchestrierung)
- Settings-Keys anlegen (Platform Sync Defaults)
- Neue Tauri-Commands: `start_oauth_server`, `stop_oauth_server`, Keychain-Commands prüfen/erweitern, `read_file_binary`, `open_external_url`

**Ordnerstruktur:**
```
src/features/platform-sync/
  providers/
    types.ts              (PlatformSyncProvider Interface + gemeinsame Types)
    registry.ts           (Provider-Registry)
  services/
    sync-service.ts       (SyncService Orchestrierung)
    token-manager.ts      (TokenManager)
    rate-limiter.ts       (RateLimiter)
    platform-http-client.ts (HTTP-Client-Wrapper)
    sync-jobs-service.ts  (sync_jobs CRUD)
  db/
    sync-jobs-schema.ts   (Drizzle-Schema)
    sync-jobs-queries.ts  (Query-Helpers)
```

**Gate:** `npm run tauri dev` grün, alle neuen Schemas kompilieren, Tauri-Commands aufrufbar, TypeScript fehlerfrei

---

### Sub-Session B: Etsy-Provider (OAuth + Listing Sync)

**Liefert:** Vollständige Etsy-Integration.

**Scope:**
- `EtsyProvider` implementiert `PlatformSyncProvider`
- OAuth 2.0 Flow: Authorization Code Grant mit PKCE
  - PKCE Code Verifier/Challenge Generierung
  - `tauri-plugin-oauth` für Redirect
  - Token Exchange + Token Refresh
- `getShop()` zum Abrufen der Shop-ID nach Auth
- `pushListing()`: createDraftListing → uploadListingImage (alle Bilder) → updateListing state=active
- `updateListing()`: updateListing + Bild-Re-Upload wenn geändert
- `pauseListing()`: updateListing state=inactive
- `deleteListing()`: deleteListing
- `pullOrders()`: getShopReceipts → Mapping auf lokales Order-Schema + Duplikat-Check
- `fetchRemoteListing()`: getListing für Diff-View Daten
- `loadProfiles()`: getShopShippingProfiles

**Ordnerstruktur:**
```
src/features/platform-sync/
  providers/
    etsy/
      etsy-provider.ts    (EtsyProvider Klasse)
      etsy-auth.ts        (OAuth + PKCE Helpers)
      etsy-mappers.ts     (Feld-Mapping PolyGrid ↔ Etsy)
      etsy-types.ts       (Etsy API Response Types)
```

**Gate:** OAuth-Flow funktioniert (Token im Keychain), ein Listing kann auf Etsy als Draft gepusht werden, Bestellungen können importiert werden

---

### Sub-Session C: eBay-Provider (OAuth + Listing Sync)

**Liefert:** Vollständige eBay-Integration.

**Scope:**
- `EbayProvider` implementiert `PlatformSyncProvider`
- OAuth 2.0 Flow: Authorization Code Grant (kein PKCE, Base64 Credentials)
- `pushListing()`: UploadSiteHostedPictures (Trading API, XML) → createOrReplaceInventoryItem → createOffer → publishOffer
- `updateListing()`: Bild-Upload wenn geändert → createOrReplaceInventoryItem (PUT) → updateOffer
- `pauseListing()`: withdrawOffer
- `deleteListing()`: deleteOffer + deleteInventoryItem
- `pullOrders()`: Sell Fulfillment API getOrders → Mapping + Duplikat-Check
- `fetchRemoteListing()`: getInventoryItem + getOffer
- `loadPolicies()`: Fulfillment, Payment, Return Policies laden
- Item Specifics Auto-Mapping (material_type → Material, etc.) + manuelle Ergänzung aus platform_metadata
- XML-Builder für Trading API (nur UploadSiteHostedPictures)

**Ordnerstruktur:**
```
src/features/platform-sync/
  providers/
    ebay/
      ebay-provider.ts    (EbayProvider Klasse)
      ebay-auth.ts        (OAuth Helpers, Base64 Encoding)
      ebay-mappers.ts     (Feld-Mapping PolyGrid ↔ eBay)
      ebay-types.ts       (eBay API Response Types)
      ebay-trading-api.ts (XML-Builder für Bild-Upload)
```

**Gate:** OAuth-Flow funktioniert, ein Listing kann auf eBay als Inventory Item + Offer erstellt werden, Bestellungen importierbar

---

### Sub-Session D: Sync-UI (Frontend)

**Liefert:** Alle UI-Komponenten für Platform Sync.

**Scope:**
- Neue Route `/sync` mit Sidebar-Link
- Tab 1: Sync-Übersicht (TanStack Table mit Listings, Status-Badges, Push-Buttons)
- Tab 2: Sync-Log (TanStack Table mit sync_jobs-Einträgen, expandable Details)
- Diff-View Dialog (nutzt bestehende DiffView-Komponente aus Modul 06)
- Conflict-Resolution Dialog
- Batch-Push Funktion (Progress-Bar, Abbruch-Button)
- Order-Pull Dialog (Plattform wählen, Zeitraum, Fortschritt)
- Sync-Status-Badges in der Listing-Liste (Modul 05 Erweiterung)
- Fehlermeldungen und Retry-Button bei sync_status=error
- Zustand Store: `useSyncStore` (aktive Sync-Jobs, Polling für Status-Updates)

**Ordnerstruktur:**
```
src/features/platform-sync/
  components/
    SyncOverview.tsx       (Hauptkomponente Tab 1)
    SyncLog.tsx            (Tab 2)
    SyncDiffDialog.tsx     (Diff-View Modal)
    ConflictDialog.tsx     (Conflict Resolution)
    BatchPushDialog.tsx    (Batch-Push mit Fortschritt)
    OrderPullDialog.tsx    (Order-Import Dialog)
    SyncStatusBadge.tsx    (Wiederverwendbarer Badge)
  pages/
    SyncPage.tsx           (Route-Komponente)
  stores/
    sync-store.ts          (Zustand Store)
```

**Gate:** Sync-UI rendert, Listings können per Button gepusht werden, Sync-Log zeigt Einträge, Diff-View funktioniert

---

### Sub-Session E: Settings-Erweiterung + Integration + Cleanup

**Liefert:** Vollständige Settings-Integration und Cross-Modul-Anbindung.

**Scope:**
- Settings-Tab "Plattformen" vollständig implementieren:
  - Etsy-Sektion: API-Key/Secret Inputs, OAuth-Button, Verbindungsstatus, Profile-Dropdowns, Taxonomy/who_made/when_made
  - eBay-Sektion: Client-ID/Secret Inputs, OAuth-Button, Verbindungsstatus, Policy-Dropdowns, Marketplace/Location/Kategorie
  - Sync-Sektion: Intervall, Auto-Sync Toggle, Order-Import Toggle
- Sidebar Badge-Counter für Sync-Fehler
- Command Palette: "Sync starten", "Bestellungen importieren"
- Listing-Editor erweitern:
  - "Push to Etsy" / "Push to eBay" Buttons (ersetzen Stubs aus Modul 05)
  - eBay-Details-Bereich: Item Specifics bearbeiten (Key-Value Editor)
  - Sync-Status Badge im Header
- Auftragsimport: Badge "Extern importiert" in Kanban (Modul 08)
- Gesamttest aller Flows (OAuth → Push → Pull → Conflict)
- Code-Cleanup, TypeScript-Check (`tsc --noEmit`), Linter, ESLint
- AGENTS.md aktualisieren (Modul 12 Constraints)

**Gate:** Alle Flows funktionieren End-to-End, Settings speichern korrekt, keine TypeScript-Fehler, `npm run tauri dev` grün

---

## 13. Referenzen

- MODUL_12_ENTSCHEIDUNGEN.md (15 Entscheidungen, alle hier referenziert)
- DATABASE_SCHEMA.md v1.5 (sync_jobs, Listings/Orders-Erweiterungen, Settings-Keys, Keychain-Keys)
- PROJEKTREGELN.md v1.8 (Tech-Stack, Architekturprinzipien, Entwicklungsregeln)
- Etsy Open API v3 Dokumentation: https://developers.etsy.com/documentation/
- eBay Sell Inventory API: https://developer.ebay.com/api-docs/sell/inventory/overview.html
- eBay Trading API (UploadSiteHostedPictures): https://developer.ebay.com/devzone/xml/docs/reference/ebay/UploadSiteHostedPictures.html
- tauri-plugin-oauth: https://github.com/niclas-AIT/tauri-plugin-oauth
