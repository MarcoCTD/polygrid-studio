import type {
  Status,
  MaterialType,
  LicenseType,
  LicenseRisk,
  ShippingClass,
  Platform,
} from './schema';

// ============================================================
// Single Source of Truth für deutsche UI-Labels
// DB-Werte bleiben englisch, nur die Anzeige wird gemappt.
// ============================================================

export const STATUS_LABELS: Record<Status, string> = {
  idea: 'Idee',
  review: 'Review',
  print_ready: 'Druckbereit',
  test_print: 'Testdruck',
  launch_ready: 'Startbereit',
  online: 'Online',
  paused: 'Pausiert',
  discontinued: 'Eingestellt',
};

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  PLA: 'PLA',
  PETG: 'PETG',
  TPU: 'TPU',
  ABS: 'ABS',
  Resin: 'Resin',
};

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  own: 'Eigenes Design',
  cc_by: 'CC BY',
  cc_by_sa: 'CC BY-SA',
  cc_by_nc: 'CC BY-NC',
  commercial: 'Kommerzielle Lizenz',
  unclear: 'Unklar',
};

export const LICENSE_RISK_LABELS: Record<LicenseRisk, string> = {
  safe: 'Sicher',
  review_needed: 'Prüfung nötig',
  risky: 'Riskant',
};

export const SHIPPING_LABELS: Record<ShippingClass, string> = {
  Brief: 'Brief',
  Warensendung: 'Warensendung',
  Paket: 'Paket',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

export function getStatusLabel(status: Status): string {
  return STATUS_LABELS[status];
}

export function getMaterialLabel(material: MaterialType): string {
  return MATERIAL_LABELS[material];
}

export function getLicenseTypeLabel(type: LicenseType): string {
  return LICENSE_TYPE_LABELS[type];
}

export function getLicenseRiskLabel(risk: LicenseRisk): string {
  return LICENSE_RISK_LABELS[risk];
}

export function getShippingLabel(shipping: ShippingClass): string {
  return SHIPPING_LABELS[shipping];
}

export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}
