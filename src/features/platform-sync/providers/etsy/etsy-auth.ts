import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { saveSetting } from '@/services/settings';
import { TokenManager } from '../../services/token-manager';
import type { OAuthResult, Platform, TokenResult } from '../types';
import {
  ETSY_OAUTH_SCOPES,
  type EtsyMeResponse,
  type EtsyShop,
  type EtsyTokenResponse,
  type EtsyUserShopsResponse,
} from './etsy-types';
import { etsyApiRequest } from './etsy-client';

const KEYCHAIN_SERVICE = 'polygrid-studio';
const ETSY_API_KEY = 'polygrid_etsy_api_key';
const ETSY_SHARED_SECRET = 'polygrid_etsy_shared_secret';
const OAUTH_URL = 'https://www.etsy.com/oauth/connect';

interface OAuthServerInfo {
  port: number;
}

function base64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
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

export async function getEtsyCredential(key: string): Promise<string | null> {
  return invoke<string | null>('keychain_get', { service: KEYCHAIN_SERVICE, key });
}

export async function getEtsyApiKey(): Promise<string> {
  const apiKey = await getEtsyCredential(ETSY_API_KEY);
  if (!apiKey?.trim()) {
    throw new Error('Etsy API-Key fehlt im Keychain.');
  }
  return apiKey;
}

export async function getEtsySharedSecret(): Promise<string> {
  const secret = await getEtsyCredential(ETSY_SHARED_SECRET);
  if (!secret?.trim()) {
    throw new Error('Etsy Shared Secret fehlt im Keychain.');
  }
  return secret;
}

export async function exchangeEtsyAuthorizationCode(params: {
  apiKey: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<EtsyTokenResponse> {
  const sharedSecret = await getEtsySharedSecret();
  const response = await etsyApiRequest<EtsyTokenResponse>({
    method: 'POST',
    path: '/public/oauth/token',
    apiKey: params.apiKey,
    body: formBody({
      grant_type: 'authorization_code',
      client_id: params.apiKey,
      client_secret: sharedSecret,
      redirect_uri: params.redirectUri,
      code: params.code,
      code_verifier: params.codeVerifier,
    }),
    contentType: 'application/x-www-form-urlencoded',
  });
  return response.body;
}

export async function refreshEtsyToken(refreshToken: string): Promise<TokenResult> {
  try {
    const apiKey = await getEtsyApiKey();
    const sharedSecret = await getEtsySharedSecret();
    const response = await etsyApiRequest<EtsyTokenResponse>({
      method: 'POST',
      path: '/public/oauth/token',
      apiKey,
      body: formBody({
        grant_type: 'refresh_token',
        client_id: apiKey,
        client_secret: sharedSecret,
        refresh_token: refreshToken,
      }),
      contentType: 'application/x-www-form-urlencoded',
    });

    await new TokenManager(etsyRefreshHandler).storeToken(
      'etsy',
      response.body.access_token,
      response.body.refresh_token,
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

export const etsyRefreshHandler = async (
  platform: Platform,
  refreshToken: string,
): Promise<TokenResult> => {
  if (platform !== 'etsy') {
    return { success: false, error: `Unsupported platform for Etsy refresh: ${platform}` };
  }
  return refreshEtsyToken(refreshToken);
};

export async function loadEtsyShopInfo(accessToken: string, apiKey: string): Promise<EtsyShop> {
  const me = await etsyApiRequest<EtsyMeResponse>({
    method: 'GET',
    path: '/application/users/me',
    accessToken,
    apiKey,
  });
  const shops = await etsyApiRequest<EtsyUserShopsResponse>({
    method: 'GET',
    path: `/application/users/${me.body.user_id}/shops`,
    accessToken,
    apiKey,
  });
  const shop = shops.body.results[0];
  if (!shop) {
    throw new Error('Etsy-Konto hat keinen Shop.');
  }

  await Promise.all([
    saveSetting('etsy_shop_id', String(shop.shop_id)),
    saveSetting('etsy_shop_name', shop.shop_name),
  ]);

  return shop;
}

export async function startEtsyOAuthFlow(): Promise<OAuthResult> {
  const apiKey = await getEtsyApiKey();

  const { port } = await invoke<OAuthServerInfo>('start_oauth_server');
  const redirectUri = `http://localhost:${port}/callback`;
  const state = crypto.randomUUID();
  const codeVerifier = randomString();
  const codeChallenge = base64Url(await sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: apiKey,
    redirect_uri: redirectUri,
    scope: ETSY_OAUTH_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
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
    await invoke('open_external_url', { url: `${OAUTH_URL}?${params.toString()}` });
    const { code } = await callback;
    const token = await exchangeEtsyAuthorizationCode({
      apiKey,
      code,
      codeVerifier,
      redirectUri,
    });

    const tokenManager = new TokenManager(etsyRefreshHandler);
    await tokenManager.storeToken('etsy', token.access_token, token.refresh_token, token.expires_in);
    const shop = await loadEtsyShopInfo(token.access_token, apiKey);

    return {
      success: true,
      shopId: String(shop.shop_id),
      shopName: shop.shop_name,
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
