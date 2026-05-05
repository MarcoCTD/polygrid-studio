# Modul 06: KI-Architektur — Codex-Prompts

Alle 6 Sub-Sessions. Jede Sub-Session einzeln in Codex pasten.
Jede muss mit `npm run tauri dev` (grüner Build) + Git Commit enden, bevor die nächste startet.

---

## Sub-Session A: Rust Backend — Keychain + AI Provider Infrastruktur

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (komplett)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md (Abschnitt 2.1 bis 2.7)
4. docs/specs/DATABASE_SCHEMA.md (ai_jobs Tabelle)
5. src-tauri/src/main.rs (bestehende Command-Registrierung verstehen)
6. src-tauri/Cargo.toml (bestehende Dependencies)
7. src-tauri/tauri.conf.json (Permissions und Plugins)

## Aufgabe

Implementiere das Rust-Backend für die KI-Architektur (Modul 06, Sub-Session A). Das Frontend kommt in späteren Sub-Sessions. Hier geht es NUR um den Rust-Layer.

## Was zu tun ist

### 1. Cargo.toml erweitern

Neue Dependencies hinzufügen:
- `keyring = "3"` (OS-Keychain: macOS Keychain, Windows Credential Manager, Linux Secret Service)
- `reqwest = { version = "0.12", features = ["json"] }` (HTTP-Client für API-Calls)
- `serde = { version = "1", features = ["derive"] }` (falls noch nicht vorhanden)
- `serde_json = "1"` (falls noch nicht vorhanden)

WICHTIG: Prüfe zuerst welche Dependencies schon in Cargo.toml stehen. Keine Duplikate.

### 2. Keychain-Modul erstellen

Datei: `src-tauri/src/ai/keychain.rs`

Drei Tauri-Commands:

```rust
#[tauri::command]
pub fn keychain_set(service: String, key: String, value: String) -> Result<(), String> {
    // keyring crate nutzen
    // Service: "polygrid-studio"
    // Keys: "claude_api_key", "openai_api_key"
    // Fehler als String zurückgeben
}

#[tauri::command]
pub fn keychain_get(service: String, key: String) -> Result<Option<String>, String> {
    // None wenn Key nicht existiert
    // Fehler nur bei echten Fehlern
}

#[tauri::command]
pub fn keychain_delete(service: String, key: String) -> Result<(), String> {
    // Kein Fehler wenn Key nicht existiert
}
```

### 3. AI Provider Trait + Structs

Datei: `src-tauri/src/ai/provider.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub json_mode: bool,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIResponse {
    pub text: String,
    pub tokens_input: u32,
    pub tokens_output: u32,
    pub model: String,
    pub provider: String,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIError {
    pub code: String,
    pub message: String,
}
```

Kein async Trait nötig — die Provider werden als Funktionen implementiert, nicht als Trait-Objects (einfacher in Tauri).

### 4. Claude Provider

Datei: `src-tauri/src/ai/claude.rs`

- Endpoint: `https://api.anthropic.com/v1/messages`
- Header: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Default-Modell: `claude-sonnet-4-20250514`
- Request-Body: `{ model, max_tokens, system, messages: [{ role: "user", content }] }`
- Response parsen: `content[0].text`, `usage.input_tokens`, `usage.output_tokens`
- Bei json_mode: Im System-Prompt "Respond only with valid JSON, no markdown, no preamble." anhängen

Funktion:
```rust
pub async fn claude_generate(api_key: &str, request: &AIRequest) -> Result<AIResponse, String>
pub async fn claude_test_connection(api_key: &str) -> Result<String, String>
// test_connection: kurze Anfrage senden, Modellname zurückgeben
```

### 5. OpenAI Provider

Datei: `src-tauri/src/ai/openai.rs`

- Endpoint: `https://api.openai.com/v1/chat/completions`
- Header: `Authorization: Bearer {key}`, `content-type: application/json`
- Default-Modell: `gpt-4o`
- Request-Body: `{ model, max_tokens, messages: [{ role: "system", content }, { role: "user", content }] }`
- Bei json_mode: `response_format: { type: "json_object" }` im Body + System-Prompt-Hinweis
- Response parsen: `choices[0].message.content`, `usage.prompt_tokens`, `usage.completion_tokens`

Funktion:
```rust
pub async fn openai_generate(api_key: &str, request: &AIRequest) -> Result<AIResponse, String>
pub async fn openai_test_connection(api_key: &str) -> Result<String, String>
```

### 6. Ollama Provider

Datei: `src-tauri/src/ai/ollama.rs`

- Chat-Endpoint: `{endpoint}/api/chat` (Default endpoint: `http://localhost:11434`)
- Tags-Endpoint: `{endpoint}/api/tags` (Modelle auflisten)
- Kein API-Key nötig
- Default-Modell: `llama3`
- Request-Body Chat: `{ model, messages: [{ role: "system", content }, { role: "user", content }], stream: false, format: "json" (wenn json_mode) }`
- Response parsen: `message.content`, Token-Counts aus `eval_count` und `prompt_eval_count`

Funktionen:
```rust
pub async fn ollama_generate(endpoint: &str, request: &AIRequest) -> Result<AIResponse, String>
pub async fn ollama_test_connection(endpoint: &str) -> Result<String, String>
pub async fn ollama_list_models(endpoint: &str) -> Result<Vec<String>, String>
```

### 7. Kosten-Berechnung

Datei: `src-tauri/src/ai/cost.rs`

```rust
pub fn estimate_cost_eur(provider: &str, model: &str, tokens_input: u32, tokens_output: u32) -> f64 {
    // Lookup-Table:
    // claude-sonnet-4-20250514: input 3.00, output 15.00 ($/1M tokens)
    // claude-haiku-4-5-20251001: input 0.80, output 4.00
    // gpt-4o: input 2.50, output 10.00
    // gpt-4o-mini: input 0.15, output 0.60
    // ollama/*: 0.00, 0.00
    // Wechselkurs: 0.92 EUR/USD
    // Formel: (input_tokens * input_price / 1_000_000 + output_tokens * output_price / 1_000_000) * 0.92
}
```

### 8. Tauri-Commands

Datei: `src-tauri/src/ai/commands.rs`

Haupt-Commands die das Frontend aufruft:

```rust
#[tauri::command]
pub async fn ai_generate_text(
    provider: String,          // "claude", "openai", "ollama"
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
) -> Result<AIResponse, String> {
    // 1. API-Key aus Keychain lesen (für claude/openai)
    //    Ollama: Endpoint aus Parameter oder Default
    // 2. AIRequest bauen
    // 3. Provider-Funktion aufrufen
    // 4. AIResponse zurückgeben
    // HINWEIS: ai_jobs Logging passiert im Frontend (weil DB-Zugriff dort einfacher ist mit Drizzle)
}

#[tauri::command]
pub async fn ai_generate_structured(
    provider: String,
    system_prompt: String,
    user_prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    model: Option<String>,
) -> Result<AIResponse, String> {
    // Wie ai_generate_text, aber mit json_mode = true
}

#[tauri::command]
pub async fn ai_test_connection(provider: String) -> Result<String, String> {
    // Gibt Modellname zurück bei Erfolg
    // Für claude/openai: Key aus Keychain, kurze Anfrage
    // Für ollama: Tags-Endpoint prüfen
}

#[tauri::command]
pub async fn ai_list_ollama_models(endpoint: Option<String>) -> Result<Vec<String>, String> {
    // Default endpoint: http://localhost:11434
    // GET /api/tags → Modellnamen extrahieren
}

#[tauri::command]
pub fn ai_estimate_cost(
    provider: String,
    model: String,
    tokens_input: u32,
    tokens_output: u32,
) -> f64 {
    // Wrapper um cost::estimate_cost_eur
}
```

