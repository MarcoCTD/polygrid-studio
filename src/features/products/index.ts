export { ProductsPage } from './ProductsPage';

// Schema & Types
export {
  productSchema,
  productCreateSchema,
  productUpdateSchema,
  statusEnum,
  materialTypeEnum,
  licenseTypeEnum,
  licenseRiskEnum,
  shippingClassEnum,
  platformEnum,
  colorVariantSchema,
  type Product,
  type ProductCreate,
  type ProductUpdate,
  type Status,
  type MaterialType,
  type LicenseType,
  type LicenseRisk,
  type ShippingClass,
  type Platform,
  type ColorVariant,
} from './schema';

// DB Service
export {
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  hardDeleteProduct,
  duplicateProduct,
  getProduct,
  listProducts,
  listTrashedProducts,
  type ProductFilters,
} from './db';

// Defaults & Settings
export { DEFAULT_PRODUCT_SETTINGS, type ProductSettings } from './defaults';
export { getProductSettings } from './settings';

// Margin Logic
export { calculateMargin, getMarginColor, getMarginLabel, type MarginResult } from './margin';

// UI Store
export { useProductsUIStore, type ProductsFilterState } from './productsUiStore';

// Components
export { StatusBadge } from './components/StatusBadge';
export { MarginCell } from './components/MarginCell';
export { PlatformIcons } from './components/PlatformIcons';

// Labels (Single Source of Truth für deutsche UI-Labels)
export {
  STATUS_LABELS,
  MATERIAL_LABELS,
  LICENSE_TYPE_LABELS,
  LICENSE_RISK_LABELS,
  SHIPPING_LABELS,
  PLATFORM_LABELS,
  getStatusLabel,
  getMaterialLabel,
  getLicenseTypeLabel,
  getLicenseRiskLabel,
  getShippingLabel,
  getPlatformLabel,
} from './labels';

// Utils
export { formatRelativeDate, formatEUR } from './utils';
