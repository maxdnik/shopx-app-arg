import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { BenefitCheckoutPayload } from "./cart-pricing";

const STORAGE_KEY = "SHOPX_BENEFIT_ATTEMPT_V1";
const PENDING_KEY = "SHOPX_PENDING_BENEFIT_V1_";
export type PendingBenefitAttempt = {
  payload: BenefitCheckoutPayload;
  settlementItems: (BenefitCheckoutPayload["items"][number] & { cartAddedAt?: string })[];
};

async function pendingKey(email: string) {
  return PENDING_KEY + await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email.trim().toLowerCase());
}
let mutation: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutation.then(operation, operation);
  mutation = next.catch(() => undefined);
  return next;
}

/** Keep an interrupted redemption safe to retry, including after restarting the app. */
export function benefitAttemptKey(fingerprint: string) {
  return serialize(async () => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint);
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    let previous: { hash?: string; key?: string } | null = null;
    try { previous = saved ? JSON.parse(saved) : null; } catch { /* Discard invalid local state. */ }
    if (previous?.hash === hash && typeof previous.key === "string" && /^[A-Za-z0-9_-]{16,120}$/.test(previous.key)) return previous.key;
    const key = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ hash, key }));
    return key;
  });
}

export function clearBenefitAttempt(key: string) {
  return serialize(async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    try {
      if (saved && JSON.parse(saved)?.key === key) await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* A newer or invalid record must not invalidate the completed order. */ }
  });
}

/** Retain the exact reviewed request until the server confirms its outcome. */
export function savePendingBenefitAttempt(email: string, attempt: PendingBenefitAttempt) {
  return serialize(async () => {
    if (attempt.payload.buyer.email.trim().toLowerCase() !== email.trim().toLowerCase()) throw new Error("El canje corresponde a otra cuenta.");
    await AsyncStorage.setItem(await pendingKey(email), JSON.stringify(attempt));
  });
}

export function getPendingBenefitAttempt(email: string): Promise<PendingBenefitAttempt | null> {
  return serialize(async () => {
    const saved = await AsyncStorage.getItem(await pendingKey(email));
    if (!saved) return null;
    try {
      const value = JSON.parse(saved) as PendingBenefitAttempt;
      if (typeof value.payload?.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,120}$/.test(value.payload.idempotencyKey)
        || value.payload?.buyer?.email?.trim().toLowerCase() !== email.trim().toLowerCase()
        || !Array.isArray(value.payload.items) || !value.payload.items.length || !Array.isArray(value.settlementItems)) throw new Error();
      return value;
    } catch {
      throw new Error("No pudimos recuperar el canje pendiente. Revisá tus pedidos antes de iniciar otra compra.");
    }
  });
}

export function clearPendingBenefitAttempt(email: string, idempotencyKey: string) {
  return serialize(async () => {
    const key = await pendingKey(email);
    const saved = await AsyncStorage.getItem(key);
    if (!saved) return;
    const value = JSON.parse(saved) as PendingBenefitAttempt;
    if (value.payload?.idempotencyKey === idempotencyKey) await AsyncStorage.removeItem(key);
  });
}
