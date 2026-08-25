export interface Page<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
    ACTIVE: 'Ativo',
    SUSPENDED: 'Suspenso',
    PENDING_ACTIVATION: 'Ativação pendente',
};

export function userStatusLabel(status: string) {
    return USER_STATUS_LABELS[status as UserStatus] ?? status;
}

export interface AdminUser {
    id: string;
    name: string;
    username: string;
    email: string;
    emailVerifiedAt: string | null;
    status: string;
    createdAt: string;
    passwordResetRequiredAt: string | null;
}

export interface AdminUserAddress {
    id: string;
    recipientFullName: string;
    phoneE164: string;
    countryCode: string;
    postalCode: string;
    administrativeArea: string;
    locality: string;
    district: string | null;
    addressLine1: string;
    addressLine2: string | null;
    deliveryInstructions: string | null;
    isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Contas de admin
// ---------------------------------------------------------------------------

export const ADMIN_ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number];

export const ADMIN_ACCOUNT_STATUS_LABELS: Record<AdminAccountStatus, string> = {
    ACTIVE: 'Ativo',
    DISABLED: 'Desativado',
};

export function adminAccountStatusLabel(status: string) {
    return ADMIN_ACCOUNT_STATUS_LABELS[status as AdminAccountStatus] ?? status;
}

