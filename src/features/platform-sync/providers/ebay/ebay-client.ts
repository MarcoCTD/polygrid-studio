import { invoke } from '@tauri-apps/api/core';
import type { EbayApiResponse, EbayTradingPictureResponse } from './ebay-types';
import {
  buildUploadSiteHostedPicturesXml,
  parseUploadSiteHostedPicturesResponse,
} from './ebay-trading-api';

export type EbayRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type EbayContentType = 'application/json' | 'application/x-www-form-urlencoded';

export interface EbayApiRequestOptions {
  method: EbayRequestMethod;
  path: string;
  accessToken: string;
  body?: object | string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  contentType?: EbayContentType;
}

export interface EbayTokenRequestOptions {
  clientId: string;
  clientSecret: string;
  body: string;
}

interface RustEbayResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function parseJsonBody<T>(body: string): T {
  if (!body.trim()) return null as T;
  return JSON.parse(body) as T;
}

export async function ebayApiRequest<T>(
  options: EbayApiRequestOptions,
): Promise<EbayApiResponse<T>> {
  try {
    const response = await invoke<RustEbayResponse>('ebay_api_request', {
      method: options.method,
      path: options.path,
      accessToken: options.accessToken,
      body: options.body ?? null,
      query: options.query ?? null,
      contentType: options.contentType ?? 'application/json',
    });

    return {
      status: response.status,
      body: parseJsonBody<T>(response.body),
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(
      `eBay API Anfrage fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function ebayTokenRequest<T>(
  options: EbayTokenRequestOptions,
): Promise<EbayApiResponse<T>> {
  try {
    const response = await invoke<RustEbayResponse>('ebay_token_request', {
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      body: options.body,
    });

    return {
      status: response.status,
      body: parseJsonBody<T>(response.body),
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(
      `eBay Token-Anfrage fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function ebayUploadSiteHostedPicture(options: {
  path: string;
  accessToken: string;
  clientId: string;
  clientSecret: string;
  pictureName: string;
}): Promise<EbayApiResponse<EbayTradingPictureResponse>> {
  try {
    const response = await invoke<RustEbayResponse>('ebay_upload_site_hosted_picture', {
      path: options.path,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      xml: buildUploadSiteHostedPicturesXml({
        accessToken: options.accessToken,
        pictureName: options.pictureName,
      }),
    });

    return {
      status: response.status,
      body: parseUploadSiteHostedPicturesResponse(response.body),
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(
      `eBay Bild-Upload fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
