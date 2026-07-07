/**
 * Zentrale Schwellenwerte der Smart-Action-Regeln (Modul 15).
 * Im MVP bewusst NICHT über die Settings konfigurierbar – Änderungen
 * erfolgen hier im Code (siehe Spec Abschnitt 4).
 */

/** orders_stuck: Aufträge länger als N Tage in Produktion */
export const ORDERS_STUCK_DAYS = 5;

/** orders_unshipped: bezahlte Aufträge, die nach N Tagen noch nicht versendet sind */
export const ORDERS_UNSHIPPED_DAYS = 2;

/** product_no_listing: Produkte mit mindestens N Verkäufen ohne aktives Listing */
export const PRODUCT_NO_LISTING_MIN_SALES = 3;

/** margin_low_seller: Marge unter N Prozent bei Produkten mit Verkäufen (90 Tage) */
export const MARGIN_LOW_THRESHOLD_PERCENT = 15;

/** backup_stale: letztes Backup älter als N Tage */
export const BACKUP_STALE_DAYS = 7;

/** Snooze-Dauer beim Verwerfen einer Karte */
export const SNOOZE_DAYS = 7;

/** Evaluierung höchstens alle N Minuten (Cache) */
export const CACHE_TTL_MINUTES = 5;
