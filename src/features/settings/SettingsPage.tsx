import { Settings, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ACCENT_PRESETS, type AccentPresetKey } from '@/utils/colors';
import { cn } from '@/lib/utils';
import type { Theme, AccentColor } from '@/types';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const { theme, accentColor, changeTheme, changeAccentColor } = useTheme();

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pg-accent-subtle">
          <Settings size={20} className="text-pg-accent" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Einstellungen</h1>
          <p className="text-sm text-text-secondary">Erscheinungsbild und Anzeigeoptionen</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Theme-Toggle */}
        <section className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-text-primary">Erscheinungsbild</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Wechsle zwischen hellem und dunklem Modus oder nutze die Systemeinstellung.
          </p>
          <div className="flex gap-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => void changeTheme(option.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-pg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary',
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Akzentfarben-Auswahl */}
        <section className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-text-primary">Akzentfarbe</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Wähle eine Akzentfarbe für Buttons, aktive Elemente und Hervorhebungen.
          </p>
          <div className="flex flex-wrap gap-3">
            {(
              Object.entries(ACCENT_PRESETS) as [
                AccentPresetKey,
                (typeof ACCENT_PRESETS)[AccentPresetKey],
              ][]
            ).map(([key, preset]) => {
              const isActive = accentColor === key;
              return (
                <button
                  key={key}
                  onClick={() => void changeAccentColor(key as AccentColor)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                    isActive ? 'ring-2 ring-offset-2 ring-offset-bg-elevated' : 'hover:bg-bg-hover',
                    isActive
                      ? 'bg-bg-active text-text-primary'
                      : 'bg-bg-primary text-text-secondary',
                  )}
                  style={
                    isActive
                      ? ({ '--tw-ring-color': preset.light } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: preset.light }}
                  />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