export interface AdminAccount {
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: string;
    passwordChangedAt: string;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export const MARKETPLACE_NAMES = ['TAOBAO', 'XIANYU', 'ALIBABA'] as const;
export type MarketplaceName = (typeof MARKETPLACE_NAMES)[number];

/** Todas as origens possíveis de um produto, incluindo estoque próprio da MaoMaoBuy. */
export const PRODUCT_SOURCE_NAMES = [...MARKETPLACE_NAMES, 'MAOMAOBUY'] as const;
export type ProductSourceName = (typeof PRODUCT_SOURCE_NAMES)[number];

export const PRODUCT_SOURCE_LABELS: Record<ProductSourceName, string> = {
    TAOBAO: 'Taobao',
    XIANYU: 'Xianyu',
    ALIBABA: 'Alibaba',
    MAOMAOBUY: 'MaoMaoBuy (estoque próprio)',
};

export function productSourceLabel(source: string) {
    return PRODUCT_SOURCE_LABELS[source as ProductSourceName] ?? source;
}

export const PRODUCT_MEDIA_TYPES = ['IMAGE', 'VIDEO', 'PDF'] as const;
export type ProductMediaType = (typeof PRODUCT_MEDIA_TYPES)[number];

export interface AdminProductVariant {
    id: string;
    externalId: string;
    label: string;
    amountAdjustmentMinor: string;
    isAvailable: boolean;
}

export interface AdminProductMedia {
    id: string;
    key: string;
    type: ProductMediaType;
    mimeType: string;
    sizeBytes: string;
    sortOrder: number;
    altText: string | null;
    url: string | null;
}

export interface AdminProductCategoryRef {
    id: string;
    name: string;
    slug: string;
}

export interface AdminProductSubcategoryRef {
    id: string;
    name: string;
    slug: string;
    categoryId: string;
}

export interface AdminProduct {
    id: string;
    slug: string;
    name: string;
    description: string;
    marketplace: string;
    marketplaceUrl: string | null;
    sourceCurrency: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor: string | null;
    stock: number;
    isPublished: boolean;
    variants: AdminProductVariant[];
    media: AdminProductMedia[];
    categories: AdminProductCategoryRef[];
    subcategories: AdminProductSubcategoryRef[];
    createdAt: string;
    updatedAt: string;
}

export interface PresignedUpload {
    key: string;
    uploadUrl: string;
    expiresAt: string;
    headers: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
    'AWAITING_REVIEW',
    'AWAITING_CUSTOMER_APPROVAL',
    'GENERATING_PAYMENT_DATA',
    'UNPAID',
    'PENDING',
    'SUBMITTED',
    'PURCHASED',
    'SELLER_SHIPPED',
    'IN_WAREHOUSE',
    'INSPECTION_PENDING',
    'READY_TO_SHIP',
    'PARTIALLY_SHIPPED',
    'SHIPPED',
    'COMPLETED',
    'REFUND',
    'INVALID',
    'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    AWAITING_REVIEW: 'Aguardando análise',
    AWAITING_CUSTOMER_APPROVAL: 'Aguardando aprovação do cliente',
    GENERATING_PAYMENT_DATA: 'Gerando dados de pagamento',
    UNPAID: 'Aguardando pagamento',
    PENDING: 'Pendente',
    SUBMITTED: 'Enviado ao fornecedor',
    PURCHASED: 'Comprado',
    SELLER_SHIPPED: 'Enviado pelo vendedor',
    IN_WAREHOUSE: 'No depósito',
    INSPECTION_PENDING: 'Aguardando inspeção',
    READY_TO_SHIP: 'Pronto para envio',
    PARTIALLY_SHIPPED: 'Parcialmente enviado',
    SHIPPED: 'Enviado',
    COMPLETED: 'Concluído',
    REFUND: 'Reembolsado',
    INVALID: 'Inválido',
    CANCELLED: 'Cancelado',
};

export function orderStatusLabel(status: string) {
    return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export interface AdminOrderItem {
    id: string;
    productName: string;
    quantity: number;
    currency: string;
    unitAmountMinor: string;
    storeProductId: string | null;
    storeProductVariantExternalId: string | null;
    marketplace: string | null;
    marketplaceUrl: string | null;
    size: string | null;
    productDescription: string | null;
    category: { id: string; name: string; slug: string } | null;
    /** Preço declarado pelo cliente em yuan (fen), só informativo. */
    referencePriceCnyMinor: string | null;
}

export interface AdminOrderMedia {
    id: string;
    type: string;
    mimeType: string;
    sizeBytes: string;
    sortOrder: number;
    altText: string | null;
    url: string | null;
    createdByAdminId: string;
    createdAt: string;
}

export interface AdminOrderChangeLog {
    id: string;
    type: string;
    reason: string;
    previousValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    createdByAdminId: string | null;
    createdByUserId: string | null;
    createdAt: string;
}

export interface AdminOrder {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    origin: string | null;
    status: string;
    currency: string;
    totalAmountMinor: string;
    shippingEstimateAmountMinor: string | null;
    addressSnapshot: AddressSnapshot | null;
    createdAt: string;
    reviewedAt: string | null;
    reviewedByAdminId: string | null;
    rejectionReason: string | null;
    providerName: string | null;
    paymentExpiresAt: string | null;
    paidAt: string | null;
    adminDescription: string | null;
    items: AdminOrderItem[];
    media: AdminOrderMedia[];
    changeLogs: AdminOrderChangeLog[];
}

const ORDER_CHANGE_LOG_TYPE_LABELS: Record<string, string> = {
    DESCRIPTION_UPDATED: 'Descrição atualizada',
    PRICE_CHANGED: 'Valor alterado',
    MEDIA_ADDED: 'Mídia adicionada',
    MEDIA_REMOVED: 'Mídia removida',
    APPROVED: 'Pedido aprovado',
    REJECTED: 'Pedido rejeitado',
    SHIPPING_ESTIMATE_CHANGED: 'Frete estimado alterado',
    CHANGES_REQUESTED: 'Aprovação do cliente solicitada',
    CUSTOMER_APPROVED_CHANGES: 'Cliente aprovou as alterações',
    CUSTOMER_REJECTED_CHANGES: 'Cliente rejeitou as alterações',
    PAYMENT_DATA_SENT: 'Dados de pagamento enviados ao cliente',
    MARKED_PAID_BY_CUSTOMER: 'Cliente marcou como pago',
    PAYMENT_CONFIRMED: 'Pagamento confirmado',
};

export function orderChangeLogTypeLabel(type: string) {
    return ORDER_CHANGE_LOG_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// Pacotes
// ---------------------------------------------------------------------------

export const PACKAGE_STATUSES = [
    'DRAFT',
    'AWAITING_APPROVAL',
    'PREPARING',
    'READY_FOR_DISPATCH',
    'SHIPPED',
    'IN_TRANSIT',
    'CUSTOMS',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'EXCEPTION',
    'RETURNED',
    'CANCELLED',
] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
    DRAFT: 'Rascunho',
    AWAITING_APPROVAL: 'Aguardando aprovação',
    PREPARING: 'Em preparação',
    READY_FOR_DISPATCH: 'Pronto para despacho',
    SHIPPED: 'Enviado',
    IN_TRANSIT: 'Em trânsito',
    CUSTOMS: 'Na alfândega',
    OUT_FOR_DELIVERY: 'Saiu para entrega',
    DELIVERED: 'Entregue',
    EXCEPTION: 'Ocorrência',
    RETURNED: 'Devolvido',
    CANCELLED: 'Cancelado',
};

export function packageStatusLabel(status: string) {
    return PACKAGE_STATUS_LABELS[status as PackageStatus] ?? status;
}

export interface AddressSnapshot {
    recipientFullName: string;
    phoneE164: string;
    countryCode: string;
    postalCode: string;
    administrativeArea: string;
    locality: string;
    district: string | null;
    addressLine1: string;
    addressLine2: string | null;
    deliveryInstructions?: string | null;
}

export interface AdminPackageItem {
    id: string;
    quantity: number;
    orderItem: AdminOrderItem;
}

export interface AdminPackage {
    id: string;
    packageCode: string;
    status: string;
    trackingCode: string | null;
    carrier: string | null;
    carrierService: string | null;
    weightGrams: number | null;
    chargeableWeightGrams: number | null;
    lengthMillimeters: number | null;
    widthMillimeters: number | null;
    heightMillimeters: number | null;
    shippingCurrency: string | null;
    shippingAmountMinor: string | null;
    destination: AddressSnapshot;
    shippedAt: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
    lastTrackingEventAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    pixCopyPaste: string | null;
    paymentExpiresAt: string | null;
    paidAt: string | null;
    photoUrls: string[];
    createdAt: string;
    items: AdminPackageItem[];
    userId: string;
    userEmail: string;
    userName: string;
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export interface AdminSubcategory {
    id: string;
    name: string;
    slug: string;
}

export interface AdminCategory {
    id: string;
    name: string;
    slug: string;
    subcategories: AdminSubcategory[];
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export interface AdminRefundRequest {
    id: string;
    userId: string;
    amountMinor: string;
    feeAmountMinor: string;
    netAmountMinor: string;
    currency: string;
    status: string;
    reason: string;
    adminNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function money(minor: string | number, currency = 'BRL') {
    const locale = currency === 'CNY' ? 'zh-CN' : 'pt-BR';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(minor) / 100);
}

export function brl(minor: string | number) {
    return money(minor, 'BRL');
}

export function formatDate(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
