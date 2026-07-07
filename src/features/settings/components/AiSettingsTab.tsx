import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  apiKeyDelete,
  apiKeyGet,
  apiKeySet,
  aiListOllamaModels,
  aiTestConnection,
  keychainDelete,
  keychainGet,
  keychainSet,
} from '@/features/ai-assistant/services/aiService';
import { useAIStore } from '@/features/ai-assistant/stores/aiStore';
import type { AIProviderName } from '@/features/ai-assistant/types';
import { cn } from '@/lib/utils';
import { normalizeGeminiModel } from '@/services/ai';
import { getDatabase } from '@/services/database';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { useAutoSave } from '../hooks/useAutoSave';

type CloudProvider = 'claude' | 'openai' | 'gemini';
type ProviderStatusState = 'idle' | 'loading' | 'success' | 'error';
type OperationMode = 'suggest_only' | 'suggest_confirm';
type AIJobStatus = 'success' | 'error' | 'cancelled';
type ProviderFilter = 'all' | AIProviderName;
type AgentFilter =
  | 'all'
  | 'listing_assistant'
  | 'expense_assistant'
  | 'product_assistant'
  | 'task_extractor'
  | 'dashboard_analyst'
  | 'product_analyst'
  | 'template_assistant';
type StatusFilter = 'all' | 'success' | 'error';

interface ProviderStatus {
  state: ProviderStatusState;
  message: string;
}

interface ApiKeyState {
  hasKey: boolean;
  masked: string;
  draft: string;
  editing: boolean;
}

interface AISettingsState {
  preferredProvider: AIProviderName;
  claudeModel: string;
  openaiModel: string;
  geminiModel: string;
  ollamaModel: string;
  ollamaEndpoint: string;
  monthlyLimit: number;
  loggingEnabled: boolean;
  operationMode: OperationMode;
}

interface AIJob {
  id: string;
  provider: AIProviderName;
  model: string;
  agent: string;
  action: string;
  input: string | null;
  output: string | null;
  tokens_used: number | string | null;
  duration_ms: number | string | null;
  status: AIJobStatus;
  error_message: string | null;
  estimated_cost: number | string | null;
  created_at: string;
}

interface SummaryRow {
  total_cost: number | string | null;
  call_count: number | string | null;
}

const PROVIDERS: Array<{ value: AIProviderName; label: string }> = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini (Google AI Studio)' },
  { value: 'ollama', label: 'Ollama' },
];

const CLAUDE_MODELS = ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini'];
const GEMINI_MODELS = [
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — empfohlen' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview) — leistungsstark' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite — schnell & günstig' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — bewährt' },
];
const OLLAMA_MODEL_SUGGESTIONS = ['llama3', 'mistral', 'phi3'];
const PAGE_SIZE = 25;

