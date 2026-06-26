// Supported store currencies (the Stripe charge/presentment currency). Prices
// are stored as price_cents (major units × 100); utils/stripe.js stripeUnitAmount()
// converts to the correct Stripe `unit_amount` per currency (incl. zero-decimal),
// and Intl.NumberFormat renders the right symbol (R$, €, …). One list, used by the
// store-currency picker + the save endpoint's validation.
export const STORE_CURRENCIES = [
  ['usd', 'USD — US Dollar ($)'],
  ['brl', 'BRL — Brazilian Real (R$)'],
  ['eur', 'EUR — Euro (€)'],
  ['gbp', 'GBP — British Pound (£)'],
  ['mxn', 'MXN — Mexican Peso ($)'],
  ['ars', 'ARS — Argentine Peso ($)'],
  ['cop', 'COP — Colombian Peso ($)'],
  ['clp', 'CLP — Chilean Peso ($)'],
  ['pen', 'PEN — Peruvian Sol (S/)'],
  ['uyu', 'UYU — Uruguayan Peso ($)'],
  ['cad', 'CAD — Canadian Dollar (C$)'],
  ['aud', 'AUD — Australian Dollar (A$)'],
  ['chf', 'CHF — Swiss Franc'],
];

export const STORE_CURRENCY_CODES = new Set(STORE_CURRENCIES.map(([c]) => c));

/** Is `code` one of the supported store currencies? */
export function isValidStoreCurrency(code) {
  return STORE_CURRENCY_CODES.has(String(code || '').toLowerCase());
}
