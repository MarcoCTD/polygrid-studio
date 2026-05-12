export const ETSY_API_BASE_URL = 'https://api.etsy.com/v3';
export const ETSY_OAUTH_SCOPES = [
  'listings_r',
  'listings_w',
  'listings_d',
  'shops_r',
  'transactions_r',
] as const;

export interface EtsyApiResponse<T> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EtsyMeResponse {
  user_id: number;
}

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  user_id?: number;
  title?: string | null;
  currency_code?: string;
  is_vacation?: boolean;
}

export interface EtsyUserShopsResponse {
  count?: number;
  results: EtsyShop[];
}

export interface EtsyListingResponse {
  listing_id: number;
  state: string;
  title?: string;
  description?: string;
  price?: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  quantity?: number;
  taxonomy_id?: number;
  shipping_profile_id?: number | null;
  return_policy_id?: number | null;
  updated_timestamp?: number;
}

export interface EtsyListingImageResponse {
  listing_image_id: number;
  rank?: number;
  url_fullxfull?: string;
}

export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code?: string;
}

export interface EtsyTransaction {
  transaction_id: number;
  listing_id?: number;
  title?: string;
  quantity?: number;
  price?: EtsyMoney;
  shipping_cost?: EtsyMoney;
}

export interface EtsyReceipt {
  receipt_id: number;
  name?: string;
  buyer_email?: string;
  grandtotal?: EtsyMoney;
  status?: string;
  create_timestamp?: number;
  formatted_address?: string;
  transactions?: EtsyTransaction[];
}

export interface EtsyReceiptsResponse {
  count?: number;
  results: EtsyReceipt[];
}

export interface EtsyShippingProfile {
  shipping_profile_id: number;
  title: string;
}

export interface EtsyShippingProfilesResponse {
  count?: number;
  results: EtsyShippingProfile[];
}

export interface EtsyCreateListingPayload {
  title: string;
  description: string;
  price: string;
  quantity: number;
  taxonomy_id: number;
  who_made: string;
  when_made: string;
  is_supply: boolean;
  shipping_profile_id: number;
  return_policy_id?: number;
  tags?: string[];
}

export interface EtsyUpdateListingPayload {
  title?: string;
  description?: string;
  price?: string;
  quantity?: number;
  taxonomy_id?: number;
  who_made?: string;
  when_made?: string;
  is_supply?: boolean;
  shipping_profile_id?: number;
  return_policy_id?: number;
  state?: 'active' | 'inactive';
  tags?: string[];
}
