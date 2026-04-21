import type { MaterialType, ShippingClass, Platform } from './schema';

/**
 * Default-Parameter für die Margenberechnung.
 * Werden verwendet, wenn in app_settings keine Werte hinterlegt sind.
 * Die vollständige Settings-UI zur Pflege kommt in Modul 11.
 */

export interface ProductSettings {
  filamentPrices: Record<MaterialType, number>; // EUR pro kg
  electricityPricePerKwh: number;
  printerPowerWatts: number;
  shippingPrices: Record<ShippingClass, number>;
  platformFees: Record<Platform, { percent: number; fixed: number }>;
  /** true = Käufer zahlt Versand (Versand NICHT in Marge), false = wir zahlen */
  shippingPaidByCustomerDefault: boolean;
}

/** Settings-Key für den globalen Default "Wer zahlt den Versand?" */
export const SHIPPING_PAID_BY_CUSTOMER_DEFAULT_KEY = 'shipping_paid_by_customer_default';
/** Globaler Default: true = Käufer zahlt Versand standardmäßig */
export const SHIPPING_PAID_BY_CUSTOMER_DEFAULT_VALUE = true;

export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  filamentPrices: {
    PLA: 22.0,
    PETG: 25.0,
    TPU: 35.0,
    ABS: 28.0,
    Resin: 45.0,
  },
  electricityPricePerKwh: 0.35,
  printerPowerWatts: 200,
  shippingPrices: {
    Brief: 1.95,
    Warensendung: 2.75,
    Paket: 6.0,
  },
  platformFees: {
    etsy: { percent: 6.5, fixed: 0.2 },
    ebay: { percent: 11.0, fixed: 0.0 },
    kleinanzeigen: { percent: 0.0, fixed: 0.0 },
  },
  shippingPaidByCustomerDefault: SHIPPING_PAID_BY_CUSTOMER_DEFAULT_VALUE,
};
