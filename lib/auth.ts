// lib/auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiUrl } from "./config";

const AUTH_TOKEN_KEY = "shopx_auth_token";
const AUTH_USER_KEY = "shopx_auth_user";

export type ShopXAddress = {
  street?: string;
  streetName?: string;
  streetNumber?: string;
  floor?: string;
  apartment?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type ShopXBilling = {
  fullName?: string;
  dni?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export type ShopXArca = {
  enabled?: boolean;
  totalUSD?: number;
  usedUSD?: number;
};

export type ShopXUser = {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
  dni?: string;
  image?: string;
  role?: string;
  emailVerified?: boolean;
  address?: ShopXAddress;
  billing?: ShopXBilling;
  arca?: ShopXArca;
  createdAt?: string;
  updatedAt?: string;
};

export type CheckoutProfile = {
  complete: boolean;
  missingFields: string[];
};

export type AuthResponse = {
  ok: boolean;
  token?: string;
  tokenType?: string;
  expiresIn?: string;
  user?: ShopXUser;
  error?: string;
  message?: string;
};

export type AccountResponse = {
  ok: boolean;
  user?: ShopXUser;
  checkoutProfile?: CheckoutProfile;
  error?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  dni?: string;
};

export type GoogleLoginPayload = {
  idToken: string;
};

export type AppleLoginPayload = {
  identityToken: string;
  authorizationCode?: string | null;
  email?: string | null;
  fullName?: string | null;
};

export type UpdateAccountPayload = {
  fullName?: string;
  name?: string;
  phone?: string;
  dni?: string;
  address?: ShopXAddress;
  billing?: ShopXBilling;
  arca?: ShopXArca;
};

function cleanEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: any = null;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta inválida del servidor");
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || "Error de autenticación");
  }

  return data as T;
}

async function saveSession(token: string, user: ShopXUser) {
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, token],
    [AUTH_USER_KEY, JSON.stringify(user)],
  ]);
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<ShopXUser | null> {
  const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as ShopXUser;
  } catch {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export async function loginApp(payload: LoginPayload): Promise<ShopXUser> {
  const response = await fetch(buildApiUrl("/api/app/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: cleanEmail(payload.email),
      password: payload.password,
    }),
  });

  const data = await parseJsonResponse<AuthResponse>(response);

  if (!data.token || !data.user) {
    throw new Error("No se pudo iniciar sesión.");
  }

  await saveSession(data.token, data.user);

  return data.user;
}

export async function loginWithGoogleApp(
  payload: GoogleLoginPayload
): Promise<ShopXUser> {
  const idToken = String(payload.idToken || "").trim();

  if (!idToken) {
    throw new Error("No recibimos el token de Google.");
  }

  const response = await fetch(buildApiUrl("/api/app/auth/google"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  const data = await parseJsonResponse<AuthResponse>(response);

  if (!data.token || !data.user) {
    throw new Error("No se pudo iniciar sesión con Google.");
  }

  await saveSession(data.token, data.user);

  return data.user;
}

export async function loginWithAppleApp(
  payload: AppleLoginPayload
): Promise<ShopXUser> {
  const identityToken = String(payload.identityToken || "").trim();

  if (!identityToken) {
    throw new Error("Apple no devolvió una sesión válida.");
  }

  const response = await fetch(buildApiUrl("/api/app/auth/apple"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identityToken,
      authorizationCode: payload.authorizationCode || "",
      email: payload.email || "",
      fullName: payload.fullName || "",
    }),
  });

  const data = await parseJsonResponse<AuthResponse>(response);

  if (!data.token || !data.user) {
    throw new Error("No se pudo iniciar sesión con Apple.");
  }

  await saveSession(data.token, data.user);

  return data.user;
}

export async function registerApp(
  payload: RegisterPayload
): Promise<ShopXUser> {
  const response = await fetch(buildApiUrl("/api/app/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName: payload.fullName.trim(),
      email: cleanEmail(payload.email),
      phone: payload.phone?.trim() || "",
      password: payload.password,
      dni: payload.dni?.trim() || "",
    }),
  });

  const data = await parseJsonResponse<AuthResponse>(response);

  if (!data.token || !data.user) {
    throw new Error("No se pudo crear la cuenta.");
  }

  await saveSession(data.token, data.user);

  return data.user;
}

export async function fetchCurrentUser(): Promise<ShopXUser | null> {
  const token = await getAuthToken();

  if (!token) return null;

  try {
    const response = await fetch(buildApiUrl("/api/app/auth/me"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseJsonResponse<AuthResponse>(response);

    if (!data.user) return null;

    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

    return data.user;
  } catch {
    await logoutApp();
    return null;
  }
}

export async function getCurrentUser(): Promise<ShopXUser | null> {
  const storedUser = await getStoredUser();

  if (storedUser) return storedUser;

  return fetchCurrentUser();
}

export async function getAppAccount(): Promise<{
  user: ShopXUser;
  checkoutProfile: CheckoutProfile;
}> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Necesitás iniciar sesión.");
  }

  const response = await fetch(buildApiUrl("/api/app/account"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonResponse<AccountResponse>(response);

  if (!data.user) {
    throw new Error("No pudimos cargar tu cuenta.");
  }

  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

  return {
    user: data.user,
    checkoutProfile: data.checkoutProfile || {
      complete: false,
      missingFields: [],
    },
  };
}

export async function updateAppAccount(
  payload: UpdateAccountPayload
): Promise<{
  user: ShopXUser;
  checkoutProfile: CheckoutProfile;
}> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Necesitás iniciar sesión.");
  }

  const response = await fetch(buildApiUrl("/api/app/account"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse<AccountResponse>(response);

  if (!data.user) {
    throw new Error("No pudimos actualizar tu cuenta.");
  }

  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

  return {
    user: data.user,
    checkoutProfile: data.checkoutProfile || {
      complete: false,
      missingFields: [],
    },
  };
}

export async function getCheckoutProfile(): Promise<CheckoutProfile> {
  const account = await getAppAccount();
  return account.checkoutProfile;
}

export async function hasCheckoutProfileComplete(): Promise<boolean> {
  try {
    const profile = await getCheckoutProfile();
    return Boolean(profile.complete);
  } catch {
    return false;
  }
}

export async function deleteAppAccount(): Promise<boolean> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Necesitás iniciar sesión.");
  }

  const response = await fetch(buildApiUrl("/api/app/account"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await parseJsonResponse<{ ok: boolean }>(response);
  await logoutApp();

  return true;
}

export async function logoutApp() {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
}

export async function isLoggedIn() {
  const token = await getAuthToken();
  return Boolean(token);
}
export async function forgotPasswordApp(email: string): Promise<boolean> {
  const clean = cleanEmail(email);

  if (!clean) {
    throw new Error("Ingresá tu email.");
  }

  const response = await fetch(buildApiUrl("/api/auth/forgot-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: clean }),
  });

  await parseJsonResponse<{ ok: boolean }>(response);

  return true;
}
