import { DEFAULT_MODELS } from '@/services/ai/models';

export const DEFAULTS = {
  theme: 'system',
  accent_color: 'sap_blue',
  sidebar_collapsed: false,

  company_name: 'PolyGrid Studio',
  language: 'de',
  date_format: 'DD.MM.YYYY',

  onedrive_root_path: '',
  onedrive_base_path: '',

  dashboard_auto_snapshot: true,
  margin_warning_threshold: 30,
  dashboard_kpi_snapshot_auto: true,
  dashboard_low_margin_threshold: 30,

  filament_prices: [
    { name: 'PLA', pricePerKg: 22 },
    { name: 'PETG', pricePerKg: 25 },
    { name: 'TPU', pricePerKg: 28 },
    { name: 'ABS', pricePerKg: 24 },
    { name: 'Resin', pricePerKg: 45 },
  ],
  platform_fees: {
    etsy: { percentFee: 6.5, fixedFee: 0.2 },
    ebay: { percentFee: 11, fixedFee: 0 },
    kleinanzeigen: { percentFee: 0, fixedFee: 0 },
    website: { percentFee: 0, fixedFee: 0 },
  },
  shipping_classes: [
    { name: 'Brief', price: 1.6 },
    { name: 'Warensendung', price: 2.25 },
    { name: 'Päckchen S', price: 3.99 },
    { name: 'Paket', price: 6.99 },
  ],
  printer_power_watts: 200,
  electricity_price_per_kwh: 0.35,
  shipping_paid_by_buyer: true,
  shipping_paid_by_customer_default: true,
  color_variants_library: [],

  ai_preferred_provider: 'claude',
  ai_preferred_model_claude: DEFAULT_MODELS.claude,
  ai_preferred_model_openai: DEFAULT_MODELS.openai,
  ai_preferred_model_gemini: DEFAULT_MODELS.gemini,
  ai_preferred_model_ollama: DEFAULT_MODELS.ollama,
  ai_ollama_model: DEFAULT_MODELS.ollama,
  ai_cost_limit_monthly: 10,
  ai_monthly_limit_eur: 10,
  ai_logging_enabled: true,
  ai_operation_mode: 'suggest_confirm',
  ai_mode: 'suggest_confirm',
  ollama_endpoint: 'http://localhost:11434',
  ai_ollama_endpoint: 'http://localhost:11434',

  brand_writing_style: 'sachlich-minimalistisch',
  brand_keywords: [],
  brand_no_go_phrases: [],
  brand_preferred_words: [],
  brand_forbidden_phrases: [],
  brand_reference_text: '',

  backup_interval_hours: 24,
  backup_max_count: 30,
  archive_retention_days: 30,

  receipt_number_prefix_format: 'YYYY-NNNN',
  receipt_number_format: 'YYYY-NNNN',
  receipt_number_min_digits: 4,
  tax_lock_default_for_yearly_export: true,
  tax_lock_default_for_monthly_export: false,
  tax_status: 'kleinunternehmer_19_ustg',
  tax_lock_monthly: false,
  tax_lock_yearly: true,
  bank_csv_format: 'n26',
  bank_csv_format_default: 'n26',
  bank_matching_amount_tolerance: 0.02,
  bank_match_amount_tolerance_eur: 0.02,
  bank_matching_order_days: 14,
  bank_match_time_window_days_orders: 14,
  bank_matching_expense_days: 7,
  bank_match_time_window_days_expenses: 7,
  payout_keywords_etsy: ['Etsy', 'Etsy Ireland', 'Etsy Inc'],
  payout_keywords_ebay: ['eBay', 'Ebay Marketplaces'],

  backup_directory: '',
  last_backup_at: '',

  // Rechnungsstellung (Modul 17) – Firmen-Stammdaten und Dokument-Defaults
  invoice_owner_name: '',
  invoice_street: '',
  invoice_zip: '',
  invoice_city: '',
  invoice_tax_number: '',
  invoice_vat_id: '',
  invoice_iban: '',
  invoice_bic: '',
  invoice_bank_name: '',
  invoice_payment_terms_days: 14,
  invoice_quote_validity_days: 30,
  // Logo als Data-URL (Kopie der gewählten Datei, siehe ENTSCHEIDUNGEN_MODUL_17 E17-04)
  invoice_logo: '',
  invoice_default_layout: 'modern',
  // Feste Markenfarbe (Hex); leer = App-Akzentfarbe verwenden
  invoice_brand_color: '',
} as const;

export type SettingKey = keyof typeof DEFAULTS;
