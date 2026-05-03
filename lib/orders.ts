// lib/orders.ts
import { getAuthToken } from "./auth";
import { buildApiUrl } from "./config";

export type AppOrderBuyer = {
  fullName?: string;
  email: string;
  phone?: string;
  dni?: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
};

export type AppOrderDestination = {
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
};

export type AppOrderItem = {
  productId?: string;
  id?: string;
  _id?: string;
  slug?: string;
  externalId?: string;
  title: string;
  image?: string | null;
  imageUrl?: string | null;
  images?: string[];
  imageUrls?: string[];
  quantity?: number;
  qty?: number;
  priceUSD?: number;
  finalPriceUSD?: number;
  estimatedUSD?: number;
  sourceUrl?: string;
  url?: string;
  brand?: string;
  store?: string;
  source?: string;
  category?: any;
  pricing?: any;
};

export type PricingBreakdownRow = {
  label: string;
  amount: number;
};

export type TrackingHistoryItem = {
  step?: string;
  label?: string;
  description?: string;
  source?: string;
  paymentId?: string;
  status?: string;
  statusDetail?: string;
  updatedBy?: string;
  date?: string;
};

export type AppOrderTracking = {
  currentStep?: string;
  currentLabel?: string;
  currentDescription?: string;
  lastUpdatedAt?: string;
  history?: TrackingHistoryItem[];
  miamiAt?: string;
  transitAt?: string;
  deliveredAt?: string;
};

export type CreateAppOrderPayload = {
  buyer: AppOrderBuyer;
  destination?: AppOrderDestination;
  items: AppOrderItem[];
  totalUSD: number;
  totalARS?: number;
  pricingBreakdown?: PricingBreakdownRow[];
  shippingUSD?: number;
  otherFeesUSD?: number;
  exchangeRateUsed?: number;
};

export type AppOrder = {
  _id: string;
  orderNumber: string;
  userId?: string;

  status: string;
  paymentStatus?: string;
  paymentProvider?: string;
  paymentId?: string;

  items: any[];
  itemsCount: number;

  subtotalUSD: number;
  shippingUSD: number;
  otherFeesUSD: number;
  totalUSD: number;
  totalARS?: number;
  exchangeRateUsed?: number;

  pricingBreakdown?: PricingBreakdownRow[];

  buyer?: AppOrderBuyer;

  localTrackingNumber?: string;
  localCourierName?: string;

  tracking?: AppOrderTracking;

  createdAt?: string;
  updatedAt?: string;
};

export type CreateAppOrderResponse = {
  ok: boolean;
  orderNumber?: string;
  mongoId?: string;
  orderId?: string;
  order?: AppOrder;
  error?: string;
};

export type AppOrdersResponse = {
  ok: boolean;
  orders: AppOrder[];
  error?: string;
};

export type AppOrderDetailResponse = {
  ok: boolean;
  order?: AppOrder;
  error?: string;
};

export type ExchangeRateResponse = {
  rate: number;
  lastUpdate?: string;
  fromCache?: boolean;
  error?: string;
};

export type MercadoPagoCheckoutResponse = {
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  totalUSD?: number;
  exchangeRateUsed?: number;
  totalARS?: number;
  preferenceId?: string;
  init_point?: string;
  sandbox_init_point?: string;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  error?: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: any = null;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || "Respuesta inválida del servidor");
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || "Error de servidor");
  }

  return data as T;
}

function cleanEmail(email?: string) {
  return String(email || "").trim().toLowerCase();
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

async function getAuthHeaders() {
  const token = await getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getExchangeRate(): Promise<number> {
  const response = await fetch(buildApiUrl("/api/exchange"), {
    method: "GET",
  });

  const data = await parseJsonResponse<ExchangeRateResponse>(response);

  const rate = Number(data.rate || 0);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Cotización inválida");
  }

  return rate;
}

export async function createAppOrder(
  payload: CreateAppOrderPayload
): Promise<CreateAppOrderResponse> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(buildApiUrl("/api/app/orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      ...payload,
      buyer: {
        ...payload.buyer,
        email: cleanEmail(payload.buyer.email),
      },
    }),
  });

  return parseJsonResponse<CreateAppOrderResponse>(response);
}

export async function getAppOrders(params: {
  email?: string;
  phone?: string;
  orderNumber?: string;
  limit?: number;
}): Promise<AppOrder[]> {
  const authHeaders = await getAuthHeaders();

  const query = buildQuery({
    email: params.email ? cleanEmail(params.email) : undefined,
    phone: params.phone,
    orderNumber: params.orderNumber,
    limit: params.limit || 30,
  });

  const response = await fetch(buildApiUrl(`/api/app/orders${query}`), {
    method: "GET",
    headers: {
      ...authHeaders,
    },
  });

  const data = await parseJsonResponse<AppOrdersResponse>(response);

  return data.orders || [];
}

export async function getAppOrderById(params: {
  orderId: string;
  email?: string;
  phone?: string;
}): Promise<AppOrder | null> {
  const authHeaders = await getAuthHeaders();

  const query = buildQuery({
    email: params.email ? cleanEmail(params.email) : undefined,
    phone: params.phone,
  });

  const response = await fetch(
    buildApiUrl(`/api/app/orders/${encodeURIComponent(params.orderId)}${query}`),
    {
      method: "GET",
      headers: {
        ...authHeaders,
      },
    }
  );

  const data = await parseJsonResponse<AppOrderDetailResponse>(response);

  return data.order || null;
}

export async function createMercadoPagoCheckout(params: {
  orderId: string;
  email?: string;
  phone?: string;
  exchangeRate?: number;
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
}): Promise<MercadoPagoCheckoutResponse> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(buildApiUrl("/api/app/checkout/mercadopago"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      ...params,
      email: params.email ? cleanEmail(params.email) : undefined,
    }),
  });

  return parseJsonResponse<MercadoPagoCheckoutResponse>(response);
}