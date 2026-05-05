import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getSetting, setSetting } from '@/services/database';

type WritingStyle = 'sachlich-minimalistisch' | 'technisch-präzise' | 'freundlich-professionell';

const WRITING_STYLES: { value: WritingStyle; label: string }[] = [
  { value: 'sachlich-minimalistisch', label: 'Sachlich-minimalistisch' },
  { value: 'technisch-präzise', label: 'Technisch-präzise' },
  { value: 'freundlich-professionell', label: 'Freundlich-professionell' },
];

function listToText(values: string[] | null): string {
  return values?.join(', ') ?? '';
}

function textToList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BrandSettings() {
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('sachlich-minimalistisch');
  const [preferredWords, setPreferredWords] = useState('');
  const [forbiddenPhrases, setForbiddenPhrases] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [status, setStatus] = useState<{ state: 'idle' | 'success' | 'error'; message: string }>({
    state: 'idle',
    message: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBrandSettings() {
      try {
        const [style, words, phrases, reference] = await Promise.all([
          getSetting<WritingStyle>('brand_writing_style'),
          getSetting<string[]>('brand_preferred_words'),
          getSetting<string[]>('brand_forbidden_phrases'),
          getSetting<string>('brand_reference_text'),
        ]);

        if (!isMounted) return;

        setWritingStyle(style ?? 'sachlich-minimalistisch');
        setPreferredWords(listToText(words));
        setForbiddenPhrases(listToText(phrases));
        setReferenceText(reference ?? '');
      } catch (error) {
        if (!isMounted) return;
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    void loadBrandSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  async function saveBrandSettings() {
    setStatus({ state: 'idle', message: 'Speichere Markenstil...' });
    try {
      await Promise.all([
        setSetting('brand_writing_style', writingStyle),
        setSetting('brand_preferred_words', textToList(preferredWords)),
        setSetting('brand_forbidden_phrases', textToList(forbiddenPhrases)),
        setSetting('brand_reference_text', referenceText),
      ]);
      setStatus({ state: 'success', message: 'Markenstil gespeichert.' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Schreibstil</Label>
          <Select
            value={writingStyle}
            onValueChange={(value) => setWritingStyle(value as WritingStyle)}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder="Schreibstil wählen" />
            </SelectTrigger>
            <SelectContent>
              {WRITING_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="brand-preferred-words">Brand-Wörter</Label>
          <Textarea
            id="brand-preferred-words"
            className="mt-2 min-h-24"
            value={preferredWords}
            onChange={(event) => setPreferredWords(event.target.value)}
            placeholder="präzise, robust, kompakt"
          />
          <p className="mt-1 text-xs text-text-secondary">
            Kommasepariert, wird als JSON-Array gespeichert.
          </p>
        </div>
        <div>
          <Label htmlFor="brand-forbidden-phrases">No-Go-Formulierungen</Label>
          <Textarea
            id="brand-forbidden-phrases"
            className="mt-2 min-h-24"
            value={forbiddenPhrases}
            onChange={(event) => setForbiddenPhrases(event.target.value)}
            placeholder="perfekt, revolutionär, billig"
          />
          <p className="mt-1 text-xs text-text-secondary">
            Kommasepariert, wird als JSON-Array gespeichert.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="brand-reference-text">Referenztext</Label>
        <Textarea
          id="brand-reference-text"
          className="mt-2 min-h-32"
          value={referenceText}
          onChange={(event) => setReferenceText(event.target.value)}
          placeholder="Beispieltext, an dem sich KI-Ausgaben stilistisch orientieren sollen."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void saveBrandSettings()}>Speichern</Button>
        {status.message && (
          <p className={status.state === 'error' ? 'text-sm text-danger' : 'text-sm text-success'}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
