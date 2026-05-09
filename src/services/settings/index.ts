import { getDatabase, getSetting, setSetting } from '@/services/database';
import { DEFAULTS, type SettingKey } from './defaults';

export { DEFAULTS };
export type { SettingKey };

export async function getSettingWithDefault<K extends SettingKey>(
  key: K,
): Promise<(typeof DEFAULTS)[K]>;
export async function getSettingWithDefault<T>(key: string, defaultValue: T): Promise<T>;
export async function getSettingWithDefault<T>(
  key: string,
  defaultValue?: T,
): Promise<T | (typeof DEFAULTS)[SettingKey]> {
  try {
    const fallback =
      defaultValue ??
      (Object.prototype.hasOwnProperty.call(DEFAULTS, key) ? DEFAULTS[key as SettingKey] : null);
    const value = await getSetting<T>(key);
    return value ?? (fallback as T);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Setting konnte nicht geladen werden');
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  try {
    await setSetting(key, value);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Setting konnte nicht gespeichert werden',
    );
  }
}

export async function resetAllSettings(): Promise<void> {
  try {
    await getDatabase().execute('DELETE FROM app_settings');
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Settings konnten nicht zurückgesetzt werden',
    );
  }
}
