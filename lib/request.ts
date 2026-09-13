import { getAuthToken } from "./auth";
import { buildApiUrl } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, any> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Auth is only sent to ShopX, never to a retailer URL. */
export async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    authenticated?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const token = options.authenticated ? await getAuthToken() : null;
  if (options.authenticated && !token)
    throw new ApiError("Iniciá sesión para continuar.", 401);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30000,
  );
  try {
    const response = await fetch(buildApiUrl(path), {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
      throw new ApiError(
        response.status === 401
          ? "Tu sesión venció. Volvé a iniciar sesión."
          : data?.error ||
            data?.message ||
            "No pudimos completar la solicitud. Volvé a intentar.",
        response.status,
        data || {},
      );
    }
    if (!data)
      throw new ApiError(
        "ShopX devolvió una respuesta inválida. Volvé a intentar.",
        response.status,
      );
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new ApiError(
        "La tienda está tardando más de lo habitual. Volvé a intentar en unos segundos.",
        408,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
