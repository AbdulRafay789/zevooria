import type { AuthSessionPayload, AuthUser } from './auth-storage';

export class CommerceApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CommerceApiError';
  }
}

/** Browser calls go through Next BFF → Nest API (httpOnly cookies). */
export function getBrowserApiBase(): string {
  return '/backend/api';
}

async function parseError(response: Response): Promise<CommerceApiError> {
  let message = `Request failed (${response.status})`;
  let details: unknown;
  try {
    const data: unknown = await response.json();
    details = data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.message === 'string') {
        message = record.message;
      } else if (Array.isArray(record.message)) {
        message = record.message.join(' ');
      }
    }
  } catch {
    // keep default
  }
  return new CommerceApiError(message, response.status, details);
}

function asSessionPayload(data: unknown): AuthSessionPayload {
  const record = data as AuthSessionPayload;
  if (
    !record ||
    typeof record.expiresAt !== 'string' ||
    !record.user
  ) {
    throw new CommerceApiError('Invalid auth response from server.');
  }
  return record;
}

async function browserFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${getBrowserApiBase()}${path}`, {
    ...init,
    credentials: 'include',
    cache: init?.cache ?? 'no-store',
  });
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await browserFetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<AuthSessionPayload> {
  const response = await browserFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return asSessionPayload(await response.json());
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthSessionPayload> {
  const response = await browserFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return asSessionPayload(await response.json());
}

export async function refreshAccountSession(): Promise<AuthSessionPayload> {
  const response = await browserFetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return asSessionPayload(await response.json());
}

export async function logoutAccount(): Promise<void> {
  await browserFetch('/auth/logout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  }).catch(() => undefined);
}

export async function fetchAuthMe(): Promise<
  AuthUser & { expiresAt: string }
> {
  const response = await browserFetch('/auth/me', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const data = (await response.json()) as AuthUser & { expiresAt?: string };
  if (!data?.expiresAt) {
    throw new CommerceApiError('Invalid auth me response from server.');
  }
  return data as AuthUser & { expiresAt: string };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await browserFetch('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  const response = await browserFetch('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export async function verifyEmailWithToken(token: string): Promise<void> {
  const response = await browserFetch('/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export async function requestEmailVerification(): Promise<void> {
  const response = await browserFetch('/auth/request-email-verification', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export type CreateOrderPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country?: string;
  };
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: 'COD';
  idempotencyKey: string;
  promoCode?: string;
};

export type OrderStatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
};

export type OrderConfirmation = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: string;
  shippingAmount: string;
  total: string;
  totalExclusiveAmount?: string;
  totalCharges?: string;
  totalNetAmount?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  canCancel?: boolean;
  statusHistory?: OrderStatusHistoryItem[];
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    productSlug: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
    imageKey: string | null;
  }>;
  shippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    country: string;
  };
};

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<OrderConfirmation> {
  const response = await browserFetch('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': payload.idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as OrderConfirmation;
}

export type PromoValidation = {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  discountAmount: string;
  minSubtotal: string;
};

export async function validatePromoCode(input: {
  code: string;
  subtotalPkr: number;
}): Promise<PromoValidation> {
  const response = await browserFetch('/promo-codes/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as PromoValidation;
}

export async function fetchOrder(orderId: string): Promise<OrderConfirmation> {
  const response = await browserFetch(`/orders/${orderId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as OrderConfirmation;
}

export async function cancelOrder(
  orderId: string,
): Promise<OrderConfirmation> {
  const response = await browserFetch(`/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as OrderConfirmation;
}

export type CustomerAddress = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
};

export function fetchAddresses(): Promise<CustomerAddress[]> {
  return authJson('/auth/addresses');
}

export function createAddress(
  input: CustomerAddressInput,
): Promise<CustomerAddress> {
  return authJson('/auth/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAddress(
  id: string,
  input: Partial<CustomerAddressInput>,
): Promise<CustomerAddress> {
  return authJson(`/auth/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setDefaultAddress(id: string): Promise<CustomerAddress> {
  return authJson(`/auth/addresses/${id}/default`, { method: 'POST' });
}

export async function deleteAddress(id: string): Promise<void> {
  await authJson<{ ok: boolean }>(`/auth/addresses/${id}`, {
    method: 'DELETE',
  });
}

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  itemsSummary: Array<{
    productId: string | null;
    productName: string;
    productSlug: string;
    quantity: number;
    imageKey: string | null;
  }>;
  createdAt: string;
};

export async function fetchOrders(): Promise<OrderListItem[]> {
  const data = await authJson<unknown>('/orders');
  if (!Array.isArray(data)) {
    throw new CommerceApiError('Unexpected orders payload.');
  }
  return data as OrderListItem[];
}

export type ReviewableProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  imageKey: string | null;
  alreadyReviewed: boolean;
  review: { rating: number; body: string } | null;
};

export async function fetchReviewProducts(
  orderId: string,
): Promise<{ orderId: string; products: ReviewableProduct[] }> {
  return authJson(`/orders/${orderId}/review-products`);
}

export async function submitReview(input: {
  orderId: string;
  productId: string;
  rating: number;
  body: string;
}): Promise<void> {
  await authJson('/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function changePasswordAccount(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<AuthSessionPayload> {
  const response = await browserFetch('/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return asSessionPayload(await response.json());
}

export async function updateProfileAccount(input: {
  fullName: string;
  phone: string;
}): Promise<AuthUser> {
  return authJson('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deactivateAccount(): Promise<void> {
  const response = await browserFetch('/auth/deactivate', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export async function deleteAccount(): Promise<void> {
  const response = await browserFetch('/auth/delete-account', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

export type ServerCartItem = {
  productId: string;
  slug: string;
  quantity: number;
};

function cartHeaders(guestKey?: string | null): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(guestKey ? { 'X-Cart-Guest-Key': guestKey } : {}),
  };
}

export async function fetchCart(
  guestKey?: string | null,
): Promise<{ items: ServerCartItem[] }> {
  const response = await browserFetch('/cart', {
    method: 'GET',
    headers: cartHeaders(guestKey),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as { items: ServerCartItem[] };
}

export async function upsertCartItem(
  input: { productId: string; quantity: number },
  guestKey?: string | null,
): Promise<{ items: ServerCartItem[] }> {
  const response = await browserFetch('/cart/items', {
    method: 'PUT',
    headers: cartHeaders(guestKey),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as { items: ServerCartItem[] };
}

export async function clearServerCart(
  guestKey?: string | null,
): Promise<{ items: ServerCartItem[] }> {
  const response = await browserFetch('/cart/clear', {
    method: 'POST',
    headers: cartHeaders(guestKey),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as { items: ServerCartItem[] };
}

export async function mergeGuestCart(
  guestKey: string,
): Promise<{ items: ServerCartItem[] }> {
  const response = await browserFetch('/cart/merge', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guestKey }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as { items: ServerCartItem[] };
}
