import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSetting, setSetting } from '@/services/database';
import {
  aiListOllamaModels,
  aiTestConnection,
  keychainDelete,
  keychainGet,
  keychainSet,
} from '../services/aiService';
import { useAIStore } from '../stores/aiStore';
import type { AIProviderName } from '../types';

type ProviderStatus = {
  state: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

const PROVIDER_OPTIONS: { value: AIProviderName; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama' },
];

const DEFAULT_ENDPOINT = 'http://localhost:11434';

function idleStatus(message = ''): ProviderStatus {
  return { state: 'idle', message };
}

function StatusLine({ status }: { status: ProviderStatus }) {
  if (!status.message) return null;

  const className =
    status.state === 'success'
      ? 'text-success'
      : status.state === 'error'
        ? 'text-danger'
        : 'text-text-secondary';

  return <p className={`text-xs ${className}`}>{status.message}</p>;
}

export function ProviderSettings() {
  const initializeAI = useAIStore((state) => state.initialize);
  const refreshBudget = useAIStore((state) => state.refreshBudget);
  const monthlySpent = useAIStore((state) => state.monthlySpent);
  const monthlyLimitStore = useAIStore((state) => state.monthlyLimit);

  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeSaved, setClaudeSaved] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<ProviderStatus>(idleStatus());
  const [openaiStatus, setOpenaiStatus] = useState<ProviderStatus>(idleStatus());
  const [geminiStatus, setGeminiStatus] = useState<ProviderStatus>(idleStatus());
  const [ollamaStatus, setOllamaStatus] = useState<ProviderStatus>(idleStatus());
  const [preferredProvider, setPreferredProvider] = useState<AIProviderName>('ollama');
  const [monthlyLimit, setMonthlyLimit] = useState('10');
  const [ollamaEndpoint, setOllamaEndpoint] = useState(DEFAULT_ENDPOINT);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModel, setOllamaModel] = useState('');
  const [settingsStatus, setSettingsStatus] = useState<ProviderStatus>(idleStatus());

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [
          storedClaudeKey,
          storedOpenaiKey,
          storedGeminiKey,
          storedProvider,
          storedLimit,
          storedEndpoint,
          storedModel,
        ] = await Promise.all([
          keychainGet('claude_api_key'),
          keychainGet('openai_api_key'),
          keychainGet('ai_gemini'),
          getSetting<AIProviderName>('ai_preferred_provider'),
          getSetting<number>('ai_monthly_limit_eur'),
          getSetting<string>('ai_ollama_endpoint'),
          getSetting<string>('ai_ollama_model'),
        ]);

        if (!isMounted) return;

        setClaudeSaved(Boolean(storedClaudeKey));
        setOpenaiSaved(Boolean(storedOpenaiKey));
        setGeminiSaved(Boolean(storedGeminiKey));
        setClaudeStatus(idleStatus(storedClaudeKey ? 'API-Key gespeichert' : 'Kein API-Key'));
        setOpenaiStatus(idleStatus(storedOpenaiKey ? 'API-Key gespeichert' : 'Kein API-Key'));
        setGeminiStatus(idleStatus(storedGeminiKey ? 'API-Key gespeichert' : 'Kein API-Key'));
        setPreferredProvider(storedProvider ?? 'ollama');
        setMonthlyLimit(String(storedLimit ?? monthlyLimitStore ?? 10));
        setOllamaEndpoint(storedEndpoint ?? DEFAULT_ENDPOINT);
        setOllamaModel(storedModel ?? '');
      } catch (error) {
        if (!isMounted) return;
        setSettingsStatus({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void loadSettings();
    void refreshBudget();

    return () => {
      isMounted = false;
    };
  }, [monthlyLimitStore, refreshBudget]);

  const monthlySpentLabel = useMemo(
    () => `${monthlySpent.toFixed(2)} von ${Number(monthlyLimit || 0).toFixed(2)} EUR`,
    [monthlyLimit, monthlySpent],
  );

  const budgetPercent = useMemo(() => {
    const limit = Number(monthlyLimit);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.min(100, Math.round((monthlySpent / limit) * 100));
  }, [monthlyLimit, monthlySpent]);

  async function saveApiKey(provider: 'claude' | 'openai' | 'gemini') {
    const key =
      provider === 'claude'
        ? claudeKey.trim()
        : provider === 'openai'
          ? openaiKey.trim()
          : geminiKey.trim();
    const setStatus =
      provider === 'claude'
        ? setClaudeStatus
        : provider === 'openai'
          ? setOpenaiStatus
          : setGeminiStatus;
    const setSaved =
      provider === 'claude'
        ? setClaudeSaved
        : provider === 'openai'
          ? setOpenaiSaved
          : setGeminiSaved;
    const clearKey =
      provider === 'claude' ? setClaudeKey : provider === 'openai' ? setOpenaiKey : setGeminiKey;

    if (!key) {
      setStatus({ state: 'error', message: 'Bitte API-Key eingeben.' });
      return;
    }

    setStatus({ state: 'loading', message: 'Speichere API-Key...' });
    try {
      await keychainSet(provider === 'gemini' ? 'ai_gemini' : `${provider}_api_key`, key);
      setSaved(true);
      clearKey('');
      setStatus({ state: 'success', message: 'API-Key gespeichert.' });
      await initializeAI();
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function deleteApiKey(provider: 'claude' | 'openai' | 'gemini') {
    const setStatus =
      provider === 'claude'
        ? setClaudeStatus
        : provider === 'openai'
          ? setOpenaiStatus
          : setGeminiStatus;
    const setSaved =
      provider === 'claude'
        ? setClaudeSaved
        : provider === 'openai'
          ? setOpenaiSaved
          : setGeminiSaved;
    const clearKey =
      provider === 'claude' ? setClaudeKey : provider === 'openai' ? setOpenaiKey : setGeminiKey;

    setStatus({ state: 'loading', message: 'Lösche API-Key...' });
    try {
      await keychainDelete(provider === 'gemini' ? 'ai_gemini' : `${provider}_api_key`);
      setSaved(false);
      clearKey('');
      setStatus({ state: 'success', message: 'API-Key gelöscht.' });
      await initializeAI();
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function testProvider(provider: AIProviderName) {
    const setStatus =
      provider === 'claude'
        ? setClaudeStatus
        : provider === 'openai'
          ? setOpenaiStatus
          : provider === 'gemini'
            ? setGeminiStatus
            : setOllamaStatus;
    setStatus({ state: 'loading', message: 'Verbindung wird getestet...' });

    try {
      if (provider === 'ollama') {
        await setSetting('ai_ollama_endpoint', ollamaEndpoint.trim() || DEFAULT_ENDPOINT);
        const models = await aiListOllamaModels(ollamaEndpoint.trim() || DEFAULT_ENDPOINT);
        setOllamaModels(models);
        if (!ollamaModel && models[0]) {
          setOllamaModel(models[0]);
          await setSetting('ai_ollama_model', models[0]);
        }
        setStatus({
          state: 'success',
          message:
            models.length > 0
              ? `${models.length} Modelle gefunden.`
              : 'Ollama erreichbar, keine Modelle gefunden.',
        });
      } else {
        const model = await aiTestConnection(provider);
        setStatus({ state: 'success', message: `Verbindung ok: ${model}` });
      }
      await initializeAI();
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function saveGeneralSettings() {
    setSettingsStatus({ state: 'loading', message: 'Speichere KI-Einstellungen...' });
    try {
      const parsedLimit = Number(monthlyLimit);
      await Promise.all([
        setSetting('ai_preferred_provider', preferredProvider),
        setSetting('ai_monthly_limit_eur', Number.isFinite(parsedLimit) ? parsedLimit : 10),
        setSetting('ai_ollama_endpoint', ollamaEndpoint.trim() || DEFAULT_ENDPOINT),
        setSetting('ai_ollama_model', ollamaModel || null),
      ]);
      setSettingsStatus({ state: 'success', message: 'KI-Einstellungen gespeichert.' });
      await initializeAI();
    } catch (error) {
      setSettingsStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const renderKeySection = (
    provider: 'claude' | 'openai' | 'gemini',
    label: string,
    value: string,
    onChange: (value: string) => void,
    saved: boolean,
    status: ProviderStatus,
  ) => (
    <div className="rounded-lg border border-border bg-bg-primary p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={`${provider}-api-key`}>{label}</Label>
          <p className="mt-1 text-xs text-text-secondary">
            {saved ? 'API-Key gespeichert' : 'Kein API-Key gespeichert'}
          </p>
        </div>
        {saved && <CheckCircle2 size={18} className="text-success" />}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`${provider}-api-key`}
          type="password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={saved ? 'Neuen API-Key eingeben' : 'API-Key eingeben'}
        />
        <Button onClick={() => void saveApiKey(provider)}>Speichern</Button>
        <Button variant="outline" onClick={() => void testProvider(provider)}>
          {status.state === 'loading' ? <Loader2 className="animate-spin" /> : null}
          Verbindung testen
        </Button>
        <Button variant="destructive" size="icon" onClick={() => void deleteApiKey(provider)}>
          <Trash2 size={16} />
          <span className="sr-only">API-Key löschen</span>
        </Button>
      </div>
      <div className="mt-2">
        <StatusLine status={status} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {renderKeySection(
            'claude',
            'Claude API-Key',
            claudeKey,
            setClaudeKey,
            claudeSaved,
            claudeStatus,
          )}
          {renderKeySection(
            'openai',
            'OpenAI API-Key',
            openaiKey,
            setOpenaiKey,
            openaiSaved,
            openaiStatus,
          )}
          {renderKeySection(
            'gemini',
            'Gemini API-Key',
            geminiKey,
            setGeminiKey,
            geminiSaved,
            geminiStatus,
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg-primary p-4">
            <Label htmlFor="ollama-endpoint">Ollama Endpoint</Label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                id="ollama-endpoint"
                value={ollamaEndpoint}
                onChange={(event) => setOllamaEndpoint(event.target.value)}
                placeholder={DEFAULT_ENDPOINT}
              />
              <Button variant="outline" onClick={() => void testProvider('ollama')}>
                {ollamaStatus.state === 'loading' ? <Loader2 className="animate-spin" /> : null}
                Verbindung testen
              </Button>
            </div>
            {ollamaModels.length > 0 && (
              <div className="mt-3">
                <Label>Ollama Modell</Label>
                <Select
                  value={ollamaModel}
                  onValueChange={(value) => {
                    if (!value) return;
                    setOllamaModel(value);
                    void setSetting('ai_ollama_model', value);
                  }}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Modell auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="mt-2">
              <StatusLine status={ollamaStatus} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-primary p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Bevorzugter Provider</Label>
                <Select
                  value={preferredProvider}
                  onValueChange={(value) => setPreferredProvider(value as AIProviderName)}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Provider wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ai-monthly-limit">Monatslimit EUR</Label>
                <Input
                  id="ai-monthly-limit"
                  className="mt-2"
                  type="number"
                  min="0"
                  step="0.5"
                  value={monthlyLimit}
                  onChange={(event) => setMonthlyLimit(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-text-secondary">
                <span>Aktueller Monatsverbrauch</span>
                <span>{monthlySpentLabel}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-hover">
                <div className="h-full bg-pg-accent" style={{ width: `${budgetPercent}%` }} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => void saveGeneralSettings()}>Speichern</Button>
              <StatusLine status={settingsStatus} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