const DEFAULT_AI_SETTINGS: AISettingsState = {
  preferredProvider: DEFAULTS.ai_preferred_provider,
  claudeModel: DEFAULTS.ai_preferred_model_claude,
  openaiModel: DEFAULTS.ai_preferred_model_openai,
  geminiModel: DEFAULTS.ai_preferred_model_gemini,
  ollamaModel: DEFAULTS.ai_preferred_model_ollama,
  ollamaEndpoint: DEFAULTS.ollama_endpoint,
  monthlyLimit: DEFAULTS.ai_cost_limit_monthly,
  loggingEnabled: DEFAULTS.ai_logging_enabled,
  operationMode: DEFAULTS.ai_operation_mode,
};

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function truncate(value: string | null, maxLength = 500): string {
  if (!value) return 'Kein Inhalt';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function maskKey(key: string | null): string {
  if (!key) return '';
  return `••••••••${key.slice(0, 8)}...`;
}

function keyName(provider: CloudProvider): string {
  if (provider === 'gemini') return 'ai_gemini';
  return `${provider}_api_key`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDuration(value: number | string | null): string {
  const durationMs = numberValue(value);
  if (durationMs <= 0) return '-';
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function currentMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start">
      <div className="space-y-1 pt-1">
        <Label className="text-sm font-medium text-text-primary">{label}</Label>
        {hint ? <p className="text-xs leading-5 text-text-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SwitchControl({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-fit items-center gap-3 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-pg-accent' : 'bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (!status.message) return null;
  if (status.state === 'loading') {
    return (
      <Badge variant="outline" className="border-warning text-warning">
        <Loader2 className="size-3 animate-spin" />
        Teste...
      </Badge>
    );
  }
  if (status.state === 'success') {
    return (
      <Badge variant="outline" className="border-success text-success">
        <CheckCircle2 className="size-3" />
        Verbunden
      </Badge>
    );
  }
  if (status.state === 'error') {
    return (
      <Badge variant="destructive" title={status.message}>
        <XCircle className="size-3" />
        Fehler
      </Badge>
    );
  }
  return <p className="text-xs text-text-secondary">{status.message}</p>;
}

export function AiSettingsTab() {
  const { scheduleSave } = useAutoSave();
  const initializeAI = useAIStore((state) => state.initialize);
  const refreshBudget = useAIStore((state) => state.refreshBudget);
  const [settings, setSettings] = useState<AISettingsState>(DEFAULT_AI_SETTINGS);
  const [claudeKey, setClaudeKey] = useState<ApiKeyState>({
    hasKey: false,
    masked: '',
    draft: '',
    editing: false,
  });
  const [openaiKey, setOpenaiKey] = useState<ApiKeyState>({
    hasKey: false,
    masked: '',
    draft: '',
    editing: false,
  });
  const [geminiKey, setGeminiKey] = useState<ApiKeyState>({
    hasKey: false,
    masked: '',
    draft: '',
    editing: false,
  });
  const [expandedProvider, setExpandedProvider] = useState<AIProviderName | null>('claude');
  const [providerStatus, setProviderStatus] = useState<Record<AIProviderName, ProviderStatus>>({
    claude: { state: 'idle', message: '' },
    openai: { state: 'idle', message: '' },
    gemini: { state: 'idle', message: '' },
    ollama: { state: 'idle', message: '' },
  });
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [summary, setSummary] = useState({ cost: 0, count: 0 });
  const [selectedJob, setSelectedJob] = useState<AIJob | null>(null);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [
          preferredProvider,
          claudeModel,
          openaiModel,
          geminiModel,
          ollamaModel,
          legacyOllamaModel,
          endpoint,
          legacyEndpoint,
          monthlyLimit,
          legacyMonthlyLimit,
          loggingEnabled,
          operationMode,
          legacyOperationMode,
          storedClaudeKey,
          storedOpenaiKey,
          storedGeminiKey,
        ] = await Promise.all([
          getSettingWithDefault('ai_preferred_provider'),
          getSettingWithDefault('ai_preferred_model_claude'),
          getSettingWithDefault('ai_preferred_model_openai'),
          getSettingWithDefault('ai_preferred_model_gemini'),
          getSettingWithDefault('ai_preferred_model_ollama'),
          getSettingWithDefault('ai_ollama_model'),
          getSettingWithDefault('ollama_endpoint'),
          getSettingWithDefault('ai_ollama_endpoint'),
          getSettingWithDefault('ai_cost_limit_monthly'),
          getSettingWithDefault('ai_monthly_limit_eur'),
          getSettingWithDefault('ai_logging_enabled'),
          getSettingWithDefault('ai_operation_mode'),
          getSettingWithDefault('ai_mode'),
          keychainGet(keyName('claude')),
          keychainGet(keyName('openai')),
          apiKeyGet('gemini'),
        ]);

        if (cancelled) return;
        setSettings({
          preferredProvider,
          claudeModel,
          openaiModel,
          // Migration alter gespeicherter Gemini-Modellnamen (z.B. gemini-2.0-flash)
          geminiModel: normalizeGeminiModel(geminiModel),
          ollamaModel:
            ollamaModel === DEFAULTS.ai_preferred_model_ollama &&
            legacyOllamaModel !== DEFAULTS.ai_ollama_model
              ? legacyOllamaModel
              : ollamaModel,
          ollamaEndpoint:
            endpoint === DEFAULTS.ollama_endpoint && legacyEndpoint !== DEFAULTS.ai_ollama_endpoint
              ? legacyEndpoint
              : endpoint,
          monthlyLimit:
            monthlyLimit === DEFAULTS.ai_cost_limit_monthly &&
            legacyMonthlyLimit !== DEFAULTS.ai_monthly_limit_eur
              ? legacyMonthlyLimit
              : monthlyLimit,
          loggingEnabled,
          operationMode:
            operationMode === DEFAULTS.ai_operation_mode && legacyOperationMode !== DEFAULTS.ai_mode
              ? (legacyOperationMode as OperationMode)
              : (operationMode as OperationMode),
        });
        setClaudeKey({
          hasKey: Boolean(storedClaudeKey),
          masked: maskKey(storedClaudeKey),
          draft: '',
          editing: false,
        });
        setOpenaiKey({
          hasKey: Boolean(storedOpenaiKey),
          masked: maskKey(storedOpenaiKey),
          draft: '',
          editing: false,
        });
        setGeminiKey({
          hasKey: Boolean(storedGeminiKey),
          masked: maskKey(storedGeminiKey),
          draft: '',
          editing: false,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'KI-Einstellungen konnten nicht geladen werden',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        const [jobRows, summaryRows] = await Promise.all([
          getDatabase().select<AIJob[]>(
            `SELECT *
             FROM ai_jobs
             ORDER BY created_at DESC
             LIMIT 100`,
          ),
          getDatabase().select<SummaryRow[]>(
            `SELECT SUM(estimated_cost) AS total_cost, COUNT(*) AS call_count
             FROM ai_jobs
             WHERE substr(created_at, 1, 7) = $1`,
            [currentMonthPrefix()],
          ),
        ]);
        if (cancelled) return;
        setJobs(jobRows);
        setSummary({
          cost: numberValue(summaryRows[0]?.total_cost),
          count: numberValue(summaryRows[0]?.call_count),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'KI-Protokoll konnte nicht laden');
      }
    }

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateSetting<K extends keyof AISettingsState>(
    key: K,
    value: AISettingsState[K],
    settingKey: string,
    aliases: string[] = [],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    scheduleSave(settingKey, value, { aliases });
  }

  function statusFor(provider: AIProviderName, status: ProviderStatus) {
    setProviderStatus((current) => ({ ...current, [provider]: status }));
  }

  async function saveApiKey(provider: CloudProvider) {
    const keyState =
      provider === 'claude' ? claudeKey : provider === 'openai' ? openaiKey : geminiKey;
    const setKeyState =
      provider === 'claude' ? setClaudeKey : provider === 'openai' ? setOpenaiKey : setGeminiKey;
    const key = keyState.draft.trim();
    if (!key) {
      statusFor(provider, { state: 'error', message: 'Bitte API-Key eingeben.' });
      return;
    }

    statusFor(provider, { state: 'loading', message: 'API-Key wird gespeichert...' });
    try {
      if (provider === 'gemini') {
        await apiKeySet('gemini', key);
      } else {
        await keychainSet(keyName(provider), key);
      }
      setKeyState({ hasKey: true, masked: maskKey(key), draft: '', editing: false });
      statusFor(provider, { state: 'success', message: 'API-Key gespeichert.' });
      await initializeAI();
    } catch (error) {
      statusFor(provider, {
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function deleteApiKey(provider: CloudProvider) {
    const label = provider === 'claude' ? 'Claude' : provider === 'openai' ? 'OpenAI' : 'Gemini';
    if (!window.confirm(`${label} API-Key wirklich löschen?`)) {
      return;
    }

    const setKeyState =
      provider === 'claude' ? setClaudeKey : provider === 'openai' ? setOpenaiKey : setGeminiKey;
    statusFor(provider, { state: 'loading', message: 'API-Key wird gelöscht...' });
    try {
      if (provider === 'gemini') {
        await apiKeyDelete('gemini');
      } else {
        await keychainDelete(keyName(provider));
      }
      setKeyState({ hasKey: false, masked: '', draft: '', editing: true });
      statusFor(provider, { state: 'success', message: 'API-Key gelöscht.' });
      await initializeAI();
    } catch (error) {
      statusFor(provider, {
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function testProvider(provider: AIProviderName) {
    statusFor(provider, { state: 'loading', message: 'Teste Verbindung...' });
    try {
      if (provider === 'ollama') {
        const models = await aiListOllamaModels(settings.ollamaEndpoint.trim());
        statusFor(provider, {
          state: 'success',
          message:
            models.length > 0
              ? `${models.length} Modelle gefunden.`
              : 'Ollama erreichbar, keine Modelle gefunden.',
        });
      } else {
        const model = await aiTestConnection(provider);
        statusFor(provider, { state: 'success', message: `Verbunden: ${model}` });
      }
      await initializeAI();
    } catch (error) {
      statusFor(provider, {
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (providerFilter !== 'all' && job.provider !== providerFilter) return false;
        if (agentFilter !== 'all' && job.agent !== agentFilter) return false;
        if (statusFilter !== 'all' && job.status !== statusFilter) return false;
        return true;
      }),
    [agentFilter, jobs, providerFilter, statusFilter],
  );

  const columns = useMemo<ColumnDef<AIJob>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Datum',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        accessorKey: 'agent',
        header: 'Agent',
        cell: ({ row }) => <Badge variant="outline">{row.original.agent}</Badge>,
      },
      { accessorKey: 'action', header: 'Aktion' },
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ row }) => <Badge variant="secondary">{row.original.provider}</Badge>,
      },
      { accessorKey: 'model', header: 'Modell' },
      {
        accessorKey: 'tokens_used',
        header: 'Tokens',
        cell: ({ row }) => numberValue(row.original.tokens_used).toLocaleString('de-DE'),
      },
      {
        accessorKey: 'estimated_cost',
        header: 'Kosten',
        cell: ({ row }) => formatEUR(numberValue(row.original.estimated_cost)),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'success' ? 'outline' : 'destructive'}
            className={row.original.status === 'success' ? 'border-success text-success' : ''}
          >
            {row.original.status === 'success' ? 'Erfolg' : 'Fehler'}
          </Badge>
        ),
      },
      {
        accessorKey: 'duration_ms',
        header: 'Dauer',
        cell: ({ row }) => formatDuration(row.original.duration_ms),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredJobs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: PAGE_SIZE,
      },
    },
  });

  function renderApiKeyControls(provider: CloudProvider, state: ApiKeyState) {
    const setKeyState =
      provider === 'claude' ? setClaudeKey : provider === 'openai' ? setOpenaiKey : setGeminiKey;
    if (state.hasKey && !state.editing) {
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={state.masked} readOnly className="font-mono" />
          <Button
            type="button"
            variant="outline"
            onClick={() => setKeyState((current) => ({ ...current, editing: true, draft: '' }))}
          >
            Ändern
          </Button>
          <Button type="button" variant="ghost" onClick={() => void deleteApiKey(provider)}>
            <Trash2 className="size-4 text-danger" />
            Löschen
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="password"
          value={state.draft}
          placeholder="API-Key eingeben"
          onChange={(event) =>
            setKeyState((current) => ({ ...current, draft: event.target.value }))
          }
        />
        <Button type="button" onClick={() => void saveApiKey(provider)}>
          Speichern
        </Button>
        {state.hasKey ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setKeyState((current) => ({ ...current, editing: false, draft: '' }))}
          >
            Abbrechen
          </Button>
        ) : null}
      </div>
    );
  }

  function renderProviderPanel(provider: AIProviderName) {
    const isOpen = expandedProvider === provider;
    const label = PROVIDERS.find((item) => item.value === provider)?.label ?? provider;
    return (
      <div className="rounded-lg border border-border bg-bg-primary">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setExpandedProvider(isOpen ? null : provider)}
        >
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          <span className="flex items-center gap-2">
            <StatusBadge status={providerStatus[provider]} />
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </button>
        {isOpen ? (
          <div className="space-y-4 border-t border-border p-4">
            {provider === 'claude' ? (
              <>
                <FieldRow label="API-Key">{renderApiKeyControls('claude', claudeKey)}</FieldRow>
                <FieldRow label="Bevorzugtes Modell">
                  <Select
                    value={settings.claudeModel}
                    onValueChange={(value) => {
                      if (value) updateSetting('claudeModel', value, 'ai_preferred_model_claude');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLAUDE_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            ) : null}

            {provider === 'openai' ? (
              <>
                <FieldRow label="API-Key">{renderApiKeyControls('openai', openaiKey)}</FieldRow>
                <FieldRow label="Bevorzugtes Modell">
                  <Select
                    value={settings.openaiModel}
                    onValueChange={(value) => {
                      if (value) updateSetting('openaiModel', value, 'ai_preferred_model_openai');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </>
            ) : null}

            {provider === 'gemini' ? (
              <>
                <FieldRow label="API-Key">{renderApiKeyControls('gemini', geminiKey)}</FieldRow>
                <FieldRow label="Bevorzugtes Modell">
                  <Select
                    value={settings.geminiModel}
                    onValueChange={(value) => {
                      if (value) updateSetting('geminiModel', value, 'ai_preferred_model_gemini');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GEMINI_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
                <p className="text-xs text-text-secondary">
                  API-Key kostenlos erstellen:{' '}
                  <button
                    type="button"
                    className="text-pg-accent underline-offset-2 hover:underline"
                    onClick={() => void openUrl('https://aistudio.google.com')}
                  >
                    aistudio.google.com
                  </button>
                </p>
              </>
            ) : null}

            {provider === 'ollama' ? (
              <>
                <FieldRow label="Endpoint-URL">
                  <Input
                    value={settings.ollamaEndpoint}
                    onChange={(event) =>
                      updateSetting('ollamaEndpoint', event.target.value, 'ollama_endpoint', [
                        'ai_ollama_endpoint',
                      ])
                    }
                  />
                </FieldRow>
                <FieldRow label="Modell">
                  <div className="space-y-2">
                    <Input
                      list="ollama-model-suggestions"
                      value={settings.ollamaModel}
                      onChange={(event) =>
                        updateSetting(
                          'ollamaModel',
                          event.target.value,
                          'ai_preferred_model_ollama',
                          ['ai_ollama_model'],
                        )
                      }
                    />
                    <datalist id="ollama-model-suggestions">
                      {OLLAMA_MODEL_SUGGESTIONS.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  </div>
                </FieldRow>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={providerStatus[provider].state === 'loading'}
                onClick={() => void testProvider(provider)}
              >
                {providerStatus[provider].state === 'loading' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Verbindung testen
              </Button>
              {providerStatus[provider].state === 'error' ? (
                <p className="text-xs text-danger">{providerStatus[provider].message}</p>
              ) : providerStatus[provider].state === 'success' ? (
                <p className="text-xs text-success">{providerStatus[provider].message}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-text-secondary">KI-Einstellungen werden geladen...</div>;
  }

  return (
    <div className="space-y-5">
      <Section title="KI-Provider">
        <FieldRow label="Bevorzugter Provider">
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => {
              const isActive = settings.preferredProvider === provider.value;
              return (
                <button
                  key={provider.value}
                  type="button"
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-pg-accent bg-pg-accent-subtle text-text-primary'
                      : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-hover',
                  )}
                  onClick={() =>
                    updateSetting('preferredProvider', provider.value, 'ai_preferred_provider')
                  }
                >
                  {provider.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <div className="space-y-3">
          {renderProviderPanel('claude')}
          {renderProviderPanel('openai')}
          {renderProviderPanel('gemini')}
          {renderProviderPanel('ollama')}
        </div>
      </Section>

      <Section title="KI-Einstellungen">
        <FieldRow label="Monatliches Kostenlimit">
          <div className="relative max-w-48">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={settings.monthlyLimit}
              className="pr-12"
              onChange={(event) =>
                updateSetting('monthlyLimit', Number(event.target.value), 'ai_cost_limit_monthly', [
                  'ai_monthly_limit_eur',
                ])
              }
              onBlur={() => void refreshBudget()}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">
              EUR
            </span>
          </div>
        </FieldRow>
        <FieldRow label="KI-Logging">
          <SwitchControl
            checked={settings.loggingEnabled}
            label={settings.loggingEnabled ? 'Aktiv' : 'Inaktiv'}
            onCheckedChange={(checked) =>
              updateSetting('loggingEnabled', checked, 'ai_logging_enabled')
            }
          />
        </FieldRow>
        <FieldRow label="Betriebsmodus">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'suggest_only' as const, label: 'Nur Vorschläge' },
              { value: 'suggest_confirm' as const, label: 'Vorschlag + Bestätigung' },
            ].map((option) => {
              const isActive = settings.operationMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-pg-accent bg-pg-accent-subtle text-text-primary'
                      : 'border-border bg-bg-primary text-text-secondary hover:bg-bg-hover',
                  )}
                  onClick={() =>
                    updateSetting('operationMode', option.value, 'ai_operation_mode', ['ai_mode'])
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FieldRow>
      </Section>

      <Section title="KI-Protokoll">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-bg-primary p-4">
            <p className="text-xs text-text-secondary">Kosten diesen Monat</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {formatEUR(summary.cost)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-bg-primary p-4">
            <p className="text-xs text-text-secondary">Aufrufe diesen Monat</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {summary.count.toLocaleString('de-DE')}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            value={providerFilter}
            items={{
              all: 'Alle Provider',
              claude: 'Claude',
              openai: 'OpenAI',
              gemini: 'Gemini',
              ollama: 'Ollama',
            }}
            onValueChange={(value) => setProviderFilter(value as ProviderFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Provider</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={agentFilter}
            items={{ all: 'Alle Agents' }}
            onValueChange={(value) => setAgentFilter(value as AgentFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Agents</SelectItem>
              <SelectItem value="listing_assistant">listing_assistant</SelectItem>
              <SelectItem value="expense_assistant">expense_assistant</SelectItem>
              <SelectItem value="product_assistant">product_assistant</SelectItem>
              <SelectItem value="task_extractor">task_extractor</SelectItem>
              <SelectItem value="dashboard_analyst">dashboard_analyst</SelectItem>
              <SelectItem value="product_analyst">product_analyst</SelectItem>
              <SelectItem value="template_assistant">template_assistant</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            items={{ all: 'Alle Status', success: 'Erfolg', error: 'Fehler' }}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="success">Erfolg</SelectItem>
              <SelectItem value="error">Fehler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 font-medium">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-8 text-center text-text-secondary"
                  >
                    Keine KI-Protokolle vorhanden
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-bg-hover"
                    onClick={() => setSelectedJob(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="max-w-40 truncate px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
          <span>
            Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount() || 1}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Zurück
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Weiter
            </Button>
          </div>
        </div>
      </Section>

      <Dialog open={selectedJob !== null} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>KI-Protokoll Details</DialogTitle>
            <DialogDescription>
              {selectedJob ? `${selectedJob.agent} / ${selectedJob.action}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedJob ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-border bg-bg-primary p-3 text-xs text-text-secondary sm:grid-cols-2">
                <p>Provider: {selectedJob.provider}</p>
                <p>Modell: {selectedJob.model}</p>
                <p>Status: {selectedJob.status}</p>
                <p>Dauer: {formatDuration(selectedJob.duration_ms)}</p>
                <p>Tokens: {numberValue(selectedJob.tokens_used).toLocaleString('de-DE')}</p>
                <p>Kosten: {formatEUR(numberValue(selectedJob.estimated_cost))}</p>
              </div>
              {selectedJob.error_message ? (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-danger">Fehler</h3>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-bg-primary p-3 text-xs text-text-primary">
                    {selectedJob.error_message}
                  </pre>
                </div>
              ) : null}
              <div>
                <h3 className="mb-1 text-sm font-semibold text-text-primary">Input</h3>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-primary p-3 text-xs text-text-primary">
                  {truncate(selectedJob.input)}
                </pre>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-text-primary">Output</h3>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-primary p-3 text-xs text-text-primary">
                  {truncate(selectedJob.output)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
