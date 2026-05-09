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

  filament_prices: {
    PLA: 22,
    PETG: 25,
    TPU: 28,
    ABS: 24,
    Resin: 45,
  },
  platform_fees: {
    etsy: { percent: 6.5, fixed: 0.2 },
    ebay: { percent: 11, fixed: 0 },
    kleinanzeigen: { percent: 0, fixed: 0 },
  },
  shipping_classes: [
    { name: 'Brief', price: 1.6 },
    { name: 'Warensendung', price: 2.25 },
    { name: 'Paeckchen S', price: 3.99 },
    { name: 'Paket', price: 6.99 },
  ],
  printer_power_watts: 200,
  electricity_price_per_kwh: 0.35,
  shipping_paid_by_customer_default: true,
  color_variants_library: [],

  ai_preferred_provider: 'claude',
  ai_preferred_model_claude: 'claude-sonnet-4-20250514',
  ai_preferred_model_openai: 'gpt-4o',
  ai_preferred_model_ollama: 'llama3',
  ai_monthly_limit_eur: 10,
  ai_logging_enabled: true,
  ai_mode: 'suggest_confirm',
  ai_ollama_endpoint: 'http://localhost:11434',

  brand_writing_style: 'sachlich-minimalistisch',
  brand_preferred_words: [],
  brand_forbidden_phrases: [],
  brand_reference_text: '',

  receipt_number_prefix_format: 'YYYY-NNNN',
  receipt_number_min_digits: 4,
  tax_lock_default_for_yearly_export: true,
  tax_lock_default_for_monthly_export: false,
  tax_status: 'kleinunternehmer_19_ustg',
  bank_csv_format_default: 'n26',
  bank_match_amount_tolerance_eur: 0.02,
  bank_match_time_window_days_orders: 14,
  bank_match_time_window_days_expenses: 7,
  payout_keywords_etsy: ['Etsy', 'Etsy Ireland', 'Etsy Inc'],
  payout_keywords_ebay: ['eBay', 'Ebay Marketplaces'],

  backup_directory: '',
  last_backup_at: '',
} as const;

export type SettingKey = keyof typeof DEFAULTS;
