import type { Platform } from '../providers/types';

export interface RateLimiterConfig {
  platform: Platform;
  maxPerSecond: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly config: RateLimiterConfig) {
    this.tokens = config.maxPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    while (this.tokens < 1) {
      await this.sleep(100);
      this.refill();
    }

    this.tokens -= 1;
  }

  async handleRateLimit(retryCount: number): Promise<void> {
    const delayMs = Math.min(1000 * 2 ** retryCount, 30_000);
    await this.sleep(delayMs);
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    const replenished = elapsedSeconds * this.config.maxPerSecond;

    if (replenished >= 1) {
      this.tokens = Math.min(this.config.maxPerSecond, this.tokens + replenished);
      this.lastRefill = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

export function createDefaultRateLimiter(platform: Platform): RateLimiter {
  return new RateLimiter({
    platform,
    maxPerSecond: platform === 'etsy' ? 10 : 3,
  });
}
