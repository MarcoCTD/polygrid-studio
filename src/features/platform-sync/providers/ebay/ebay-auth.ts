import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import { TokenManager } from '../../services/token-manager';
import type { OAuthResult, Platform, TokenResult } from '../types';
import { ebayTokenRequest } from './ebay-client';
import {
  EBAY_OAUTH_BASE_URL,
  EBAY_OAUTH_PORT,
  EBAY_OAUTH_SCOPES,
  type EbayTokenResponse,
} from './ebay-types';

const KEYCHAIN_SERVICE = 'polygrid-studio';
const EBAY_CLIENT_ID = 'polygrid_ebay_client_id';
const EBAY_CLIENT_SECRET = 'polygrid_ebay_client_secret';

interface OAuthServerInfo {
  port: number;
}

function formBody(values: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

function parseOAuthCallback(url: string): { code: string; state: string } {
  const parsed = new URL(url);
  const error = parsed.searchParams.get('error');
  if (error) {
    throw new Error(parsed.searchParams.get('error_description') ?? error);
  }

  const code = parsed.searchParams.get('code');
  const state = parsed.searchParams.get('state');
  if (!code || !state) {
    throw new Error('OAuth-Callback enthält keinen Code oder State.');
  }
  return { code, state };
}

export async function getEbayCredential(key: string): Promise<string | null> {
  return invoke<string | null>('keychain_get', { service: KEYCHAIN_SERVICE, key });
}

export async function getEbayClientId(): Promise<string> {
  const clientId = await getEbayCredential(EBAY_CLIENT_ID);
  if (!clientId?.trim()) {
    throw new Error('eBay Client-ID fehlt im Keychain.');
  }
  return clientId;
}

export async function getEbayClientSecret(): Promise<string> {
  const secret = await getEbayCredential(EBAY_CLIENT_SECRET);
  if (!secret?.trim()) {
    throw new Error('eBay Client Secret fehlt im Keychain.');
  }
  return secret;
}

async function getEbayRuName(): Promise<string> {
  const ruName = await getSettingWithDefault('ebay_ru_name', DEFAULTS.ebay_ru_name);
  if (!ruName.trim()) {
    throw new Error('eBay RuName nicht konfiguriert. Bitte in den Settings hinterlegen.');
  }
  return ruName;
}

export async function exchangeEbayAuthorizationCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  ruName: string;
}): Promise<EbayTokenResponse> {
  const response = await ebayTokenRequest<EbayTokenResponse>({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    body: formBody({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.ruName,
    }),
  });
  return response.body;
}

export async function refreshEbayToken(refreshToken: string): Promise<TokenResult> {
  try {
    const [clientId, clientSecret] = await Promise.all([getEbayClientId(), getEbayClientSecret()]);
    const response = await ebayTokenRequest<EbayTokenResponse>({
      clientId,
      clientSecret,
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    await new TokenManager(ebayRefreshHandler).storeToken(
      'ebay',
      response.body.access_token,
      response.body.refresh_token ?? refreshToken,
      response.body.expires_in,
    );

    return {
      success: true,
      expiresAt: new Date(Date.now() + response.body.expires_in * 1000).toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const ebayRefreshHandler = async (
  platform: Platform,
  refreshToken: string,
): Promise<TokenResult> => {
  if (platform !== 'ebay') {
    return { success: false, error: `Unsupported platform for eBay refresh: ${platform}` };
  }
  return refreshEbayToken(refreshToken);
};

export async function startEbayOAuthFlow(): Promise<OAuthResult> {
  const [clientId, clientSecret, ruName] = await Promise.all([
    getEbayClientId(),
    getEbayClientSecret(),
    getEbayRuName(),
  ]);

  await invoke<OAuthServerInfo>('start_oauth_server', { port: EBAY_OAUTH_PORT });
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: ruName,
    scope: EBAY_OAUTH_SCOPES.join(' '),
    state,
  });

  const callback = new Promise<{ code: string; state: string }>((resolve, reject) => {
    let unlisten: (() => void) | null = null;
    listen<string>('platform-sync://oauth-url', (event) => {
      try {
        const parsed = parseOAuthCallback(event.payload);
        if (parsed.state !== state) {
          reject(new Error('OAuth-State stimmt nicht überein.'));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(error);
      } finally {
        unlisten?.();
      }
    })
      .then((handler) => {
        unlisten = handler;
      })
      .catch(reject);
  });

  try {
    await invoke('open_external_url', { url: `${EBAY_OAUTH_BASE_URL}?${params.toString()}` });
    const { code } = await callback;
    const token = await exchangeEbayAuthorizationCode({
      clientId,
      clientSecret,
      code,
      ruName,
    });

    if (!token.refresh_token) {
      throw new Error('eBay OAuth lieferte keinen Refresh Token zurück.');
    }

    await new TokenManager(ebayRefreshHandler).storeToken(
      'ebay',
      token.access_token,
      token.refresh_token,
      token.expires_in,
    );

    return {
      success: true,
      shopName: 'eBay',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await invoke('stop_oauth_server');
  }
}
