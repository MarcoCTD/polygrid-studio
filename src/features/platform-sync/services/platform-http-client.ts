import type { Platform, PlatformResponse, SyncDirection, SyncOperation } from '../providers/types';
import { createSyncJob, completeSyncJob, updateSyncJob } from './sync-jobs-service';
import { createDefaultRateLimiter, type RateLimiter } from './rate-limiter';
import { TokenManager } from './token-manager';

export interface PlatformRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  listingId?: string;
  orderId?: string;
  operation?: SyncOperation;
  direction?: SyncDirection;
}

export class PlatformHttpClient {
  constructor(
    private readonly tokenManager: TokenManager,
    private readonly rateLimiter: RateLimiter,
    private readonly platform: Platform,
  ) {}

  async request<T>(config: PlatformRequestConfig): Promise<PlatformResponse<T>> {
    const operation = config.operation ?? 'load_policies';
    const direction = config.direction ?? (operation === 'pull_orders' ? 'pull' : 'push');
    const syncJobId = await createSyncJob({
      platform: this.platform,
      operation,
      listing_id: config.listingId ?? null,
      order_id: config.orderId ?? null,
      direction,
      request_payload: {
        method: config.method,
        url: config.url,
        body: config.body,
      },
    });

    try {
      const response = await this.executeWithRetries<T>(config, syncJobId);
      await completeSyncJob(syncJobId, {
        status: 'success',
        response_payload: response.data,
        http_status_code: response.status,
      });
      return response;
    } catch (error) {
      await completeSyncJob(syncJobId, {
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeWithRetries<T>(
    config: PlatformRequestConfig,
    syncJobId: string,
  ): Promise<PlatformResponse<T>> {
    let lastError: unknown = null;

    for (let retryCount = 0; retryCount <= 3; retryCount++) {
      try {
        if (retryCount > 0) {
          await updateSyncJob(syncJobId, { status: 'retrying', retry_count: retryCount });
        }

        await this.rateLimiter.acquire();
        const token = await this.tokenManager.ensureFreshToken(this.platform);
        const response = await fetch(config.url, {
          method: config.method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: config.body === undefined ? undefined : JSON.stringify(config.body),
        });

        if (response.status === 401 && retryCount < 3) {
          await this.tokenManager.refreshToken(this.platform);
          continue;
        }

        if (response.status === 429 && retryCount < 3) {
          await this.rateLimiter.handleRateLimit(retryCount);
          continue;
        }

        const data = await this.parseResponse<T>(response);
        if (!response.ok) {
          throw new Error(`Platform API Fehler (${response.status}): ${JSON.stringify(data)}`);
        }

        return { data, status: response.status, headers: response.headers, syncJobId };
      } catch (error) {
        lastError = error;
        if (retryCount >= 3) break;
        await this.rateLimiter.handleRateLimit(retryCount);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? 'Platform API Anfrage fehlgeschlagen'));
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }
}

export function createPlatformHttpClient(platform: Platform): PlatformHttpClient {
  return new PlatformHttpClient(new TokenManager(), createDefaultRateLimiter(platform), platform);
}
