import { DEFAULTS, getSettingWithDefault } from '@/services/settings';
import {
  DEFAULT_PRODUCT_SETTINGS,
  SHIPPING_PAID_BY_CUSTOMER_DEFAULT_KEY,
  type ProductSettings,
} from './defaults';
import type { ColorVariant, Platform } from './schema';

interface FilamentPriceSetting {
  name: string;
  pricePerKg: number;
}

interface ShippingClassSetting {
  name: string;
  price: number;
}

interface PlatformFeeSetting {
  percentFee?: number;
  fixedFee?: number;
  percent?: number;
  fixed?: number;
}

function normalizeFilamentPrices(value: unknown): {
  prices: Record<string, number>;
  options: string[];
} {
  if (Array.isArray(value)) {
    const entries = value
      .map((item) => item as Partial<FilamentPriceSetting>)
      .filter((item): item is FilamentPriceSetting => Boolean(item.name?.trim()));
    return {
      prices: Object.fromEntries(
        entries.map((item) => [item.name.trim(), Number(item.pricePerKg) || 0]),
      ),
      options: entries.map((item) => item.name.trim()),
    };
  }

  if (value && typeof value === 'object') {
    const prices = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, price]) => [
        name,
        Number(price) || 0,
      ]),
    );
    return { prices, options: Object.keys(prices) };
  }

  return {
    prices: DEFAULT_PRODUCT_SETTINGS.filamentPrices,
    options: DEFAULT_PRODUCT_SETTINGS.materialOptions,
  };
}

function normalizeShippingClasses(value: unknown): {
  prices: Record<string, number>;
  options: string[];
} {
  if (Array.isArray(value)) {
    const entries = value
      .map((item) => item as Partial<ShippingClassSetting>)
      .filter((item): item is ShippingClassSetting => Boolean(item.name?.trim()));
    return {
      prices: Object.fromEntries(
        entries.map((item) => [item.name.trim(), Number(item.price) || 0]),
      ),
      options: entries.map((item) => item.name.trim()),
    };
  }

  if (value && typeof value === 'object') {
    const prices = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, price]) => [
        name,
        Number(price) || 0,
      ]),
    );
    return { prices, options: Object.keys(prices) };
  }

  return {
    prices: DEFAULT_PRODUCT_SETTINGS.shippingPrices,
    options: DEFAULT_PRODUCT_SETTINGS.shippingClassOptions,
  };
}

function normalizePlatformFees(value: unknown): ProductSettings['platformFees'] {
  const defaults = DEFAULT_PRODUCT_SETTINGS.platformFees;
  if (!value || typeof value !== 'object') return defaults;

  return (Object.keys(defaults) as Platform[]).reduce<ProductSettings['platformFees']>(
    (result, platform) => {
      const fee = (value as Record<string, PlatformFeeSetting>)[platform] ?? {};
      result[platform] = {
        percent: Number(fee.percentFee ?? fee.percent ?? defaults[platform].percent) || 0,
        fixed: Number(fee.fixedFee ?? fee.fixed ?? defaults[platform].fixed) || 0,
      };
      return result;
    },
    { ...defaults },
  );
}

function normalizeColorVariants(value: unknown): ColorVariant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<ColorVariant>)
    .filter(
      (item): item is ColorVariant =>
        Boolean(item.name?.trim()) && /^#[0-9a-fA-F]{6}$/.test(item.hex ?? ''),
    );
}

/**
 * Liest Produktions-/Plattform-Parameter aus app_settings und mergt mit Defaults.
 * Fehlende Keys werden durch Defaults aufgefüllt.
 */
export async function getProductSettings(): Promise<ProductSettings> {
  const settings = { ...DEFAULT_PRODUCT_SETTINGS };

  try {
    const [
      filamentPrices,
      electricityPrice,
      printerPower,
      shippingClasses,
      platformFees,
      colorVariantLibrary,
      shippingPaidByBuyer,
    ] = await Promise.all([
      getSettingWithDefault('filament_prices', DEFAULTS.filament_prices),
      getSettingWithDefault('electricity_price_per_kwh', DEFAULTS.electricity_price_per_kwh),
      getSettingWithDefault('printer_power_watts', DEFAULTS.printer_power_watts),
      getSettingWithDefault('shipping_classes', DEFAULTS.shipping_classes),
      getSettingWithDefault('platform_fees', DEFAULTS.platform_fees),
      getSettingWithDefault('color_variants_library', DEFAULTS.color_variants_library),
      getSettingWithDefault(SHIPPING_PAID_BY_CUSTOMER_DEFAULT_KEY, DEFAULTS.shipping_paid_by_buyer),
    ]);

    const normalizedFilaments = normalizeFilamentPrices(filamentPrices);
    settings.filamentPrices = normalizedFilaments.prices;
    settings.materialOptions = normalizedFilaments.options;

    settings.electricityPricePerKwh = electricityPrice;
    settings.printerPowerWatts = printerPower;

    const normalizedShipping = normalizeShippingClasses(shippingClasses);
    settings.shippingPrices = normalizedShipping.prices;
    settings.shippingClassOptions = normalizedShipping.options;

    settings.platformFees = normalizePlatformFees(platformFees);
    settings.colorVariantLibrary = normalizeColorVariants(colorVariantLibrary);
    settings.shippingPaidByCustomerDefault = shippingPaidByBuyer;
  } catch {
    // Bei Lesefehlern: Defaults verwenden
  }

  return settings;
}