### 9. Modul-Struktur und Registration

Datei: `src-tauri/src/ai/mod.rs`
```rust
pub mod keychain;
pub mod provider;
pub mod claude;
pub mod openai;
pub mod ollama;
pub mod commands;
pub mod cost;
```

In `src-tauri/src/main.rs`:
- `mod ai;` hinzufügen
- Alle Commands registrieren im `.invoke_handler(tauri::generate_handler![...])`:
  - `ai::keychain::keychain_set`
  - `ai::keychain::keychain_get`
  - `ai::keychain::keychain_delete`
  - `ai::commands::ai_generate_text`
  - `ai::commands::ai_generate_structured`
  - `ai::commands::ai_test_connection`
  - `ai::commands::ai_list_ollama_models`
  - `ai::commands::ai_estimate_cost`

### 10. Tauri Permissions

Falls nötig: In `tauri.conf.json` oder den Capability-Dateien die HTTP-Permission für externe Domains hinzufügen:
- `https://api.anthropic.com/*`
- `https://api.openai.com/*`
- `http://localhost:11434/*` (Ollama)

Prüfe wie das in der bestehenden Tauri-Konfiguration gehandhabt wird und passe es entsprechend an.

## Dateien die erstellt/geändert werden

ERSTELLEN:
- src-tauri/src/ai/mod.rs
- src-tauri/src/ai/provider.rs
- src-tauri/src/ai/claude.rs
- src-tauri/src/ai/openai.rs
- src-tauri/src/ai/ollama.rs
- src-tauri/src/ai/keychain.rs
- src-tauri/src/ai/commands.rs
- src-tauri/src/ai/cost.rs

