import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { useAutoSave } from '../hooks/useAutoSave';

type WritingStyle = 'sachlich-minimalistisch' | 'technisch-präzise' | 'freundlich-professionell';

interface BrandState {
  writingStyle: WritingStyle;
  keywords: string[];
  noGoPhrases: string[];
  referenceText: string;
}

const STYLE_PREVIEWS: Record<WritingStyle, string> = {
  'sachlich-minimalistisch': 'Hochwertige 3D-Druckteile. Präzise gefertigt, schnell versandt.',
  'technisch-präzise':
    'FDM-gedruckt mit 0.2mm Schichthöhe auf kalibriertem Bambu Lab X1C. Material: PETG, Infill 20%.',
  'freundlich-professionell':
    'Willkommen in meinem Shop! Jedes Teil wird mit Liebe und Präzision für dich gedruckt.',
};

const DEFAULT_BRAND_STATE: BrandState = {
  writingStyle: DEFAULTS.brand_writing_style,
  keywords: [...DEFAULTS.brand_keywords],
  noGoPhrases: [...DEFAULTS.brand_no_go_phrases],
  referenceText: DEFAULTS.brand_reference_text,
};

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

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mutableTags(value: readonly string[]): string[] {
  return [...value];
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  function addFromDraft() {
    const nextTags = splitTags(draft).filter((tag) => !value.includes(tag));
    if (nextTags.length === 0) return;
    onChange([...value, ...nextTags]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addFromDraft();
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={addFromDraft}
        onKeyDown={handleKeyDown}
      />
      <div className="flex min-h-8 flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            {tag}
            <button
              type="button"
              aria-label={`${tag} entfernen`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function BrandSettingsTab() {
  const { scheduleSave } = useAutoSave();
  const [settings, setSettings] = useState<BrandState>(DEFAULT_BRAND_STATE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [
          writingStyle,
          keywords,
          legacyKeywords,
          noGoPhrases,
          legacyNoGoPhrases,
          referenceText,
        ] = await Promise.all([
          getSettingWithDefault('brand_writing_style'),
          getSettingWithDefault('brand_keywords'),
          getSettingWithDefault('brand_preferred_words'),
          getSettingWithDefault('brand_no_go_phrases'),
          getSettingWithDefault('brand_forbidden_phrases'),
          getSettingWithDefault('brand_reference_text'),
        ]);
        if (cancelled) return;
        setSettings({
          writingStyle,
          keywords: keywords.length > 0 ? mutableTags(keywords) : mutableTags(legacyKeywords),
          noGoPhrases:
            noGoPhrases.length > 0 ? mutableTags(noGoPhrases) : mutableTags(legacyNoGoPhrases),
          referenceText,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Markenstil konnte nicht laden');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof BrandState>(
    key: K,
    value: BrandState[K],
    settingKey: string,
    aliases: string[] = [],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    scheduleSave(settingKey, value, { aliases });
  }

  if (isLoading) {
    return <div className="text-sm text-text-secondary">Markenstil wird geladen...</div>;
  }

  return (
    <div className="space-y-5">
      <Section title="Schreibstil">
        <FieldRow label="Stil">
          <div className="space-y-3">
            <Select
              value={settings.writingStyle}
              onValueChange={(value) =>
                update('writingStyle', value as WritingStyle, 'brand_writing_style')
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sachlich-minimalistisch">sachlich-minimalistisch</SelectItem>
                <SelectItem value="technisch-präzise">technisch-präzise</SelectItem>
                <SelectItem value="freundlich-professionell">freundlich-professionell</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-primary">
              {STYLE_PREVIEWS[settings.writingStyle]}
            </div>
          </div>
        </FieldRow>
      </Section>

      <Section title="Markenvokabular">
        <FieldRow label="Brand-Wörter">
          <TagInput
            value={settings.keywords}
            placeholder="Begriff eingeben, Enter oder Komma"
            onChange={(next) =>
              update('keywords', next, 'brand_keywords', ['brand_preferred_words'])
            }
          />
        </FieldRow>
        <FieldRow label="No-Go-Formulierungen">
          <TagInput
            value={settings.noGoPhrases}
            placeholder="Formulierung eingeben, Enter oder Komma"
            onChange={(next) =>
              update('noGoPhrases', next, 'brand_no_go_phrases', ['brand_forbidden_phrases'])
            }
          />
        </FieldRow>
      </Section>

      <Section title="Referenztext">
        <FieldRow
          label="Beispieltext"
          hint="Dieser Text wird KI-Agenten als Stilreferenz übergeben"
        >
          <Textarea
            rows={6}
            className="min-h-36 resize-y"
            value={settings.referenceText}
            onChange={(event) =>
              update('referenceText', event.target.value, 'brand_reference_text')
            }
          />
        </FieldRow>
      </Section>
    </div>
  );
}
