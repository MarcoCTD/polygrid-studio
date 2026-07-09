export const EXPENSE_CATEGORIES = [
  'filament',
  'verpackung',
  'werkzeuge',
  'druckerzubehoer',
  'maschinen_hardware',
  'software_saas',
  'werbung',
  'versand',
  'reisekosten',
  'buero',
  'sonstiges',
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  filament: 'Filament',
  verpackung: 'Verpackung',
  werkzeuge: 'Werkzeuge',
  druckerzubehoer: 'Druckerzubehör',
  maschinen_hardware: 'Maschinen/Hardware',
  software_saas: 'Software/SaaS',
  werbung: 'Werbung',
  versand: 'Versand',
  reisekosten: 'Reisekosten',
  buero: 'Büro',
  sonstiges: 'Sonstiges',
};

export const EXPENSE_SUBCATEGORIES = {
  filament: ['pla', 'petg', 'tpu', 'abs', 'resin', 'sondermaterial'],
  verpackung: ['kartons', 'fuellmaterial', 'klebeband', 'aufkleber'],
  werkzeuge: ['spatel', 'pinzette', 'cutter', 'messinstrumente'],
  druckerzubehoer: ['duesen', 'druckbett', 'riemen', 'ersatzteile'],
  maschinen_hardware: ['drucker', 'enclosure', 'upgrades', 'computer'],
  // hosting/domain/wartung: wiederkehrende Website-Kosten (Modul 16)
  software_saas: [
    'cad_software',
    'slicer_lizenz',
    'cloud_dienste',
    'ki_api',
    'hosting',
    'domain',
    'wartung',
  ],
  werbung: ['etsy_ads', 'social_media', 'fotografie'],
  versand: ['briefmarken', 'dhl', 'hermes'],
  reisekosten: ['messen', 'abholung', 'materialbesorgung'],
  buero: ['papier', 'tinte', 'ordner'],
  sonstiges: ['alles_andere'],
} as const satisfies Record<(typeof EXPENSE_CATEGORIES)[number], readonly string[]>;

export const EXPENSE_SUBCATEGORY_LABELS: Record<ExpenseSubcategory, string> = {
  pla: 'PLA',
  petg: 'PETG',
  tpu: 'TPU',
  abs: 'ABS',
  resin: 'Resin',
  sondermaterial: 'Sondermaterial',
  kartons: 'Kartons',
  fuellmaterial: 'Füllmaterial',
  klebeband: 'Klebeband',
  aufkleber: 'Aufkleber',
  spatel: 'Spatel',
  pinzette: 'Pinzette',
  cutter: 'Cutter',
  messinstrumente: 'Messinstrumente',
  duesen: 'Düsen',
  druckbett: 'Druckbett',
  riemen: 'Riemen',
  ersatzteile: 'Ersatzteile',
  drucker: 'Drucker',
  enclosure: 'Enclosure',
  upgrades: 'Upgrades',
  computer: 'Computer',
  cad_software: 'CAD-Software',
  slicer_lizenz: 'Slicer-Lizenz',
  cloud_dienste: 'Cloud-Dienste',
  ki_api: 'KI-API',
  hosting: 'Hosting',
  domain: 'Domain',
  wartung: 'Wartung',
  etsy_ads: 'Etsy Ads',
  social_media: 'Social Media',
  fotografie: 'Fotografie',
  briefmarken: 'Briefmarken',
  dhl: 'DHL',
  hermes: 'Hermes',
  messen: 'Messen',
  abholung: 'Abholung',
  materialbesorgung: 'Materialbesorgung',
  papier: 'Papier',
  tinte: 'Tinte',
  ordner: 'Ordner',
  alles_andere: 'Alles andere',
};

export const PAYMENT_METHODS = ['n26_konto', 'paypal', 'kreditkarte', 'bar', 'sonstiges'] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  n26_konto: 'N26 Konto',
  paypal: 'PayPal',
  kreditkarte: 'Kreditkarte',
  bar: 'Bar',
  sonstiges: 'Sonstiges',
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  filament: 'bg-blue-100 text-blue-800 border-blue-200',
  verpackung: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  werkzeuge: 'bg-zinc-100 text-zinc-800 border-zinc-200',
  druckerzubehoer: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  maschinen_hardware: 'bg-slate-100 text-slate-800 border-slate-200',
  software_saas: 'bg-violet-100 text-violet-800 border-violet-200',
  werbung: 'bg-pink-100 text-pink-800 border-pink-200',
  versand: 'bg-amber-100 text-amber-800 border-amber-200',
  reisekosten: 'bg-orange-100 text-orange-800 border-orange-200',
  buero: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  sonstiges: 'bg-stone-100 text-stone-800 border-stone-200',
};

export const EXPENSE_CATEGORY_CHART_COLORS: Record<ExpenseCategory, string> = {
  filament: '#2563eb',
  verpackung: '#059669',
  werkzeuge: '#52525b',
  druckerzubehoer: '#0891b2',
  maschinen_hardware: '#475569',
  software_saas: '#7c3aed',
  werbung: '#db2777',
  versand: '#d97706',
  reisekosten: '#ea580c',
  buero: '#4f46e5',
  sonstiges: '#78716c',
};

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseSubcategory =
  (typeof EXPENSE_SUBCATEGORIES)[keyof typeof EXPENSE_SUBCATEGORIES][number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
