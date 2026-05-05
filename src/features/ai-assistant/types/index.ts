export type AIProviderName = 'claude' | 'openai' | 'ollama';

export type AIAgentName = 'listing_assistant' | 'expense_assistant' | 'product_analyst';

export type ListingAction =
  | 'generate_title'
  | 'generate_description'
  | 'generate_tags'
  | 'generate_bullet_points'
  | 'rewrite_for_platform';

export type ExpenseAction = 'classify_expense' | 'detect_duplicate' | 'suggest_purpose';

export type AIAction = ListingAction | ExpenseAction;

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
  jobId?: string;
}

export interface AIStatus {
  activeProvider: AIProviderName | null;
  availableProviders: AIProviderName[];
  monthlySpent: number;
  monthlyLimit: number;
  isLimitReached: boolean;
  isLoading: boolean;
  error: string | null;
}

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

export interface AIJobLogInput {
  provider: AIProviderName;
  model: string;
  agent: AIAgentName;
  action: AIAction;
  input: string;
  output: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  status: 'success' | 'error' | 'cancelled';
  errorMessage?: string | null;
  estimatedCost?: number | null;
}
