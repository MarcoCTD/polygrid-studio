import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listAiJobs, getAiJobStats, type AiJob } from "@/services/database/queries/ai-jobs";
import de from "@/i18n/de.json";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: string;
  durationMs?: number;
  tokensUsed?: number;
}

type AgentType = "listing" | "product" | "expense" | "general";

const AGENT_LABELS: Record<AgentType, string> = {
  listing: "Listing-Assistent",
  product: "Produkt-Analyst",
  expense: "Ausgaben-Assistent",
  general: "Allgemein",
};

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  listing: "Erstellt Listing-Texte, Titel, Beschreibungen und Tags",
  product: "Analysiert Produkte, Margen und Marktpotenzial",
  expense: "Kategorisiert Ausgaben und erkennt Muster",
  general: "Allgemeine Textgenerierung und Fragen",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onCopy,
}: {
  message: ChatMessage;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isUser = message.role === "user";
  const isError = message.role === "error";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-[--accent-primary-subtle]"
            : isError
              ? "bg-[--accent-danger-subtle]"
              : "bg-[--muted]"
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold text-[--accent-primary]">Du</span>
        ) : isError ? (
          <AlertCircle className="size-3.5 text-[--accent-danger]" />
        ) : (
          <Sparkles className="size-3.5 text-[--muted-foreground]" />
        )}
      </div>

      {/* Content */}
      <div className={cn("max-w-[75%] space-y-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-[--accent-primary] text-white"
              : isError
                ? "border border-[--accent-danger]/20 bg-[--accent-danger-subtle] text-[--foreground]"
                : "border border-[--border] bg-[--card] text-[--foreground]"
          )}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Meta row */}
        <div
          className={cn(
            "flex items-center gap-2 text-[10px] text-[--muted-foreground]",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {message.durationMs != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {formatDuration(message.durationMs)}
            </span>
          )}
          {message.tokensUsed != null && (
            <span className="flex items-center gap-0.5">
              <Zap className="size-2.5" />
              {message.tokensUsed} Tokens
            </span>
          )}
          {!isUser && !isError && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-0.5 transition-colors hover:text-[--foreground]"
            >
              {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Job History Item ─────────────────────────────────────────────────────────

function JobHistoryItem({ job }: { job: AiJob }) {
  const statusColor =
    job.status === "completed"
      ? "text-[--accent-success]"
      : job.status === "failed"
        ? "text-[--accent-danger]"
        : "text-[--accent-warning]";

  return (
    <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-[--muted]">
      <div className={cn("size-1.5 rounded-full", statusColor.replace("text-", "bg-"))} />
      <span className="flex-1 truncate text-[--foreground]">
        {job.agent} / {job.action}
      </span>
      <span className="shrink-0 tabular-nums text-[--muted-foreground]">
        {job.duration_ms != null ? formatDuration(job.duration_ms) : "..."}
      </span>
    </div>
  );
}

// ── AI Assistant Page ────────────────────────────────────────────────────────

export function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agent, setAgent] = useState<AgentType>("listing");
  const [recentJobs, setRecentJobs] = useState<AiJob[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    failed: number;
    totalTokens: number;
    avgDuration: number | null;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history
  useEffect(() => {
    Promise.all([listAiJobs(20), getAiJobStats()])
      .then(([jobs, s]) => {
        setRecentJobs(jobs);
        setStats(s);
      })
      .catch(console.error);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isGenerating) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    // Simulate AI response since no provider is configured yet
    // In production, this would call aiService.generateText()
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "error",
        content:
          "Kein KI-Anbieter konfiguriert. Bitte konfiguriere einen Anbieter unter Einstellungen > KI-Integration.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  function handleClear() {
    setMessages([]);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
          <div>
            <h1 className="text-base font-semibold text-[--foreground]">
              {de.aiAssistant.title}
            </h1>
            <p className="text-xs text-[--muted-foreground]">{de.aiAssistant.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={agent} onValueChange={(v) => setAgent(v as AgentType)}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AGENT_LABELS) as AgentType[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <div>
                      <div>{AGENT_LABELS[key]}</div>
                      <div className="text-[10px] text-[--muted-foreground]">
                        {AGENT_DESCRIPTIONS[key]}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleClear}>
                <RotateCcw className="size-3" />
                Leeren
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-[--muted]">
                <Sparkles className="size-8 text-[--muted-foreground]/50" />
              </div>
              <div className="max-w-sm text-center">
                <p className="text-sm font-medium text-[--foreground]">
                  {AGENT_LABELS[agent]}
                </p>
                <p className="mt-1 text-xs text-[--muted-foreground]">
                  {AGENT_DESCRIPTIONS[agent]}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {agent === "listing" && (
                  <>
                    <PromptSuggestion
                      text="Erstelle einen Listing-Text für einen Handyhalter aus PLA"
                      onClick={setInput}
                    />
                    <PromptSuggestion
                      text="Schreibe Tags für ein Schreibtisch-Organizer-Set"
                      onClick={setInput}
                    />
                  </>
                )}
                {agent === "product" && (
                  <>
                    <PromptSuggestion
                      text="Analysiere die Margen meiner PLA-Produkte"
                      onClick={setInput}
                    />
                    <PromptSuggestion
                      text="Welche Produktkategorien haben das meiste Potenzial?"
                      onClick={setInput}
                    />
                  </>
                )}
                {agent === "expense" && (
                  <>
                    <PromptSuggestion
                      text="Kategorisiere meine letzten Ausgaben"
                      onClick={setInput}
                    />
                    <PromptSuggestion
                      text="Welche Ausgaben sind steuerlich relevant?"
                      onClick={setInput}
                    />
                  </>
                )}
                {agent === "general" && (
                  <>
                    <PromptSuggestion
                      text="Erstelle eine FAQ für meinen Etsy-Shop"
                      onClick={setInput}
                    />
                    <PromptSuggestion
                      text="Schreibe einen Beilagezettel für Versandpakete"
                      onClick={setInput}
                    />
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onCopy={handleCopy} />
              ))}
              {isGenerating && (
                <div className="flex items-center gap-2 text-xs text-[--muted-foreground]">
                  <div className="flex gap-1">
                    <div className="size-1.5 animate-pulse rounded-full bg-[--muted-foreground]" />
                    <div className="size-1.5 animate-pulse rounded-full bg-[--muted-foreground] delay-75" />
                    <div className="size-1.5 animate-pulse rounded-full bg-[--muted-foreground] delay-150" />
                  </div>
                  Generiere Antwort...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[--border] p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nachricht eingeben... (Shift+Enter für neue Zeile)"
                rows={1}
                className={cn(
                  "w-full resize-none rounded-lg border border-[--border] bg-[--card] px-3.5 py-2.5",
                  "text-sm text-[--foreground] placeholder:text-[--muted-foreground]",
                  "outline-none transition-colors focus:border-[--accent-primary]",
                  "max-h-32 min-h-[40px]"
                )}
                style={{
                  height: "auto",
                  minHeight: "40px",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 128) + "px";
                }}
              />
            </div>
            <Button
              size="sm"
              className="h-10 gap-1.5 self-end"
              disabled={!input.trim() || isGenerating}
              onClick={handleSend}
            >
              <Send className="size-3.5" />
              Senden
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-[--muted-foreground]">
            KI-Aktionen werden in der Datenbank protokolliert. Generierte Texte immer prüfen.
          </p>
        </div>
      </div>

      {/* Sidebar — Job History */}
      <div className="flex w-64 shrink-0 flex-col border-l border-[--border]">
        <div className="border-b border-[--border] px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[--muted-foreground]">
            KI-Verlauf
          </h3>
        </div>

        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-2 border-b border-[--border] p-3">
            <div className="text-center">
              <div className="text-lg font-semibold tabular-nums text-[--foreground]">
                {stats.completed}
              </div>
              <div className="text-[10px] text-[--muted-foreground]">Generiert</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold tabular-nums text-[--foreground]">
                {stats.totalTokens.toLocaleString("de-DE")}
              </div>
              <div className="text-[10px] text-[--muted-foreground]">Tokens</div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="py-1">
            {recentJobs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[--muted-foreground]">
                Noch keine KI-Anfragen.
              </div>
            ) : (
              recentJobs.map((job) => <JobHistoryItem key={job.id} job={job} />)
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Prompt Suggestion Chip ───────────────────────────────────────────────────

function PromptSuggestion({
  text,
  onClick,
}: {
  text: string;
  onClick: (text: string) => void;
}) {
  return (
    <button
      className="rounded-lg border border-[--border] bg-[--card] px-3 py-2 text-left text-xs text-[--muted-foreground] transition-colors hover:bg-[--muted] hover:text-[--foreground]"
      onClick={() => onClick(text)}
    >
      {text}
    </button>
  );
}
