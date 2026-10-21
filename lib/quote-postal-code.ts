// Accept the four-digit Argentine postal code or the complete CPA.
export const QUOTE_POSTAL_CODE_PATTERN = "(?:[0-9]{4}|[A-Z][0-9]{4}[A-Z]{3})";
export const QUOTE_POSTAL_CODE_ERROR =
  "Ingresá tu código postal: 4 números (ej. 1425) o el CPA completo (ej. C1425ABC).";
const postalCodePattern = new RegExp(`^${QUOTE_POSTAL_CODE_PATTERN}$`);

export function normalizeQuotePostalCode(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s/g, "").toUpperCase() : "";
}

export function isValidQuotePostalCode(value: unknown): boolean {
  return postalCodePattern.test(normalizeQuotePostalCode(value));
}

