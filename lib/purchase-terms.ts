// Keep the immutable revision aligned with the canonical ShopX web checkout.
export const PURCHASE_TERMS_VERSION = "2026-11-03-v3";
export const PURCHASE_TERMS_URL = "/terminos/versiones/2026-11-03-v3";
export const PURCHASE_TERMS_LABEL = "Leí y acepto los Términos y Condiciones, incluida la revisión del flete por peso, volumen o cantidad de bultos.";
export const PURCHASE_TERMS_NOTICE = "El flete se calcula con el peso, las medidas y los bultos informados. Si al verificarlos hay diferencias, datos incorrectos del vendedor o un error de cálculo, puede corresponder un adicional de envío. Te informaremos el motivo y el importe para que puedas abonarlo y continuar, o solicitar la cancelación con reintegro total.";
export const FREIGHT_PRICE_NOTICE = "Flete sujeto a verificación de peso, volumen y cantidad de bultos. Una diferencia comprobada puede generar un adicional de envío.";
export const PURCHASE_TERMS_ERROR = "Para continuar, leé y aceptá los Términos y Condiciones de esta compra.";
export const ACCOUNT_TERMS_LABEL = "Acepto los Términos y Condiciones";
export const ACCOUNT_TERMS_ERROR = "Aceptá los Términos y Condiciones para crear tu cuenta.";

export type PurchaseTermsInput = { accepted: true; version: typeof PURCHASE_TERMS_VERSION };
export function purchaseTermsInput(accepted: boolean): PurchaseTermsInput | undefined {
  return accepted ? { accepted: true, version: PURCHASE_TERMS_VERSION } : undefined;
}
