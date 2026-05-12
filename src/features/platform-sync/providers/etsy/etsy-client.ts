import { invoke } from '@tauri-apps/api/core';
import type { EtsyApiResponse } from './etsy-types';

export type EtsyRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type EtsyContentType = 'application/json' | 'application/x-www-form-urlencoded';

export interface EtsyApiRequestOptions {
  method: EtsyRequestMethod;
  path: string;
  apiKey: string;
  accessToken?: string | null;
  body?: object | string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  contentType?: EtsyContentType;
}

interface RustEtsyResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function parseBody<T>(body: string): T {
  if (!body.trim()) return null as T;
  return JSON.parse(body) as T;
}

export async function etsyApiRequest<T>(
  options: EtsyApiRequestOptions,
): Promise<EtsyApiResponse<T>> {
  try {
    const response = await invoke<RustEtsyResponse>('etsy_api_request', {
      method: options.method,
      path: options.path,
      accessToken: options.accessToken ?? null,
      apiKey: options.apiKey,
      body: options.body ?? null,
      query: options.query ?? null,
      contentType: options.contentType ?? 'application/json',
    });

    return {
      status: response.status,
      body: parseBody<T>(response.body),
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(
      `Etsy API Anfrage fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function etsyUploadListingImage<T>(options: {
  path: string;
  accessToken: string;
  apiKey: string;
  shopId: string;
  listingId: string;
  rank: number;
}): Promise<EtsyApiResponse<T>> {
  try {
    const response = await invoke<RustEtsyResponse>('etsy_upload_listing_image', {
      path: options.path,
      accessToken: options.accessToken,
      apiKey: options.apiKey,
      shopId: options.shopId,
      listingId: options.listingId,
      rank: options.rank,
    });

    return {
      status: response.status,
      body: parseBody<T>(response.body),
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(
      `Etsy Bild-Upload fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
