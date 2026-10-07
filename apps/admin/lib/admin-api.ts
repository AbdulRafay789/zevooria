import {
  clearLegacyAdminAuthStorage,
  type AdminUser,
} from './admin-auth-storage';

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

function getBrowserApiBase(): string {
  return '/backend/api';
}

async function parseError(response: Response): Promise<AdminApiError> {
  let message = `Request failed (${response.status})`;
  try {
    const data: unknown = await response.json();
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
  return new AdminApiError(message, response.status);
}

export async function adminLogin(input: {
  email: string;
  password: string;
}): Promise<{ user: AdminUser }> {
  const response = await fetch(`${getBrowserApiBase()}/admin/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const result = (await response.json()) as { user: AdminUser };
  clearLegacyAdminAuthStorage();
  return result;
}

export async function adminLogout(): Promise<void> {
  await fetch(`${getBrowserApiBase()}/admin/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }).catch(() => undefined);
  clearLegacyAdminAuthStorage();
}

export async function fetchAdminMe(): Promise<AdminUser> {
  const response = await fetch(`${getBrowserApiBase()}/admin/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearLegacyAdminAuthStorage();
    }
    throw await parseError(response);
  }
  return (await response.json()) as AdminUser;
}

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  allowedNextStatuses: string[];
  currency: string;
  subtotal: string;
  discountAmount?: string;
  promoCode?: string | null;
  discountApplied?: boolean;
  shippingAmount: string;
  total: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorId: string | null;
    note: string | null;
    createdAt: string;
  }>;
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

export type AdminDashboardProfitAndLoss = {
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
};

export type AdminDashboardStats = {
  ordersToday: number;
  ordersPending: number;
  ordersTotal: number;
  revenueTodayPkr: string;
  revenueTotalPkr: string;
  from: string | null;
  to: string | null;
  status: string | null;
  filteredOrders: number;
  filteredRevenuePkr: string;
  profitAndLoss: AdminDashboardProfitAndLoss;
};

const EMPTY_DASHBOARD_PNL: AdminDashboardProfitAndLoss = {
  totalRevenue: '0',
  totalExpenses: '0',
  netIncome: '0',
};

function normalizeAdminDashboardStats(
  raw: Partial<AdminDashboardStats> & {
    ordersToday: number;
    ordersPending: number;
    ordersTotal: number;
    revenueTodayPkr: string;
    revenueTotalPkr: string;
  },
): AdminDashboardStats {
  const pnl = raw.profitAndLoss;
  return {
    ordersToday: raw.ordersToday,
    ordersPending: raw.ordersPending,
    ordersTotal: raw.ordersTotal,
    revenueTodayPkr: raw.revenueTodayPkr,
    revenueTotalPkr: raw.revenueTotalPkr,
    from: raw.from ?? null,
    to: raw.to ?? null,
    status: raw.status ?? null,
    filteredOrders: raw.filteredOrders ?? raw.ordersTotal,
    filteredRevenuePkr: raw.filteredRevenuePkr ?? raw.revenueTotalPkr,
    profitAndLoss: {
      totalRevenue: pnl?.totalRevenue ?? EMPTY_DASHBOARD_PNL.totalRevenue,
      totalExpenses: pnl?.totalExpenses ?? EMPTY_DASHBOARD_PNL.totalExpenses,
      netIncome: pnl?.netIncome ?? EMPTY_DASHBOARD_PNL.netIncome,
    },
  };
}

export type AdminCustomerListItem = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  emailVerifiedAt: string | null;
  orderCount: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    currency: string;
    createdAt: string;
  }>;
};

export type AdminProductMedia = {
  id: string;
  type: string;
  storageKey: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  cost: string;
  currency: string;
  status: string;
  sortOrder: number;
  /** Public storefront PDP URL encoded in the product box QR. */
  productPageUrl?: string;
  updatedAt: string;
  media: AdminProductMedia[];
};

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${getBrowserApiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body && !isFormData
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearLegacyAdminAuthStorage();
    }
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

/**
 * Preview URL via same-origin /assets (admin serves the shared bind-mount).
 * Never use hostname:3000 — that bypasses Nginx TLS and triggers Chrome
 * "active content with certificate errors" / broken HTTPS.
 */
export function storageKeyToPreviewUrl(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('assets/')) {
    return '';
  }
  const path = normalized.slice('assets/'.length);
  return `/assets/${path}`;
}

export async function fetchAdminDashboard(params?: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<AdminDashboardStats> {
  const q = new URLSearchParams();
  if (params?.from) {
    q.set('from', params.from);
  }
  if (params?.to) {
    q.set('to', params.to);
  }
  if (params?.status) {
    q.set('status', params.status);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const raw = await adminFetch<Partial<AdminDashboardStats> & {
    ordersToday: number;
    ordersPending: number;
    ordersTotal: number;
    revenueTodayPkr: string;
    revenueTotalPkr: string;
  }>(`/admin/dashboard${suffix}`);
  return normalizeAdminDashboardStats(raw);
}

export type AdminReportsSummary = {
  generatedAt: string;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenueByStatusPkr: Array<{ status: string; revenuePkr: string }>;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
    revenuePkr: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    customerName: string;
    createdAt: string;
  }>;
  totals: {
    ordersTotal: number;
    revenueTotalPkr: string;
    averageOrderPkr: string;
  };
};

export function fetchAdminReports(): Promise<AdminReportsSummary> {
  return adminFetch('/admin/reports');
}

export function fetchAdminOrders(): Promise<AdminOrderListItem[]> {
  return adminFetch('/admin/orders');
}

export function fetchAdminOrder(orderId: string): Promise<AdminOrderDetail> {
  return adminFetch(`/admin/orders/${orderId}`);
}

export function deleteAdminOrder(orderId: string): Promise<AdminOrderDetail> {
  return adminFetch(`/admin/orders/${orderId}`, {
    method: 'DELETE',
  });
}

export function updateAdminOrderStatus(
  orderId: string,
  status: string,
): Promise<AdminOrderDetail> {
  return adminFetch(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function fetchAdminCustomers(): Promise<AdminCustomerListItem[]> {
  return adminFetch('/admin/customers');
}

export function fetchAdminCustomer(
  customerId: string,
): Promise<AdminCustomerDetail> {
  return adminFetch(`/admin/customers/${customerId}`);
}

export function fetchAdminProducts(): Promise<AdminProductListItem[]> {
  return adminFetch('/admin/products');
}

export function createAdminProduct(input: {
  name: string;
  slug?: string;
  description: string;
  status?: string;
  price: string;
  compareAtPrice?: string | null;
  cost?: string;
}): Promise<AdminProductListItem> {
  return adminFetch('/admin/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reorderAdminProducts(
  productIds: string[],
): Promise<AdminProductListItem[]> {
  return adminFetch('/admin/products/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ productIds }),
  });
}

export type AdminInventoryRow = {
  productId: string;
  productName: string;
  productSlug: string;
  warehouseId: string;
  warehouseCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
  updatedAt: string;
};

export function fetchAdminInventory(): Promise<AdminInventoryRow[]> {
  return adminFetch('/admin/inventory');
}

export function updateAdminInventory(
  productId: string,
  input: { quantityOnHand: number; note?: string },
): Promise<AdminInventoryRow> {
  return adminFetch(`/admin/inventory/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateAdminProduct(
  productId: string,
  input: {
    status?: string;
    price?: string;
    compareAtPrice?: string | null;
    cost?: string;
    description?: string;
  },
): Promise<AdminProductListItem> {
  return adminFetch(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function uploadAdminProductMedia(
  productId: string,
  input: { file: File; altText?: string; isPrimary?: boolean },
): Promise<AdminProductListItem> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.altText) {
    form.append('altText', input.altText);
  }
  if (input.isPrimary) {
    form.append('isPrimary', 'true');
  }
  return adminFetch(`/admin/products/${productId}/media`, {
    method: 'POST',
    body: form,
  });
}

export function deleteAdminProductMedia(
  productId: string,
  mediaId: string,
): Promise<AdminProductListItem> {
  return adminFetch(`/admin/products/${productId}/media/${mediaId}`, {
    method: 'DELETE',
  });
}

export function deleteAdminProduct(
  productId: string,
): Promise<AdminProductListItem> {
  return adminFetch(`/admin/products/${productId}`, {
    method: 'DELETE',
  });
}

/** Same-origin URL for the printable QR sheet (opens in a new tab; cookie auth). */
export function adminProductQrSheetUrl(
  productId: string,
  copies = 12,
): string {
  const params = new URLSearchParams({
    copies: String(copies),
  });
  return `${getBrowserApiBase()}/admin/products/${productId}/qr-sheet?${params.toString()}`;
}

/**
 * Download the product box QR as a PNG via authenticated fetch
 * (cookie session — not usable as a plain <img> src without credentials).
 */
export async function downloadAdminProductQrPng(
  productId: string,
  filenameHint?: string,
): Promise<void> {
  const response = await fetch(
    `${getBrowserApiBase()}/admin/products/${productId}/qr.png?size=1024`,
    {
      credentials: 'include',
      headers: { Accept: 'image/png' },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    if (response.status === 401) {
      clearLegacyAdminAuthStorage();
    }
    throw await parseError(response);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filenameHint
    ? `zevooria-${filenameHint}-qr.png`
    : `zevooria-product-qr.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Preview URL for an authenticated QR PNG (blob object URL). */
export async function fetchAdminProductQrObjectUrl(
  productId: string,
): Promise<string> {
  const response = await fetch(
    `${getBrowserApiBase()}/admin/products/${productId}/qr.png?size=360`,
    {
      credentials: 'include',
      headers: { Accept: 'image/png' },
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    if (response.status === 401) {
      clearLegacyAdminAuthStorage();
    }
    throw await parseError(response);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function formatMoney(currency: string, amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }
  return `${currency} ${value.toLocaleString('en-PK')}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function updateAdminCustomerStatus(
  customerId: string,
  isActive: boolean,
): Promise<AdminCustomerListItem> {
  return adminFetch(`/admin/customers/${customerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function softDeleteAdminCustomer(
  customerId: string,
): Promise<AdminCustomerListItem> {
  return adminFetch(`/admin/customers/${customerId}/delete`, {
    method: 'POST',
  });
}

export type AdminPermission = {
  id: string;
  code: string;
  name: string;
};

export type AdminRoleView = {
  id: string;
  code: string;
  name: string;
  permissionCodes: string[];
  createdAt: string;
};

export type AdminStaffView = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: string;
  roles: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
};

export type AdminAuditLog = {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminAuditLogsPage = {
  items: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
};

export function fetchAdminAuditLogs(params?: {
  limit?: number;
  offset?: number;
}): Promise<AdminAuditLogsPage> {
  const q = new URLSearchParams();
  q.set('limit', String(params?.limit ?? 500));
  q.set('offset', String(params?.offset ?? 0));
  return adminFetch(`/admin/audit-logs?${q.toString()}`);
}

export type AdminAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
};

export type AdminJournalEntry = {
  id: string;
  entryDate: string;
  memo: string;
  sourceType: string;
  sourceId: string;
  eventKind: string;
  periodLabel: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    accountCode: string | null;
    accountName: string | null;
    debit: string;
    credit: string;
  }>;
};

export type AdminTrialBalanceRow = {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
};

export function fetchAdminAccounts(): Promise<AdminAccount[]> {
  return adminFetch('/admin/accounting/accounts');
}

export function fetchAdminJournalEntries(
  limit = 50,
): Promise<AdminJournalEntry[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  return adminFetch(`/admin/accounting/journal-entries?${q.toString()}`);
}

export function fetchAdminTrialBalance(): Promise<AdminTrialBalanceRow[]> {
  return adminFetch('/admin/accounting/trial-balance');
}

export type AdminGeneralLedgerRow = {
  entryId: string;
  entryDate: string;
  memo: string;
  eventKind: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: string;
  credit: string;
  createdAt: string;
};

export type AdminProfitAndLoss = {
  from: string | null;
  to: string | null;
  revenue: Array<{ accountCode: string; accountName: string; amount: string }>;
  expenses: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
};

export type AdminBalanceSheet = {
  asOf: string | null;
  assets: Array<{ accountCode: string; accountName: string; amount: string }>;
  liabilities: Array<{
    accountCode: string;
    accountName: string;
    amount: string;
  }>;
  equity: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  netIncome: string;
  totalLiabilitiesAndEquity: string;
};

export function fetchAdminGeneralLedger(params?: {
  accountCode?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AdminGeneralLedgerRow[]> {
  const q = new URLSearchParams();
  if (params?.accountCode) {
    q.set('accountCode', params.accountCode);
  }
  if (params?.from) {
    q.set('from', params.from);
  }
  if (params?.to) {
    q.set('to', params.to);
  }
  if (params?.limit) {
    q.set('limit', String(params.limit));
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return adminFetch(`/admin/accounting/general-ledger${suffix}`);
}

export function fetchAdminProfitAndLoss(params?: {
  from?: string;
  to?: string;
}): Promise<AdminProfitAndLoss> {
  const q = new URLSearchParams();
  if (params?.from) {
    q.set('from', params.from);
  }
  if (params?.to) {
    q.set('to', params.to);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return adminFetch(`/admin/accounting/profit-and-loss${suffix}`);
}

export function fetchAdminBalanceSheet(params?: {
  asOf?: string;
}): Promise<AdminBalanceSheet> {
  const q = new URLSearchParams();
  if (params?.asOf) {
    q.set('asOf', params.asOf);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return adminFetch(`/admin/accounting/balance-sheet${suffix}`);
}

export type AdminNotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
};

export function fetchAdminNotifications(limit = 40): Promise<{
  items: AdminNotificationItem[];
  unreadCount: number;
}> {
  const q = new URLSearchParams({ limit: String(limit) });
  return adminFetch(`/admin/notifications?${q.toString()}`);
}

export function markAdminNotificationRead(
  id: string,
): Promise<AdminNotificationItem> {
  return adminFetch(`/admin/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllAdminNotificationsRead(): Promise<{ updated: number }> {
  return adminFetch('/admin/notifications/read-all', { method: 'POST' });
}

export function fetchAdminNotificationPreferences(): Promise<{
  orderPlaced: boolean;
  pushEnabled: boolean;
}> {
  return adminFetch('/admin/notifications/preferences');
}

export function updateAdminNotificationPreferences(input: {
  orderPlaced?: boolean;
  pushEnabled?: boolean;
}): Promise<{ orderPlaced: boolean; pushEnabled: boolean }> {
  return adminFetch('/admin/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchVapidPublicKey(): Promise<{ publicKey: string | null }> {
  return adminFetch('/admin/notifications/vapid-public-key');
}

export function subscribeAdminPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean }> {
  return adminFetch('/admin/notifications/push-subscribe', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function openAdminNotificationStream(
  onMessage: (payload: AdminNotificationItem | { type: string }) => void,
): EventSource | null {
  if (typeof EventSource === 'undefined') {
    return null;
  }
  // Same-origin EventSource sends httpOnly session cookie; BFF injects Bearer.
  const url = `${getBrowserApiBase()}/admin/notifications/stream`;
  const source = new EventSource(url);
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as AdminNotificationItem | { type: string });
    } catch {
      // ignore malformed
    }
  };
  return source;
}

export function fetchAdminPermissions(): Promise<AdminPermission[]> {
  return adminFetch('/admin/permissions');
}

export function fetchAdminRoles(): Promise<AdminRoleView[]> {
  return adminFetch('/admin/roles');
}

export function createAdminRole(input: {
  code: string;
  name: string;
  permissionCodes: string[];
}): Promise<AdminRoleView> {
  return adminFetch('/admin/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminRole(
  roleId: string,
  input: { name?: string; permissionCodes?: string[] },
): Promise<AdminRoleView> {
  return adminFetch(`/admin/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchAdminStaff(): Promise<AdminStaffView[]> {
  return adminFetch('/admin/staff');
}

export function createAdminStaff(input: {
  email: string;
  fullName: string;
  password: string;
  isActive?: boolean;
  roleIds?: string[];
}): Promise<AdminStaffView> {
  return adminFetch('/admin/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminStaff(
  staffId: string,
  input: {
    fullName?: string;
    isActive?: boolean;
    password?: string;
    roleIds?: string[];
  },
): Promise<AdminStaffView> {
  return adminFetch(`/admin/staff/${staffId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type AdminPromoCode = {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  minSubtotal: string;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function fetchAdminPromoCodes(): Promise<AdminPromoCode[]> {
  return adminFetch('/admin/promo-codes');
}

export function createAdminPromoCode(input: {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  minSubtotal?: string;
  maxUses?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}): Promise<AdminPromoCode> {
  return adminFetch('/admin/promo-codes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminPromoCode(
  id: string,
  input: {
    discountType?: 'percent' | 'fixed';
    discountValue?: string;
    minSubtotal?: string;
    maxUses?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
  },
): Promise<AdminPromoCode> {
  return adminFetch(`/admin/promo-codes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAdminPromoCode(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/promo-codes/${id}`, {
    method: 'DELETE',
  });
}

export type AdminReturnItem = {
  id: string;
  orderItemId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineRefund: string;
};

export type AdminReturn = {
  id: string;
  orderId: string;
  orderNumber: string | null;
  status: string;
  reason: string | null;
  refundAmount: string;
  createdByAdminId: string | null;
  inspectedAt: string | null;
  restockedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  items: AdminReturnItem[];
};

export function fetchAdminReturns(): Promise<AdminReturn[]> {
  return adminFetch('/admin/returns');
}

export function createAdminReturn(input: {
  orderId: string;
  reason?: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}): Promise<AdminReturn> {
  return adminFetch('/admin/returns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function inspectAdminReturn(id: string): Promise<AdminReturn> {
  return adminFetch(`/admin/returns/${id}/inspect`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function markAdminReturnRefunded(id: string): Promise<AdminReturn> {
  return adminFetch(`/admin/returns/${id}/mark-refunded`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type SupportConversationStatus = 'open' | 'pending' | 'closed';

export type SupportConversationListItem = {
  id: string;
  subject: string;
  status: SupportConversationStatus;
  requesterEmail: string;
  requesterName: string | null;
  customerId: string | null;
  assigneeAdminId: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportConversationListResponse = {
  items: SupportConversationListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SupportAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  direction: 'inbound' | 'outbound' | string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  sesMessageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  adminUserId: string | null;
  createdAt: string;
  attachments: SupportAttachment[];
};

export type SupportCustomerSummary = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
};

export type SupportAssigneeSummary = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
};

export type SupportConversationDetail = {
  conversation: SupportConversationListItem;
  customer: SupportCustomerSummary | null;
  assignee: SupportAssigneeSummary | null;
  messages: SupportMessage[];
};

export type SupportConversationsQuery = {
  page?: number;
  limit?: number;
  status?: SupportConversationStatus;
  search?: string;
};

export function fetchSupportConversations(
  params: SupportConversationsQuery = {},
): Promise<SupportConversationListResponse> {
  const q = new URLSearchParams();
  if (params.page != null) {
    q.set('page', String(params.page));
  }
  if (params.limit != null) {
    q.set('limit', String(params.limit));
  }
  if (params.status) {
    q.set('status', params.status);
  }
  if (params.search?.trim()) {
    q.set('search', params.search.trim());
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return adminFetch(`/admin/support/conversations${suffix}`);
}

export function fetchSupportConversation(
  id: string,
): Promise<SupportConversationDetail> {
  return adminFetch(`/admin/support/conversations/${id}`);
}

export function updateSupportConversation(
  id: string,
  input: {
    status?: SupportConversationStatus;
    assigneeAdminId?: string | null;
  },
): Promise<SupportConversationListItem> {
  return adminFetch(`/admin/support/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type SupportAttachmentAccess = {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export function fetchSupportAttachmentAccess(
  conversationId: string,
  attachmentId: string,
): Promise<SupportAttachmentAccess> {
  return adminFetch(
    `/admin/support/conversations/${conversationId}/attachments/${attachmentId}`,
  );
}

export type SupportReplyResponse = {
  message: SupportMessage;
  conversation: SupportConversationListItem;
};

export function replySupportConversation(
  conversationId: string,
  bodyText: string,
): Promise<SupportReplyResponse> {
  return adminFetch(`/admin/support/conversations/${conversationId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ bodyText }),
  });
}

/** Relative time for list “last message” cells (Karachi-local wall clock not required). */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const diffMs = now - date.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) {
    return 'just now';
  }
  if (abs < hour) {
    const mins = Math.round(abs / minute);
    return `${mins}m ago`;
  }
  if (abs < day) {
    const hours = Math.round(abs / hour);
    return `${hours}h ago`;
  }
  if (abs < 7 * day) {
    const days = Math.round(abs / day);
    return `${days}d ago`;
  }
  return formatDate(iso);
}
