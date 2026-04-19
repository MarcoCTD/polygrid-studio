import { getSetting } from '@/services/database';
import { DEFAULT_PRODUCT_SETTINGS, type ProductSettings } from './defaults';

/**
 * Liest Produktions-/Plattform-Parameter aus app_settings und mergt mit Defaults.
 * Fehlende Keys werden durch Defaults aufgefüllt.
 */
export async function getProductSettings(): Promise<ProductSettings> {
  const settings = { ...DEFAULT_PRODUCT_SETTINGS };

  try {
    const filamentPrices = await getSetting<Record<string, number>>('filament_prices');
    if (filamentPrices) {
      settings.filamentPrices = { ...settings.filamentPrices, ...filamentPrices };
    }

    const electricityPrice = await getSetting<number>('electricity_price_per_kwh');
    if (electricityPrice !== null) {
      settings.electricityPricePerKwh = electricityPrice;
    }

    const printerPower = await getSetting<number>('printer_power_watts');
    if (printerPower !== null) {
      settings.printerPowerWatts = printerPower;
    }

    const shippingPrices = await getSetting<Record<string, number>>('shipping_prices');
    if (shippingPrices) {
      settings.shippingPrices = { ...settings.shippingPrices, ...shippingPrices };
    }

    const platformFees =
      await getSetting<Record<string, { percent: number; fixed: number }>>('platform_fees');
    if (platformFees) {
      settings.platformFees = { ...settings.platformFees, ...platformFees };
    }
  } catch {
    // Bei Lesefehlern: Defaults verwenden
  }

  return settings;
}
