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
