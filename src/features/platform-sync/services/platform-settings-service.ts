import { invoke } from '@tauri-apps/api/core';
import { DEFAULTS, getSettingWithDefault, saveSetting } from '@/services/settings';
import { syncService } from './sync-service';
import type { ConnectionInfo, Platform, PlatformProfiles } from '../providers/types';

const KEYCHAIN_SERVICE = 'polygrid-studio';

export const PLATFORM_CREDENTIAL_KEYS = {
  etsyApiKey: 'polygrid_etsy_api_key',
  etsySharedSecret: 'polygrid_etsy_shared_secret',
  ebayClientId: 'polygrid_ebay_client_id',
  ebayClientSecret: 'polygrid_ebay_client_secret',
} as const;

export type PlatformCredentialKey =
  (typeof PLATFORM_CREDENTIAL_KEYS)[keyof typeof PLATFORM_CREDENTIAL_KEYS];

export interface CredentialStatus {
  exists: boolean;
  maskedValue: string | null;
}

export interface PlatformConnectionStatus {
  connected: boolean;
  info: ConnectionInfo | null;
  label: string;
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `••••••••${trimmed.slice(-4)}`;
}

async function getKeychainValue(key: PlatformCredentialKey): Promise<string | null> {
  try {
    return await invoke<string | null>('keychain_get', {
      service: KEYCHAIN_SERVICE,
      key,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Credential konnte nicht gelesen werden: ${key}`,
    );
  }
}

export async function getCredentialStatus(key: PlatformCredentialKey): Promise<CredentialStatus> {
  const value = await getKeychainValue(key);
  return {
    exists: Boolean(value?.trim()),
    maskedValue: value?.trim() ? maskSecret(value) : null,
  };
}

export async function savePlatformCredential(
  key: PlatformCredentialKey,
  value: string,
): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Credential darf nicht leer sein.');
  }

  try {
    await invoke('keychain_set', {
      service: KEYCHAIN_SERVICE,
      key,
      value: trimmed,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Credential konnte nicht gespeichert werden: ${key}`,
    );
  }
}

export async function deletePlatformCredential(key: PlatformCredentialKey): Promise<void> {
  try {
    await invoke('keychain_delete', {
      service: KEYCHAIN_SERVICE,
      key,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Credential konnte nicht gelöscht werden: ${key}`,
    );
  }
}

export async function getPlatformConnectionStatus(
  platform: Platform,
): Promise<PlatformConnectionStatus> {
  const provider = syncService.getProvider(platform);
  const connected = await provider.isConnected();

  if (!connected) {
    return {
      connected: false,
      info: null,
      label: 'Nicht verbunden',
    };
  }

  try {
    const info = await provider.getConnectionInfo();
    return {
      connected: true,
      info,
      label: info?.shopName ? `Verbunden: ${info.shopName}` : 'Verbunden',
    };
  } catch (error) {
    return {
      connected: true,
      info: null,
      label: error instanceof Error ? `Token vorhanden, Prüfung fehlgeschlagen: ${error.message}` : 'Token vorhanden',
    };
  }
}

export async function startPlatformOAuth(platform: Platform): Promise<void> {
  const result = await syncService.getProvider(platform).startOAuthFlow();
  if (!result.success) {
    throw new Error(result.error ?? 'OAuth-Verbindung konnte nicht hergestellt werden.');
  }
}

export async function disconnectPlatform(platform: Platform): Promise<void> {
  await syncService.getProvider(platform).disconnect();

  if (platform === 'etsy') {
    await Promise.all([
      saveSetting('etsy_shop_id', DEFAULTS.etsy_shop_id),
      saveSetting('etsy_shop_name', DEFAULTS.etsy_shop_name),
    ]);
  }
}

export async function loadPlatformProfiles(platform: Platform): Promise<PlatformProfiles> {
  return syncService.getProvider(platform).loadProfiles();
}

export async function getConfiguredEtsyShopName(): Promise<string> {
  return getSettingWithDefault('etsy_shop_name', DEFAULTS.etsy_shop_name);
}