ÄNDERN:
- src-tauri/Cargo.toml (Dependencies)
- src-tauri/src/main.rs (mod ai + Command-Registration)
- src-tauri/capabilities/*.json oder tauri.conf.json (HTTP Permissions, falls nötig)

## NICHT anfassen
- Alles unter src/ (Frontend)
- Bestehende Rust-Module (filesystem commands etc.)
- package.json

## Akzeptanzkriterien
- `cargo build` kompiliert ohne Fehler und ohne Warnings (Warnings als Errors behandeln)
- `npm run tauri dev` startet die App
- Alle 8 Commands sind registriert (prüfe in main.rs)
- Code ist sauber: kein unwrap() ohne Error-Handling, alle Fehler als Result<_, String>
- Kein println!() für Debugging (nutze log crate falls vorhanden oder entferne Debug-Output)

## Git Commit
```
feat(mod-06): rust AI provider infrastructure + keychain
```
```

---

## Sub-Session B: Frontend AI Service Layer + Store + Types

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (komplett)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md (Abschnitt 2.4, 2.6, 2.8)
4. docs/specs/DATABASE_SCHEMA.md (ai_jobs Tabelle + app_settings Keys für KI und Brand)
5. src/features/ai-assistant/ (bestehende Platzhalter-Seite, Struktur verstehen)
6. src/stores/ (bestehende Store-Patterns verstehen, z.B. uiStore.ts)
7. src/services/database/ (DB-Service Pattern verstehen für ai_jobs Queries)
8. src-tauri/src/ai/commands.rs (Rust-Commands aus Sub-Session A — Parameter und Rückgabe-Typen verstehen)

## Aufgabe

Implementiere den Frontend-Service-Layer für die KI-Architektur (Modul 06, Sub-Session B). Noch KEINE UI-Komponenten — nur TypeScript-Infrastruktur: Types, Service, Agents, Store, Hooks.

## Was zu tun ist

### 1. Types

Datei: `src/features/ai-assistant/types/index.ts`

```typescript
// Provider
export type AIProviderName = 'claude' | 'openai' | 'ollama';

// Agent
export type AIAgentName = 'listing_assistant' | 'expense_assistant' | 'product_analyst';

// Aktionen
export type ListingAction = 'generate_title' | 'generate_description' | 'generate_tags' | 'generate_bullet_points' | 'rewrite_for_platform';
export type ExpenseAction = 'classify_expense' | 'detect_duplicate' | 'suggest_purpose';
export type AIAction = ListingAction | ExpenseAction;

// Request/Response (muss zu Rust-Commands passen)
export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AIResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  provider: string;
  durationMs: number;
}

// Für DiffView
export interface AIDiffField {
  fieldName: string;
  fieldLabel: string;
  currentValue: string | string[] | null;
  suggestedValue: string | string[];
}

export interface AIDiffResult {
  agent: AIAgentName;
  action: AIAction;
  provider: AIProviderName;
  model: string;
  fields: AIDiffField[];
  jobId?: string; // ai_jobs ID nach Logging
}

// Status
export interface AIStatus {
  activeProvider: AIProviderName | null;
  availableProviders: AIProviderName[];
  monthlySpent: number;
  monthlyLimit: number;
  isLimitReached: boolean;
  isLoading: boolean;
  error: string | null;
}

// Expense Assistant spezifisch
export interface ExpenseClassification {
  category: string;
  subcategory: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  matchId?: string;
  reason?: string;
}
```

### 2. AI Service (invoke-Wrapper)

Datei: `src/features/ai-assistant/services/aiService.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';
// Wrapper-Funktionen um die Rust-Commands

export async function aiGenerateText(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  // invoke('ai_generate_text', { provider, systemPrompt, userPrompt, ...options })
  // Snake_case für Rust-Parameter beachten!
  // Rust erwartet: provider, system_prompt, user_prompt, max_tokens, temperature, model
}

export async function aiGenerateStructured(
  provider: AIProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: AIOptions,
): Promise<AIResponse> {
  // Wie oben, aber ai_generate_structured Command
}

export async function aiTestConnection(provider: AIProviderName): Promise<string> {
  // invoke('ai_test_connection', { provider })
}

export async function aiListOllamaModels(endpoint?: string): Promise<string[]> {
  // invoke('ai_list_ollama_models', { endpoint })
}

export async function keychainSet(key: string, value: string): Promise<void> {
  // invoke('keychain_set', { service: 'polygrid-studio', key, value })
}

export async function keychainGet(key: string): Promise<string | null> {
  // invoke('keychain_get', { service: 'polygrid-studio', key })
}

export async function keychainDelete(key: string): Promise<void> {
  // invoke('keychain_delete', { service: 'polygrid-studio', key })
}

export async function aiEstimateCost(
  provider: string,
  model: string,
  tokensInput: number,
  tokensOutput: number,
): Promise<number> {
  // invoke('ai_estimate_cost', { provider, model, tokens_input, tokens_output })
}
```

WICHTIG: Die invoke-Parameter müssen snake_case sein (so wie die Rust-Funktion sie erwartet). Prüfe die Rust-Command-Signaturen in src-tauri/src/ai/commands.rs.

### 3. Prompt Builder

Datei: `src/features/ai-assistant/services/promptBuilder.ts`

Baut System-Prompts dynamisch zusammen:

```typescript
interface BrandSettings {
  writingStyle: string;
  preferredWords: string[];
  forbiddenPhrases: string[];
  referenceText: string;
}

// Brand-Settings aus app_settings lesen (mit Defaults)
export async function loadBrandSettings(): Promise<BrandSettings>

// System-Prompt für Listing Assistant zusammenbauen
export function buildListingSystemPrompt(
  platform: 'etsy' | 'ebay' | 'kleinanzeigen',
  language: 'de' | 'en',
  brand: BrandSettings,
): string

// System-Prompt für Expense Assistant zusammenbauen
export function buildExpenseSystemPrompt(
  categories: string[], // Gültige Kategorien
  brand: BrandSettings,
): string
```

Für die App-Settings-Abfrage: Schau dir an wie andere Module app_settings lesen (z.B. Theme in useTheme.ts oder Filament-Preise im Margenrechner). Nutze das gleiche Pattern.

Brand-Settings Keys in app_settings:
- `brand_writing_style` (Default: "sachlich-minimalistisch")
- `brand_preferred_words` (Default: [])
- `brand_forbidden_phrases` (Default: [])
- `brand_reference_text` (Default: "")

### 4. Cost Tracker

Datei: `src/features/ai-assistant/services/costTracker.ts`

```typescript
// Monatliche Kosten aus ai_jobs summieren
export async function getMonthlySpent(): Promise<number>
// Summe estimated_cost aus ai_jobs WHERE created_at im aktuellen Monat (YYYY-MM)

// Monatslimit aus app_settings lesen
export async function getMonthlyLimit(): Promise<number>
// Key: ai_monthly_limit_eur, Default: 10

// Prüfen ob Limit erreicht
export async function checkBudget(): Promise<{ spent: number; limit: number; remaining: number; isWarning: boolean; isBlocked: boolean }>
// isWarning: spent >= limit * 0.8
// isBlocked: spent >= limit
```

Für DB-Queries: Nutze das bestehende DB-Service-Pattern (Drizzle oder Raw SQL über invoke, je nachdem wie es in den anderen Modulen gemacht wird).

### 5. Listing Assistant Agent

Datei: `src/features/ai-assistant/agents/listingAssistant.ts`

```typescript
import { Product } from '../../products/types'; // oder wo auch immer der Product-Type definiert ist
import { Listing } from '../../listings/types';

export async function generateTitle(
  product: Product,
  platform: 'etsy' | 'ebay' | 'kleinanzeigen',
  language: 'de' | 'en',
): Promise<AIDiffResult>

export async function generateDescription(
  product: Product,
  platform: 'etsy' | 'ebay' | 'kleinanzeigen',
  style: 'short' | 'long',
  language: 'de' | 'en',
): Promise<AIDiffResult>

export async function generateTags(
  product: Product,
  platform: 'etsy' | 'ebay' | 'kleinanzeigen',
  language: 'de' | 'en',
): Promise<AIDiffResult>

export async function generateBulletPoints(
  product: Product,
  language: 'de' | 'en',
): Promise<AIDiffResult>

export async function rewriteForPlatform(
  text: string,
  sourcePlatform: string,
  targetPlatform: string,
): Promise<AIDiffResult>
```

Jede Funktion:
1. Brand-Settings laden (promptBuilder)
2. System-Prompt bauen
3. User-Prompt bauen (produktspezifisch)
4. Provider bestimmen (aus aiStore oder app_settings)
5. Budget prüfen (costTracker)
6. aiGenerateText oder aiGenerateStructured aufrufen
7. Response parsen
8. ai_jobs Eintrag in DB schreiben
9. AIDiffResult zurückgeben

Für generateTags und generateBulletPoints: aiGenerateStructured nutzen (json_mode), Response als JSON parsen.
Für generateTitle und generateDescription: aiGenerateText nutzen.

User-Prompt Beispiele:
- generateTitle: "Erstelle 3 SEO-optimierte Titel für folgendes Produkt auf Etsy (max. 140 Zeichen pro Titel): Name: {name}, Material: {material}, Kategorie: {category}. Antworte NUR mit den 3 Titeln, je einer pro Zeile, ohne Nummerierung."
- generateTags: "Erstelle {maxTags} SEO-Tags für Etsy für folgendes Produkt: ... Antworte als JSON-Array: [\"tag1\", \"tag2\", ...]"

### 6. Expense Assistant Agent

Datei: `src/features/ai-assistant/agents/expenseAssistant.ts`

```typescript
export async function classifyExpense(
  vendor: string,
  amount: number,
  purpose?: string,
): Promise<AIDiffResult>

export async function detectDuplicate(
  vendor: string,
  amount: number,
  date: string,
  existingExpenses: Array<{ id: string; vendor: string; amount: number; date: string }>,
): Promise<DuplicateCheck>

export async function suggestPurpose(
  vendor: string,
  category: string,
): Promise<string>
```

Kategorien für den Prompt (aus DATABASE_SCHEMA.md):
Filament, Verpackung, Werkzeuge, Druckerzubehör, Maschinen/Hardware, Software/SaaS, Werbung, Versand, Reisekosten, Büro, Sonstiges

Für classifyExpense bevorzugt Ollama nutzen (kostenlos). Fallback auf Cloud-Provider.

### 7. AI Store (Zustand)

Datei: `src/features/ai-assistant/stores/aiStore.ts`

```typescript
import { create } from 'zustand';

interface AIState {
  // Status
  activeProvider: AIProviderName | null;
  availableProviders: AIProviderName[];
  monthlySpent: number;
  monthlyLimit: number;

  // Loading
  isLoading: boolean;
  currentAction: string | null;

  // Actions
  initialize: () => Promise<void>; // Provider-Status prüfen, Budget laden
  setActiveProvider: (provider: AIProviderName) => void;
  refreshBudget: () => Promise<void>;
  setLoading: (loading: boolean, action?: string) => void;
}
```

initialize() wird beim App-Start aufgerufen:
1. Bevorzugten Provider aus app_settings lesen
2. Für jeden Provider prüfen ob Key vorhanden (keychain) und Connection funktioniert
3. Budget laden (costTracker)

### 8. Hooks

Datei: `src/features/ai-assistant/hooks/useAI.ts`

```typescript
// Generischer Hook für KI-Aufrufe
export function useAI() {
  // Gibt zurück: { generate, isLoading, error, result }
  // generate: Funktion die einen Agent-Call macht mit Loading-State-Management
  // Nutzt aiStore für Provider und Budget
}
```

Datei: `src/features/ai-assistant/hooks/useAIStatus.ts`

```typescript
// Hook der den aktuellen AI-Status liefert
export function useAIStatus(): AIStatus {
  // Liest aus aiStore
  // Gibt alle Status-Informationen zurück
}
```

## Dateien die erstellt/geändert werden

ERSTELLEN:
- src/features/ai-assistant/types/index.ts
- src/features/ai-assistant/services/aiService.ts
- src/features/ai-assistant/services/promptBuilder.ts
- src/features/ai-assistant/services/costTracker.ts
- src/features/ai-assistant/agents/listingAssistant.ts
- src/features/ai-assistant/agents/expenseAssistant.ts
- src/features/ai-assistant/stores/aiStore.ts
- src/features/ai-assistant/hooks/useAI.ts
- src/features/ai-assistant/hooks/useAIStatus.ts

ÄNDERN:
- src/features/ai-assistant/index.ts (Exporte aktualisieren)
- Evtl. src/App.tsx oder Layout-Komponente (aiStore.initialize() beim App-Start aufrufen)

## NICHT anfassen
- Rust-Code (Sub-Session A ist abgeschlossen)
- Andere Feature-Module (Produkte, Listings, Ausgaben — kommen in Sub-Session D+E)
- UI-Komponenten (kommen in Sub-Session C)

## Akzeptanzkriterien
- Alle TypeScript-Files kompilieren ohne Fehler (strict mode)
- `npm run tauri dev` startet
- Keine any-Types (außer mit begründetem Kommentar)
- AI Store ist funktional (kann in DevTools über React DevTools geprüft werden)
- Alle Services sind exportiert und importierbar
- Prompt Builder liest Brand-Settings aus app_settings (nutze Defaults wenn keine Settings vorhanden)
- Cost Tracker kann ai_jobs summieren (leere Tabelle = 0.00 EUR)
- ESLint und Prettier laufen ohne Fehler

## Git Commit
```
feat(mod-06): frontend AI service layer, agents, stores
```
```

---

## Sub-Session C: DiffView + KI-Settings-UI

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (Abschnitt 6 Diff-View, 9 API-Key-Verwaltung, 10 Settings-UI)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md (Abschnitt 2.5 DiffView, 2.9 Settings-UI)
4. src/features/settings/ (bestehende Settings-Seite mit Theme-Toggle und Akzentfarben — Struktur und Pattern verstehen)
5. src/components/shared/ (bestehende Shared-Komponenten-Patterns)
6. src/components/ui/ (verfügbare shadcn Komponenten — welche sind installiert?)
7. src/features/ai-assistant/types/index.ts (Types aus Sub-Session B)
8. src/features/ai-assistant/services/aiService.ts (Service aus Sub-Session B)
9. src/features/ai-assistant/stores/aiStore.ts (Store aus Sub-Session B)
10. src/styles/globals.css (Design-System CSS Variables)

## Aufgabe

Implementiere die DiffView-Komponente (shared) und die minimale KI-Settings-UI (Provider-Konfiguration + Markenstil). Nach dieser Sub-Session können erstmals API-Keys gesetzt und Provider getestet werden.

## Was zu tun ist

### 1. DiffView Komponente (Shared)

Datei: `src/components/shared/DiffView.tsx`

Eine wiederverwendbare Komponente die KI-Vorschläge als Vorher/Nachher zeigt.

Props:
```typescript
interface DiffViewProps {
  title: string;                    // z.B. "KI-Vorschlag"
  agent: string;                    // z.B. "Listing Assistant"
  provider: string;                 // z.B. "Claude (claude-sonnet-4)"
  fields: AIDiffField[];            // Array von Feld-Vergleichen
  onAccept: (fields: AIDiffField[]) => void;  // Annehmen (evtl. editierte Felder)
  onReject: () => void;             // Ablehnen
  isOpen: boolean;                  // Dialog offen/geschlossen
  onClose: () => void;              // Dialog schließen
}
```

Layout (als Modal/Dialog, nutze shadcn Dialog):
- Header: Titel + Agent-Name + Provider-Name
- Body: Tabelle mit Spalten: Feldname | Aktuell | Vorschlag
  - Strings: Text-Vergleich
  - Arrays (Tags etc.): Badges, neue grün, entfernte rot
  - Null/leere Werte: "(leer)" in muted Farbe
- Footer: Drei Buttons
  - "Ablehnen" (links, outline/ghost Variante)
  - "Bearbeiten" (mitte, outline Variante) — macht Vorschlag-Spalte editierbar
  - "Annehmen" (rechts, primary Variante mit accent-primary)

Im Bearbeiten-Modus:
- Vorschlag-Felder werden zu Inputs/Textareas
- Tags werden zu Tag-Input (Hinzufügen/Entfernen)
- "Bearbeiten" Button wird zu "Übernehmen"

Styling:
- Nutze CSS Variables aus dem Design-System (--bg-elevated, --text-primary, --accent-primary etc.)
- Nutze shadcn Dialog, Button, Input, Badge, Separator
- Responsive: min-width 500px, max-width 700px

### 2. AI Status Badge

Datei: `src/features/ai-assistant/components/AIStatusBadge.tsx`

Kleine Badge-Komponente die den aktiven Provider anzeigt:
- Grün + Provider-Name wenn aktiv
- Gelb + "Budget 80%" wenn Warnung
- Rot + "Budget erschöpft" wenn Limit erreicht
- Grau + "Kein Provider" wenn nichts konfiguriert

Nutzt useAIStatus() Hook. Kann in Sidebar oder Toolbar eingebaut werden.

### 3. Provider Settings

Datei: `src/features/ai-assistant/components/ProviderSettings.tsx`

Drei Sektionen (Claude, OpenAI, Ollama), jeweils:

**Claude / OpenAI:**
- Label: "Claude API-Key" / "OpenAI API-Key"
- Input (type: password, maskiert)
- Drei Buttons: "Speichern" (keychainSet), "Löschen" (keychainDelete), "Verbindung testen" (aiTestConnection)
- Status-Anzeige: Erfolg (grün, Modellname), Fehler (rot, Fehlermeldung), Loading
- Beim Laden: keychainGet prüfen ob Key existiert → "API-Key gespeichert ✓" oder "Kein API-Key"

**Ollama:**
- Input: Endpoint-URL (Default: http://localhost:11434)
- Button: "Verbindung testen"
- Bei Erfolg: Dropdown mit verfügbaren Modellen (aiListOllamaModels)
- Modell-Auswahl speichern in app_settings

**Allgemein:**
- Dropdown: Bevorzugter Provider (Claude, OpenAI, Ollama) → app_settings `ai_preferred_provider`
- Input: Monatslimit EUR (Default: 10) → app_settings `ai_monthly_limit_eur`
- Anzeige: Aktueller Monatsverbrauch "X.XX von Y.XX EUR" mit Fortschrittsbalken

### 4. Brand Settings

Datei: `src/features/ai-assistant/components/BrandSettings.tsx`

- Dropdown: Schreibstil (sachlich-minimalistisch, technisch-präzise, freundlich-professionell) → app_settings `brand_writing_style`
- Textarea: Brand-Wörter (kommasepariert) → app_settings `brand_preferred_words` (als JSON Array speichern)
- Textarea: No-Go-Formulierungen (kommasepariert) → app_settings `brand_forbidden_phrases` (als JSON Array speichern)
- Textarea: Referenztext → app_settings `brand_reference_text`
- Button: "Speichern"

### 5. Settings-Seite erweitern

Die bestehende Settings-Seite (Route: /settings) hat bereits Theme-Toggle und Akzentfarben.
Ergänze zwei neue Sektionen (z.B. als weitere Abschnitte oder Tabs, je nachdem wie die Settings-Seite aktuell strukturiert ist):

- "KI-Provider" → ProviderSettings Komponente
- "Markenstil" → BrandSettings Komponente

Schau dir die bestehende Settings-Seite an und füge die neuen Sektionen konsistent zum bestehenden Design hinzu.

## Dateien die erstellt/geändert werden

ERSTELLEN:
- src/components/shared/DiffView.tsx
- src/features/ai-assistant/components/AIStatusBadge.tsx
- src/features/ai-assistant/components/ProviderSettings.tsx
- src/features/ai-assistant/components/BrandSettings.tsx

ÄNDERN:
- src/features/settings/ (Settings-Seite erweitern um KI-Provider und Brand-Sektionen)
- src/features/ai-assistant/index.ts (Exporte aktualisieren falls nötig)

## NICHT anfassen
- Rust-Code
- Andere Feature-Module (Produkte, Listings, Ausgaben)
- Bestehende Settings-Funktionalität (Theme, Akzentfarben) darf nicht brechen

## Akzeptanzkriterien
- DiffView rendert korrekt (teste mit Mock-Daten in der Komponente selbst oder Storybook-artig)
- In Settings: API-Key für Claude eingeben → "Speichern" → keychainGet liefert den Key
- In Settings: "Verbindung testen" für Claude → zeigt Modellname oder Fehler
- In Settings: Ollama Endpoint testen → zeigt Modelle oder "Ollama nicht erreichbar"
- In Settings: Brand-Einstellungen speichern → app_settings Einträge vorhanden
- In Settings: Bevorzugter Provider und Monatslimit speichern
- AIStatusBadge zeigt korrekten Status
- Alle neuen Komponenten nutzen Design-System CSS Variables
- `npm run tauri dev` startet, Settings-Seite zeigt alles korrekt
- TypeScript strict, ESLint, Prettier ohne Fehler

## Git Commit
```
feat(mod-06): DiffView component + AI settings UI
```
```

---

## Sub-Session D: Listing Assistant Integration (Modul 05 KI-Toolbar)

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (Abschnitt 4 Listing Assistant, 6 Diff-View)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md (Abschnitt 2.8 System-Prompts)
4. docs/specs/MODUL_05_LISTING_VERWALTUNG.md (Editor-Spec, KI-Toolbar)
5. src/features/listings/ (KOMPLETT lesen — alle Dateien. Verstehe den 7-Tab-Editor, das Master+Overrides-Konzept, die bestehende Komponenten-Struktur)
6. src/features/ai-assistant/agents/listingAssistant.ts (Agent aus Sub-Session B)
7. src/features/ai-assistant/services/promptBuilder.ts (Prompt Builder aus Sub-Session B)
8. src/components/shared/DiffView.tsx (DiffView aus Sub-Session C)
9. src/features/ai-assistant/hooks/useAI.ts (Hook aus Sub-Session B)
10. src/features/ai-assistant/stores/aiStore.ts (Store aus Sub-Session B)

## Aufgabe

Ersetze den KI-Platzhalter im Listing-Editor mit einer funktionalen KI-Toolbar. Alle 5 Listing-Assistant-Aktionen sollen über Buttons aufrufbar sein und Ergebnisse im DiffView zeigen.

## Was zu tun ist

### 1. KI-Toolbar Komponente

Datei: `src/features/ai-assistant/components/AIToolbar.tsx`

Eine wiederverwendbare Toolbar mit KI-Aktions-Buttons:

```typescript
interface AIToolbarProps {
  product: Product;               // Produktdaten für den Kontext
  listing?: Listing;              // Aktuelles Listing (für bestehende Werte)
  platform: 'etsy' | 'ebay' | 'kleinanzeigen';
  language: 'de' | 'en';
  onApplyDiff: (fields: AIDiffField[]) => void; // Callback wenn User "Annehmen" klickt
}
```

Buttons:
- "Titel generieren" (Icon: Sparkles oder Wand)
- "Beschreibung generieren" (mit Dropdown: Kurz / Lang)
- "Tags generieren"
- "Bullet Points generieren"
- "Für Plattform umschreiben" (mit Dropdown: Zielplattform)

Jeder Button:
1. Prüft ob Provider verfügbar (useAIStatus) → disabled + Tooltip wenn nicht
2. Prüft Budget (costTracker) → Warnung/Block wenn Limit
3. Ruft die entsprechende Listing-Assistant-Funktion auf
4. Zeigt Loading-State (Spinner auf dem Button)
5. Öffnet DiffView mit dem Ergebnis
6. Bei "Annehmen": ruft onApplyDiff mit den neuen Werten auf

Styling: Horizontal angeordnete Buttons, kompakt, mit shadcn Button (outline oder ghost Variante). Bei KI-Aktionen ein kleines Sparkles-Icon. Die Toolbar sollte sich gut in den bestehenden Editor einfügen.

### 2. Integration in Listing-Editor

Finde die Stelle im Listing-Editor wo der KI-Platzhalter steht ("KI-Funktionen werden in einem späteren Update verfügbar" oder ähnlich).

Ersetze den Platzhalter durch die AIToolbar Komponente.

Die AIToolbar braucht:
- `product`: Lade das Produkt über product_id des Listings
- `listing`: Das aktuelle Listing (für bestehende Werte im DiffView)
- `platform`: Aus dem Listing
- `language`: Aus dem Listing
- `onApplyDiff`: Callback der die Formular-Felder aktualisiert

WICHTIG: Verstehe zuerst WIE der Listing-Editor Formular-State verwaltet (React Hook Form? Zustand? lokaler State?). Die onApplyDiff-Funktion muss die Werte korrekt in den bestehenden State schreiben. Wenn der Editor React Hook Form nutzt, dann per setValue(). Wenn Zustand, dann per Store-Action.

### 3. Prompt-Templates finalisieren

In `src/features/ai-assistant/agents/listingAssistant.ts`:

Stelle sicher dass die User-Prompts für jede Aktion sinnvoll sind. Hier konkrete Beispiele:

**generateTitle (Etsy, DE):**
System: [Brand-Settings + Plattform-Kontext]
User: "Erstelle 3 SEO-optimierte Produkttitel für Etsy (max. 140 Zeichen pro Titel).
Produkt: {name}
Material: {material}
Kategorie: {category}
Beschreibung: {description_internal}
Antworte NUR mit den 3 Titeln, einer pro Zeile, ohne Nummerierung und ohne Anführungszeichen."

**generateTags (Etsy, DE):**
System: [Brand-Settings + Plattform-Kontext]
User: "Erstelle genau 13 SEO-optimierte Tags für dieses Etsy-Listing.
Produkt: {name}, Material: {material}, Kategorie: {category}
Antworte als JSON-Array: [\"tag1\", \"tag2\", ...]
Beachte: Jeder Tag max. 20 Zeichen. Keine Duplikate."

**generateDescription (Etsy, DE, long):**
System: [Brand-Settings + Plattform-Kontext]
User: "Erstelle eine ausführliche Produktbeschreibung für Etsy.
Produkt: {name}
Material: {material}
Maße/Details: {description_internal}
Stil: {brand_writing_style}
Die Beschreibung soll sachlich und präzise sein, technische Details betonen und in 3-4 Absätze gegliedert sein."

### 4. DiffView Integration

Wenn der Listing Assistant ein Ergebnis zurückgibt:
- Für Titel: DiffView mit einem Feld "Titel" (currentValue = aktueller Titel, suggestedValue = generierter Titel)
  - Bei 3 Vorschlägen: Zeige alle 3, User wählt einen aus (Radio-Buttons im DiffView oder 3 separate Felder)
- Für Tags: DiffView mit Feld "Tags" (currentValue = aktuelle Tags als Array, suggestedValue = generierte Tags)
- Für Beschreibung: DiffView mit Feld "Beschreibung" (currentValue = aktuelle Beschreibung, suggestedValue = generierte)
- Für Bullets: DiffView mit Feld "Aufzählungspunkte" (currentValue = aktuelle, suggestedValue = generierte)

### 5. ai_jobs Logging

Stelle sicher dass jeder Listing-Assistant-Call in ai_jobs geloggt wird:
- Bei Aufruf: Eintrag erstellen mit status "success" oder "error"
- Bei "Annehmen" im DiffView: Status bleibt "success"
- Bei "Ablehnen": Status auf "cancelled" updaten
- estimated_cost berechnen (aiEstimateCost)

## Dateien die erstellt/geändert werden

ERSTELLEN:
- src/features/ai-assistant/components/AIToolbar.tsx

ÄNDERN:
- src/features/listings/components/[Editor-Datei] (KI-Platzhalter → AIToolbar)
- src/features/ai-assistant/agents/listingAssistant.ts (Prompts finalisieren)
- Evtl. weitere Listing-Editor-Dateien für State-Integration

## NICHT anfassen
- Rust-Code
- Bestehende Listing-CRUD-Logik (nur KI-Integration hinzufügen)
- Andere Module (Produkte, Ausgaben)
- DiffView Komponente (nutzen, nicht ändern)

## Akzeptanzkriterien
- Im Listing-Editor: KI-Toolbar ist sichtbar (kein Platzhalter mehr)
- "Titel generieren" → API-Call → DiffView mit Vorschlag → "Annehmen" → Titel wird im Formular aktualisiert
- "Tags generieren" → Tags als Array im DiffView → "Annehmen" → Tags im Formular
- "Beschreibung generieren" (kurz + lang) funktioniert
- "Bullet Points generieren" funktioniert
- "Für andere Plattform umschreiben" funktioniert
- Buttons sind disabled wenn kein Provider verfügbar (mit Tooltip)
- Loading-State auf Buttons während API-Call
- Jeder Call wird in ai_jobs geloggt
- Brand-Settings werden in Prompts berücksichtigt (prüfe Output wenn No-Go-Phrasen gesetzt sind)
- Plattform-Limits werden beachtet (Etsy: 140 Zeichen Titel, 13 Tags)
- `npm run tauri dev` startet, Editor funktioniert mit KI
- TypeScript strict, ESLint, Prettier ohne Fehler

## Git Commit
```
feat(mod-06): listing assistant integration in editor
```
```

---

## Sub-Session E: Expense Assistant (Modul 04) + Produkt KI-Tab (Modul 02)

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (Abschnitt 5 Expense Assistant, 11.1 Produkt KI-Tab, 11.2 Ausgaben KI)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md
4. docs/specs/MODUL_04_AUSGABENVERWALTUNG.md (Schnellerfassung, Detail-Panel, Kategorien)
5. docs/specs/MODUL_02_PRODUKTVERWALTUNG.md (Detail-Panel Tabs, KI-Tab Platzhalter)
6. src/features/expenses/ (KOMPLETT lesen — Schnellerfassung, Detail-Panel, bestehende Struktur)
7. src/features/products/ (KOMPLETT lesen — Detail-Panel mit Tabs, KI-Tab Platzhalter finden)
8. src/features/ai-assistant/agents/expenseAssistant.ts (Agent aus Sub-Session B)
9. src/features/ai-assistant/components/AIToolbar.tsx (Toolbar aus Sub-Session D — als Pattern wiederverwenden)
10. src/components/shared/DiffView.tsx (DiffView)
11. src/components/layout/CommandPalette.tsx (Command Registry Pattern verstehen)

## Aufgabe

Drei Dinge in dieser Sub-Session:
1. Expense Assistant in die Ausgabenverwaltung integrieren
2. KI-Tab im Produkt-Detail-Panel mit echten Funktionen ausfüllen
3. Command Palette um "KI fragen" erweitern

## Was zu tun ist

### 1. Expense Assistant in Ausgaben

**In der Schnellerfassung (Inline-Formular über der Tabelle):**
- Neben dem Kategorie-Dropdown: Button "KI-Vorschlag" (kleines Sparkles-Icon)
- Button wird aktiv wenn Händler-Feld ausgefüllt ist
- Klick → classifyExpense(vendor, amount, purpose) → Vorschlag erscheint
- Vorschlag: Zeige Kategorie + Unterkategorie als Chip/Badge unter dem Dropdown
- "Übernehmen" setzt die Werte im Dropdown, "X" verwirft
- Kein DiffView nötig hier (zu kleinteilig), stattdessen Inline-Suggest

**Im Detail-Panel:**
- Button "Kategorie vorschlagen" (wenn Kategorie leer oder allgemein)
- Button "Zweck vorschlagen" neben dem Verwendungszweck-Feld
- Diese nutzen DiffView (weil mehr Felder betroffen)

**Duplikaterkennung:**
- Beim Speichern einer neuen Ausgabe (Schnellerfassung ODER Detail-Panel)
- Lade die letzten 50 Ausgaben aus der DB
- Rufe detectDuplicate auf
- Wenn isDuplicate=true: Warning-Dialog "Mögliches Duplikat: {reason}. Trotzdem speichern?"
- Die Duplikaterkennung kann auch ohne KI funktionieren (einfacher Vergleich: gleicher Betrag + gleicher Händler + ähnliches Datum ±3 Tage). KI nur als Verbesserung.
- WICHTIG: Implementiere ZUERST den einfachen Duplikat-Check (ohne KI). Wenn KI verfügbar, nutze den KI-Check als Ergänzung.

### 2. Produkt KI-Tab

Finde den KI-Tab im Produkt-Detail-Panel (Text: "KI-Assistent wird in Modul 06 implementiert" oder ähnlich).

Ersetze durch:
- Plattform-Auswahl: Dropdown (Etsy, eBay, Kleinanzeigen) — Default: erste Plattform aus product.platforms oder Etsy
- Sprach-Auswahl: Toggle DE/EN (Default: DE)
- Vier Buttons vertikal:
  - "Titel-Vorschläge generieren" → listingAssistant.generateTitle → DiffView
  - "Beschreibung generieren" (Dropdown: Kurz/Lang) → DiffView
  - "Tags vorschlagen" → DiffView
  - "Bullet Points generieren" → DiffView
- Unter den Buttons: Hinweis "Vorschläge basieren auf den Produktdaten. Für plattformspezifische Anpassungen den Listing-Editor nutzen."
- Optional (nice-to-have): Button "Als neues Listing erstellen" nach Annahme → navigiert zu Listing-Editor mit vorausgefüllten Werten

Die Buttons nutzen den Listing Assistant mit dem Produkt als Kontext (kein Listing nötig). Die Ergebnisse können in die Zwischenablage kopiert oder als neues Listing übernommen werden.

Beim "Annehmen" im DiffView:
- Für Titel: In Zwischenablage kopieren (Toast "Titel in Zwischenablage kopiert") — weil es kein Feld im Produkt gibt das den Listing-Titel speichert
- Für Tags/Description/Bullets: Gleich — Zwischenablage oder "Als Listing erstellen"

### 3. Command Palette erweitern

Registriere einen neuen Command:
- Label: "KI fragen" oder "KI-Assistent"
- Icon: Sparkles (Lucide)
- Aktion: Navigiert zu /ai (KI-Assistent Seite) oder öffnet ein KI-Input-Panel
- Kategorie: "KI"

Schau dir an wie die bestehenden Commands registriert sind (Command Registry Pattern in Foundation). Nutze das gleiche Pattern.

Wenn die AI-Seite aktuell nur ein Platzhalter ist: Lass sie als Platzhalter, aber der Command soll trotzdem navigieren. Die AI-Seite kann in einer späteren Sub-Session oder einem späteren Modul ausgebaut werden.

### 4. Expense Assistant Prompts finalisieren

In `src/features/ai-assistant/agents/expenseAssistant.ts`:

**classifyExpense:**
System: "Du bist ein Buchhalter für ein deutsches Kleinunternehmen (3D-Druck). Klassifiziere Ausgaben in die korrekte Kategorie und Unterkategorie."
User: "Klassifiziere diese Ausgabe:
Händler: {vendor}
Betrag: {amount} EUR
Verwendungszweck: {purpose}

Gültige Kategorien: Filament, Verpackung, Werkzeuge, Druckerzubehör, Maschinen/Hardware, Software/SaaS, Werbung, Versand, Reisekosten, Büro, Sonstiges

Antworte als JSON: { \"category\": \"...\", \"subcategory\": \"...\", \"confidence\": \"high|medium|low\" }"

**suggestPurpose:**
System: [gleich]
User: "Schlage einen kurzen Verwendungszweck vor (max. 50 Zeichen) für:
Händler: {vendor}, Kategorie: {category}
Antworte NUR mit dem Verwendungszweck, ohne Erklärung."

## Dateien die erstellt/geändert werden

ERSTELLEN:
- src/features/expenses/components/[AIClassifyButton o.ä.] (Inline KI-Suggest für Schnellerfassung)
- src/features/products/components/[ProductAITab o.ä.] (KI-Tab Inhalt)

ÄNDERN:
- src/features/expenses/components/[Schnellerfassung-Datei] (KI-Button einfügen)
- src/features/expenses/components/[Detail-Panel-Datei] (KI-Buttons einfügen, Duplikat-Check beim Speichern)
- src/features/products/components/[Detail-Panel-Tabs-Datei] (KI-Tab Platzhalter → ProductAITab)
- src/features/ai-assistant/agents/expenseAssistant.ts (Prompts finalisieren)
- src/components/layout/CommandPalette.tsx oder Command-Registry (neuen Command registrieren)

## NICHT anfassen
- Rust-Code
- Listing-Editor (Sub-Session D ist abgeschlossen)
- Bestehende CRUD-Logik in Ausgaben und Produkten (nur KI-Integration hinzufügen)
- DiffView und AIToolbar (nutzen, nicht ändern)

## Akzeptanzkriterien
- Ausgaben Schnellerfassung: "KI-Vorschlag" Button neben Kategorie → schlägt Kategorie vor
- Ausgaben Detail-Panel: "Kategorie vorschlagen" und "Zweck vorschlagen" funktionieren
- Duplikaterkennung: Warning bei ähnlicher bestehender Ausgabe (einfacher Check + optional KI)
- Produkte KI-Tab: Alle 4 Buttons funktionieren → DiffView → Zwischenablage
- Command Palette: "KI fragen" ist registriert und navigiert
- Alle KI-Calls werden in ai_jobs geloggt
- Buttons disabled wenn kein Provider verfügbar
- `npm run tauri dev` startet, alles funktioniert zusammen
- TypeScript strict, ESLint, Prettier ohne Fehler

## Git Commit
```
feat(mod-06): expense assistant + product AI tab + command palette
```
```

---

## Sub-Session F: Polish, Fallback-Logik, Kosten-Limit, Abschluss

### Prompt für Codex:

```
## Pflichtlektüre (LIES DIESE DATEIEN ZUERST)

1. AGENTS.md
2. docs/specs/MODUL_06_KI_ARCHITEKTUR.md (Abschnitt 13 Akzeptanzkriterien — ALLE müssen erfüllt sein)
3. docs/specs/MODUL_06_ENTSCHEIDUNGEN.md (Abschnitt 2.6 Kosten, 2.7 Ollama, Abschnitt 5 Risiken)
4. Alle Dateien unter src/features/ai-assistant/ (komplett lesen)
5. src/components/shared/DiffView.tsx
6. src/features/expenses/ (KI-Integration prüfen)
7. src/features/products/ (KI-Tab prüfen)
8. src/features/listings/ (KI-Toolbar prüfen)
9. src/features/settings/ (KI-Settings prüfen)

## Aufgabe

Abschluss-Session für Modul 06. Alles soll poliert, getestet und stabil sein. Fokus: Fallback-Logik, Kosten-Limit-Durchsetzung, Edge Cases, Code-Cleanup.

## Was zu tun ist

### 1. Fallback-Logik verifizieren und härten

In aiStore.ts oder aiService.ts:

Die Fallback-Kette muss so funktionieren:
1. Bevorzugter Provider (aus app_settings `ai_preferred_provider`)
2. Falls nicht verfügbar: nächster Cloud-Provider (Claude → OpenAI oder umgekehrt)
3. Falls kein Cloud-Provider: Ollama
4. Falls gar nichts: null → alle KI-Buttons disabled

"Verfügbar" bedeutet:
- Für Claude/OpenAI: API-Key im Keychain vorhanden
- Für Ollama: Endpoint erreichbar (Quick-Check, kein langer Timeout)

Prüfe: Wird die Fallback-Kette bei JEDEM KI-Call durchlaufen oder nur beim App-Start?
Empfehlung: Beim App-Start UND bei Fehler eines Calls (wenn Provider 503 zurückgibt → automatisch Fallback versuchen).

Implementiere:
- Timeout für API-Calls: 30 Sekunden, dann Abbruch + Fehler
- Bei HTTP-Fehler (401, 403): "API-Key ungültig" Meldung, Provider als unavailable markieren
- Bei HTTP-Fehler (429): "Rate Limit erreicht, bitte warten" Meldung
- Bei HTTP-Fehler (500, 503): "Provider nicht erreichbar" → Fallback auf nächsten Provider
- Bei Netzwerk-Fehler: "Keine Internetverbindung" (für Cloud) bzw. "Ollama nicht erreichbar" (für lokal)

### 2. Kosten-Limit durchsetzen

In costTracker.ts und useAI.ts:

VOR jedem KI-Call:
```typescript
const budget = await checkBudget();
if (budget.isBlocked) {
  // Dialog anzeigen: "KI-Budget für diesen Monat erreicht (X.XX / Y.XX EUR). 
  //                   Limit in Einstellungen anpassen oder nächsten Monat abwarten.
  //                   Ollama-Calls sind kostenlos und nicht vom Limit betroffen."
  // Call NICHT ausführen (außer Provider ist Ollama)
  return;
}
if (budget.isWarning) {
  // Kein Block, aber AIStatusBadge zeigt gelbe Warnung
}
```

NACH jedem KI-Call:
```typescript
// Budget im Store aktualisieren
await aiStore.getState().refreshBudget();
```

Ollama-Calls zählen NICHT gegen das Limit (Kosten = 0).

### 3. Edge Cases abfangen

Prüfe und fixe folgende Szenarien:

**Leere/ungültige Responses:**
- Provider gibt leeren String zurück → "KI hat keine Antwort generiert. Bitte erneut versuchen."
- JSON-Mode aber Response ist kein valides JSON → Fehler abfangen, nicht crashen
- generateTags gibt keine Array zurück → Fallback auf leeres Array

**User-Interaktionen:**
- User klickt KI-Button doppelt schnell → Debounce oder Loading-Lock (zweiter Click wird ignoriert)
- User schließt DiffView während Call läuft → Call im Hintergrund abbrechen (oder laufen lassen und Ergebnis verwerfen)
- User wechselt die Seite während Call läuft → Cleanup

**Fehlermeldungen:**
- Alle Fehlermeldungen auf Deutsch (der User spricht Deutsch)
- Format: Toast/Notification, nicht Alert/Confirm (nicht blockierend)
- Beispiele:
  - "KI-Verbindung fehlgeschlagen: API-Key ungültig"
  - "KI-Vorschlag konnte nicht generiert werden: Timeout"
  - "Ollama ist nicht erreichbar. Ist Ollama installiert und gestartet?"
  - "KI-Budget erschöpft (8.50 / 10.00 EUR)"

### 4. Code-Cleanup

- [ ] Alle alten KI-Platzhalter-Texte entfernt ("KI-Assistent wird in Modul 06 implementiert" etc.)
- [ ] Keine console.log() Statements (außer in Entwicklung, hinter Feature-Flag)
- [ ] Keine unused imports
- [ ] Keine any-Types (prüfe mit `grep -r ": any" src/features/ai-assistant/`)
- [ ] Alle try/catch vorhanden bei invoke() Calls
- [ ] Alle async Funktionen haben Error-Handling
- [ ] Loading States korrekt gesetzt (Loading Start UND Ende in finally-Block)
- [ ] ESLint: `npx eslint src/features/ai-assistant/ --max-warnings 0`
- [ ] Prettier: `npx prettier --check src/features/ai-assistant/`
- [ ] TypeScript: `npx tsc --noEmit`

### 5. Finaler Integrations-Check

Gehe durch JEDEN Akzeptanzpunkt aus der Spec (Abschnitt 13) und prüfe:

- [ ] Provider konfigurierbar und testbar (Settings)
- [ ] Ollama funktioniert, Modelle werden gelistet
- [ ] API-Keys im Keychain, nicht in DB
- [ ] Listing Assistant: Titel, Beschreibung, Tags, Bullets
- [ ] DiffView: Annehmen, Ablehnen, Bearbeiten
- [ ] Expense Assistant: Kategorie-Vorschlag
- [ ] Duplikaterkennung bei Ausgaben
- [ ] KI-Buttons disabled ohne Provider
- [ ] ai_jobs Logging bei jedem Call
- [ ] Brand No-Go-Phrasen werden beachtet
- [ ] Fallback-Logik funktioniert
- [ ] Monatslimit wird angezeigt und bei Überschreitung blockiert
- [ ] Produkt KI-Tab funktional
- [ ] Listing KI-Toolbar funktional
- [ ] Ausgaben KI-Klassifikation funktional
- [ ] Command Palette: "KI fragen"
- [ ] TypeScript strict, ESLint, Prettier

## Dateien die geändert werden

Potentiell ALLE Dateien aus Sub-Sessions A–E. Keine neuen Dateien, nur Fixes und Polish.

## Akzeptanzkriterien

ALLE Punkte aus Modul 06 Spec Abschnitt 13 müssen erfüllt sein. Zusätzlich:
- Keine TypeScript-Fehler (`npx tsc --noEmit`)
- Keine ESLint-Fehler (`npx eslint src/ --max-warnings 0`)
- Keine Prettier-Fehler (`npx prettier --check src/`)
- `npm run tauri dev` startet ohne Fehler
- App funktioniert auch wenn KEIN Provider konfiguriert ist (Graceful Degradation)
- App funktioniert auch wenn Ollama NICHT installiert ist

## Git Commits
```
feat(mod-06): polish, fallback logic, cost limit enforcement
```

Nach dem letzten Commit:
```
git tag module-06-complete
```
```

---

## Checkliste nach allen Sub-Sessions

Bevor Merge auf main:

1. `npm run tauri dev` startet ohne Fehler
2. Alle 13 Akzeptanzkriterien aus der Spec sind erfüllt
3. `npx tsc --noEmit` — keine TypeScript-Fehler
4. `npx eslint src/ --max-warnings 0` — keine ESLint-Fehler
5. `npx prettier --check src/` — keine Prettier-Fehler
6. `cargo build` — keine Rust-Fehler
7. Git-Log zeigt 6 saubere Commits auf feat/modul-06-ki-architektur
8. Tag `module-06-complete` gesetzt
9. PR erstellen und auf main mergen
10. PROJEKTREGELN.md aktualisieren: Modul 06 Status → ✅ Abgeschlossen
