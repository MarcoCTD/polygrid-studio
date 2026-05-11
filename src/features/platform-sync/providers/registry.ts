import type { Platform, PlatformSyncProvider } from './types';

export class PlatformProviderRegistry {
  private readonly providers = new Map<Platform, PlatformSyncProvider>();

  registerProvider(provider: PlatformSyncProvider): void {
    this.providers.set(provider.platform, provider);
  }

  getProvider(platform: Platform): PlatformSyncProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new Error(`Platform-Sync-Provider nicht registriert: ${platform}`);
    }
    return provider;
  }

  hasProvider(platform: Platform): boolean {
    return this.providers.has(platform);
  }

  listProviders(): PlatformSyncProvider[] {
    return Array.from(this.providers.values());
  }
}

export const platformProviderRegistry = new PlatformProviderRegistry();
