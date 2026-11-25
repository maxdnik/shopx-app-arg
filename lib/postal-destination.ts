import { buildApiUrl } from "./config";
import { isValidQuotePostalCode, normalizeQuotePostalCode } from "./quote-postal-code";

export type PostalLocality = {
  id: string; locality: string; province: string; provinceCode: string; department: string;
};
export type PostalDestination = {
  postalCode: string; numericPostalCode: string;
  status: "resolved" | "ambiguous" | "not_found" | "invalid" | "missing";
  locality: string | null; province: string | null; provinces: string[];
  localities: PostalLocality[];
  source: "postal_directory" | "shipping_snapshot" | "pricing_reference";
  selectedLocalityKey?: string;
};

export const normalizePostalCode = normalizeQuotePostalCode;
export function isValidPostalCode(value: unknown) {
  const code = normalizePostalCode(value);
  // Match the directory's province codes. I and O are not Argentine provinces.
  return isValidQuotePostalCode(code) && (/^[0-9]{4}$/.test(code) || /^[ABCDEFGHJKLMNPQRSTUVWXYZ]/.test(code));
}
export function localityKey(place: PostalLocality) {
  return `${place.provinceCode}:${place.id}:${place.locality}`;
}
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Only a matching locality/province can disambiguate a shared postal code. */
export function matchPostalLocality(destination: PostalDestination, city: string, province: string): PostalLocality | undefined {
  const matches = destination.localities.filter(place => {
    const sameProvince = normalized(place.province) === normalized(province)
      || (place.provinceCode === "C" && ["caba", "capitalfederal"].includes(normalized(province)));
    const sameCity = normalized(place.locality) === normalized(city)
      || (place.provinceCode === "C" && ["caba", "capitalfederal", "ciudaddebuenosaires", "buenosaires"].includes(normalized(city)));
    return sameProvince && sameCity;
  });
  if (destination.selectedLocalityKey) {
    return matches.find(place => localityKey(place) === destination.selectedLocalityKey);
  }
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolvePostalSelection(destination: PostalDestination | null, postalCode: string, city: string, province: string) {
  if (!isValidPostalCode(postalCode)) return "Ingresá 4 números o un CPA completo de Argentina.";
  if (!city.trim() || !province.trim()) return "Completá la localidad y la provincia de entrega.";
  if (destination && normalizePostalCode(destination.postalCode) !== normalizePostalCode(postalCode)) {
    return "Esperá a que se actualice la localidad del código postal.";
  }
  if (destination && destination.localities.length > 0 && !matchPostalLocality(destination, city, province)) {
    return "Elegí una de las localidades correspondientes a tu código postal.";
  }
  return "";
}

export async function lookupPostalDestination(postalCode: string, signal?: AbortSignal): Promise<PostalDestination> {
  const code = normalizePostalCode(postalCode);
  if (!isValidPostalCode(code)) throw new Error("Ingresá 4 números o un CPA completo de Argentina.");
  const response = await fetch(buildApiUrl(`/api/postal-codes?postalCode=${encodeURIComponent(code)}`), { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || !data.destination || !Array.isArray(data.destination.localities)
    || normalizePostalCode(data.destination.postalCode) !== code) {
    throw new Error(data?.error || "No pudimos consultar el código postal. Volvé a intentar.");
  }
  return data.destination as PostalDestination;
}
