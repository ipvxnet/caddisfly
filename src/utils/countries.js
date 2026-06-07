// ISO 3166-1 alpha-2 country codes + names, for the domain-registrant country
// picker (free-text let invalid codes like "UN" through). Used to render the
// dropdown and to validate the submitted code server-side.

export const COUNTRIES = [
  ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'],
  ['BR', 'Brazil'], ['PT', 'Portugal'], ['ES', 'Spain'], ['MX', 'Mexico'], ['AR', 'Argentina'],
  ['DE', 'Germany'], ['FR', 'France'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BE', 'Belgium'],
  ['IE', 'Ireland'], ['CH', 'Switzerland'], ['AT', 'Austria'], ['SE', 'Sweden'], ['NO', 'Norway'],
  ['DK', 'Denmark'], ['FI', 'Finland'], ['PL', 'Poland'], ['CZ', 'Czechia'], ['RO', 'Romania'],
  ['GR', 'Greece'], ['HU', 'Hungary'], ['SK', 'Slovakia'], ['SI', 'Slovenia'], ['HR', 'Croatia'],
  ['BG', 'Bulgaria'], ['LT', 'Lithuania'], ['LV', 'Latvia'], ['EE', 'Estonia'], ['LU', 'Luxembourg'],
  ['IS', 'Iceland'], ['MT', 'Malta'], ['CY', 'Cyprus'],
  ['CL', 'Chile'], ['CO', 'Colombia'], ['PE', 'Peru'], ['UY', 'Uruguay'], ['PY', 'Paraguay'],
  ['BO', 'Bolivia'], ['EC', 'Ecuador'], ['VE', 'Venezuela'], ['CR', 'Costa Rica'], ['PA', 'Panama'],
  ['GT', 'Guatemala'], ['DO', 'Dominican Republic'], ['PR', 'Puerto Rico'],
  ['JP', 'Japan'], ['CN', 'China'], ['KR', 'South Korea'], ['IN', 'India'], ['SG', 'Singapore'],
  ['HK', 'Hong Kong'], ['TW', 'Taiwan'], ['TH', 'Thailand'], ['MY', 'Malaysia'], ['ID', 'Indonesia'],
  ['PH', 'Philippines'], ['VN', 'Vietnam'], ['NZ', 'New Zealand'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['IL', 'Israel'], ['TR', 'Turkey'],
  ['ZA', 'South Africa'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['EG', 'Egypt'], ['MA', 'Morocco'],
  ['RU', 'Russia'], ['UA', 'Ukraine'],
];

const CODES = new Set(COUNTRIES.map(([c]) => c));
export function isValidCountry(code) {
  return typeof code === 'string' && CODES.has(code.toUpperCase());
}

/** Pre-rendered <option> list (US selected) for the registrant form. */
export function countryOptions(selected = 'US') {
  return COUNTRIES.map(
    ([code, name]) => `<option value="${code}"${code === selected ? ' selected' : ''}>${name}</option>`
  ).join('');
}
