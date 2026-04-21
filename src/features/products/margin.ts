import type { Product, Platform } from './schema';
import type { ProductSettings } from './defaults';

export interface MarginResult {
  materialCost: number;
  electricityCost: number;
  packagingCost: number;
  shippingCost: number;
  platformFee: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  marginPercent: number;
}

/**
 * Berechnet die Marge eines Produkts für eine bestimmte Plattform.
 *
 * Formeln (aus Spec Abschnitt 4.2):
 * - Materialkosten = material_grams * filament_price[material] / 1000
 * - Stromkosten = (print_time_min * printer_power_W * preis_kWh) / 60000
 * - Plattformgebühr = verkaufspreis * percent / 100 + fixed
 * - Marge = (Rohgewinn / Verkaufspreis) * 100
 *
 * @param platform - null = "Alle" (target_price, durchschnittliche Gebühren)
 */
export function calculateMargin(
  product: Product,
  settings: ProductSettings,
  platform: Platform | null,
): MarginResult {
  // Materialkosten
  const materialCost = product.material_grams
    ? (product.material_grams * (settings.filamentPrices[product.material_type] ?? 0)) / 1000
    : 0;

  // Stromkosten
  const electricityCost = product.print_time_minutes
    ? (product.print_time_minutes * settings.printerPowerWatts * settings.electricityPricePerKwh) /
      60000
    : 0;

  // Verpackung
  const packagingCost = product.packaging_cost ?? 0;

  // Versand: nur einrechnen, wenn WIR (nicht der Käufer) den Versand zahlen.
  // Produktfeld überschreibt den globalen Default; NULL = Default verwenden.
  const effectiveShippingPaidByCustomer =
    product.shipping_paid_by_customer !== null && product.shipping_paid_by_customer !== undefined
      ? product.shipping_paid_by_customer
      : settings.shippingPaidByCustomerDefault;

  const shippingCost =
    !effectiveShippingPaidByCustomer && product.shipping_class
      ? (settings.shippingPrices[product.shipping_class] ?? 0)
      : 0;

  // Verkaufspreis je nach Plattform
  let sellingPrice: number;
  if (platform) {
    const platformPriceMap: Record<Platform, number | null> = {
      etsy: product.price_etsy,
      ebay: product.price_ebay,
      kleinanzeigen: product.price_kleinanzeigen,
    };
    sellingPrice = platformPriceMap[platform] ?? product.target_price ?? 0;
  } else {
    sellingPrice = product.target_price ?? 0;
  }

  // Plattformgebühr
  let platformFee: number;
  if (platform) {
    const fee = settings.platformFees[platform];
    platformFee = fee ? (sellingPrice * fee.percent) / 100 + fee.fixed : 0;
  } else {
    // "Alle": Durchschnitt über aktivierte Plattformen
    const activePlatforms = product.platforms ?? [];
    if (activePlatforms.length > 0) {
      let totalFee = 0;
      for (const p of activePlatforms) {
        const fee = settings.platformFees[p];
        if (fee) {
          totalFee += (sellingPrice * fee.percent) / 100 + fee.fixed;
        }
      }
      platformFee = totalFee / activePlatforms.length;
    } else {
      platformFee = 0;
    }
  }

  const totalCost = materialCost + electricityCost + packagingCost + shippingCost + platformFee;
  const profit = sellingPrice - totalCost;
  const marginPercent = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return {
    materialCost,
    electricityCost,
    packagingCost,
    shippingCost,
    platformFee,
    totalCost,
    sellingPrice,
    profit,
    marginPercent,
  };
}

/**
 * Bestimmt die Ampel-Farbe basierend auf der Marge.
 *
 * Spec Abschnitt 4.4:
 * > 50%  → success (Exzellent)
 * 30-50% → success (Gut)
 * 15-30% → warning (Akzeptabel)
 * 0-15%  → warning (Kritisch)
 * < 0%   → danger (Verlust)
 */
export function getMarginColor(marginPercent: number): 'success' | 'warning' | 'danger' {
  if (marginPercent >= 30) return 'success';
  if (marginPercent >= 15) return 'warning';
  if (marginPercent >= 0) return 'warning';
  return 'danger';
}

/**
 * Gibt eine Bewertung der Marge als Text zurück.
 */
export function getMarginLabel(marginPercent: number): string {
  if (marginPercent > 50) return 'Exzellent';
  if (marginPercent >= 30) return 'Gut';
  if (marginPercent >= 15) return 'Akzeptabel';
  if (marginPercent >= 0) return 'Kritisch';
  return 'Verlust';
}
