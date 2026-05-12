export const EBAY_OAUTH_BASE_URL = 'https://auth.ebay.com/oauth2/authorize';
export const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
export const EBAY_API_BASE_URL = 'https://api.ebay.com';
export const EBAY_TRADING_API_URL = 'https://api.ebay.com/ws/api.dll';
export const EBAY_OAUTH_PORT = 58432;
export const EBAY_TRADING_COMPATIBILITY_LEVEL = '967';

export const EBAY_OAUTH_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.account',
] as const;

export interface EbayApiResponse<T> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export interface EbayTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
}

export interface EbayErrorDetail {
  errorId?: number;
  domain?: string;
  category?: string;
  message?: string;
  longMessage?: string;
  inputRefIds?: string[];
  outputRefIds?: string[];
  parameters?: Array<{ name?: string; value?: string }>;
}

export interface EbayErrorResponse {
  errors?: EbayErrorDetail[];
  error?: string;
  error_description?: string;
}

export interface EbayMoney {
  value: string;
  currency: string;
}

export interface EbayInventoryItemPayload {
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  condition: 'NEW';
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects: Record<string, string[]>;
  };
}

export interface EbayInventoryItemResponse {
  sku?: string;
  availability?: EbayInventoryItemPayload['availability'];
  condition?: string;
  product?: EbayInventoryItemPayload['product'];
}

export interface EbayOfferPayload {
  sku: string;
  marketplaceId: string;
  format: 'FIXED_PRICE';
  listingDescription: string;
  availableQuantity: number;
  pricingSummary: {
    price: EbayMoney;
  };
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  categoryId: string;
  merchantLocationKey: string;
}

export interface EbayOfferResponse {
  offerId: string;
  warnings?: EbayErrorDetail[];
}

export interface EbayPublishOfferResponse {
  listingId: string;
  warnings?: EbayErrorDetail[];
}

export interface EbayTradingPictureResponse {
  fullUrl: string;
  pictureSet?: string;
  pictureName?: string;
  ack?: string;
}

export interface EbayFulfillmentPolicy {
  fulfillmentPolicyId: string;
  name: string;
  marketplaceId?: string;
  categoryTypes?: Array<{ name?: string; default?: boolean }>;
}

export interface EbayPaymentPolicy {
  paymentPolicyId: string;
  name: string;
  marketplaceId?: string;
  categoryTypes?: Array<{ name?: string; default?: boolean }>;
}

export interface EbayReturnPolicy {
  returnPolicyId: string;
  name: string;
  marketplaceId?: string;
  categoryTypes?: Array<{ name?: string; default?: boolean }>;
}

export interface EbayPolicyResponse<TPolicy> {
  total?: number;
  limit?: number;
  offset?: number;
  fulfillmentPolicies?: TPolicy[];
  paymentPolicies?: TPolicy[];
  returnPolicies?: TPolicy[];
}

export interface EbayOrderLineItem {
  lineItemId?: string;
  legacyItemId?: string;
  sku?: string;
  title?: string;
  quantity?: number;
  total?: EbayMoney;
  lineItemCost?: EbayMoney;
  deliveryCost?: {
    shippingCost?: EbayMoney;
  };
}

export interface EbayOrder {
  orderId: string;
  creationDate?: string;
  lastModifiedDate?: string;
  orderFulfillmentStatus?: string;
  orderPaymentStatus?: string;
  buyer?: {
    username?: string;
    taxAddress?: {
      fullName?: string;
    };
  };
  pricingSummary?: {
    total?: EbayMoney;
    deliveryCost?: EbayMoney;
  };
  lineItems?: EbayOrderLineItem[];
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        contactAddress?: Record<string, string | undefined>;
      };
    };
  }>;
}

export interface EbayOrdersResponse {
  href?: string;
  limit?: number;
  next?: string;
  offset?: number;
  prev?: string;
  total?: number;
  orders: EbayOrder[];
}

export interface EbayResolvedListing {
  sku: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  marketplaceId: string;
  currency: string;
  categoryId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  aspects: Record<string, string[]>;
}
