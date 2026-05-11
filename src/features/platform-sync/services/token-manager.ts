import { invoke } from '@tauri-apps/api/core';
import type { Platform, TokenResult } from '../providers/types';

const KEYCHAIN_SERVICE = 'polygrid-studio';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const TOKEN_KEYS: Record<Platform, { access: string; refresh: string; expiresAt: string }> = {
  etsy: {
    access: 'polygrid_etsy_access_token',
    refresh: 'polygrid_etsy_refresh_token',
    expiresAt: 'polygrid_etsy_token_expires_at',
  },
  ebay: {
    access: 'polygrid_ebay_access_token',
    refresh: 'polygrid_ebay_refresh_token',
    expiresAt: 'polygrid_ebay_token_expires_at',
  },
};

export type TokenRefreshHandler = (platform: Platform, refreshToken: string) => Promise<TokenResult>;

export class TokenManager {
  constructor(private readonly refreshHandler?: TokenRefreshHandler) {}

  async getValidToken(platform: Platform): Promise<string> {
    try {
      const token = await this.getSecret(TOKEN_KEYS[platform].access);
      if (!token?.trim()) {
        throw new Error(`Kein Access Token für ${platform} hinterlegt`);
      }
      return token;
    } catch (error) {
      throw new Error(
        `Token konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async ensureFreshToken(platform: Platform): Promise<string> {
    try {
      if (await this.hasFreshAccessToken(platform)) {
        return this.getValidToken(platform);
      }

      return this.refreshToken(platform);
    } catch (error) {
      throw new Error(
        `Token konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async refreshToken(platform: Platform): Promise<string> {
    const refreshToken = await this.getSecret(TOKEN_KEYS[platform].refresh);
    if (!refreshToken?.trim()) {
      throw new Error(`Kein Refresh Token für ${platform} hinterlegt`);
    }
    if (!this.refreshHandler) {
      throw new Error(`Token-Refresh für ${platform} ist noch nicht registriert`);
    }

    const result = await this.refreshHandler(platform, refreshToken);
    if (!result.success) {
      throw new Error(result.error ?? `Token-Refresh für ${platform} fehlgeschlagen`);
    }

    return this.getValidToken(platform);
  }

  async storeToken(
    platform: Platform,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const keys = TOKEN_KEYS[platform];
      await Promise.all([
        this.setSecret(keys.access, accessToken),
        this.setSecret(keys.refresh, refreshToken),
        this.setSecret(keys.expiresAt, expiresAt),
      ]);
    } catch (error) {
      throw new Error(
        `Token konnte nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async clearTokens(platform: Platform): Promise<void> {
    try {
      const keys = TOKEN_KEYS[platform];
      await Promise.all([
        this.deleteSecret(keys.access),
        this.deleteSecret(keys.refresh),
        this.deleteSecret(keys.expiresAt),
      ]);
    } catch (error) {
      throw new Error(
        `Token konnten nicht gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async hasValidToken(platform: Platform): Promise<boolean> {
    try {
      return this.hasFreshAccessToken(platform);
    } catch {
      return false;
    }
  }

  private async hasFreshAccessToken(platform: Platform): Promise<boolean> {
    const [token, expiresAt] = await Promise.all([
      this.getSecret(TOKEN_KEYS[platform].access),
      this.getSecret(TOKEN_KEYS[platform].expiresAt),
    ]);
    if (!token?.trim() || !expiresAt?.trim()) return false;
    const expiry = Date.parse(expiresAt);
    return Number.isFinite(expiry) && expiry - Date.now() > REFRESH_BUFFER_MS;
  }

  private async getSecret(key: string): Promise<string | null> {
    return invoke<string | null>('keychain_get', { service: KEYCHAIN_SERVICE, key });
  }

  private async setSecret(key: string, value: string): Promise<void> {
    await invoke('keychain_set', { service: KEYCHAIN_SERVICE, key, value });
  }

  private async deleteSecret(key: string): Promise<void> {
    await invoke('keychain_delete', { service: KEYCHAIN_SERVICE, key });
  }
}
