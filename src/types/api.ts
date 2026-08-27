import { LOCALE_INTL_TAG, type Locale } from '@/i18n/locale';
import { getStoreLocale } from '@/i18n/locale-store';

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

const USER_STATUS_LABELS: Record<Locale, Record<UserStatus, string>> = {
    'pt-BR': {
        ACTIVE: 'Ativo',
        SUSPENDED: 'Suspenso',
        PENDING_ACTIVATION: 'Ativação pendente',
    },
    'zh-Hans': {
        ACTIVE: '正常',
        SUSPENDED: '已暂停',
        PENDING_ACTIVATION: '待激活',
    },
};

export function userStatusLabel(status: string) {
    return USER_STATUS_LABELS[getStoreLocale()][status as UserStatus] ?? status;
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

const ADMIN_ACCOUNT_STATUS_LABELS: Record<Locale, Record<AdminAccountStatus, string>> = {
    'pt-BR': {
        ACTIVE: 'Ativo',
        DISABLED: 'Desativado',
    },
    'zh-Hans': {
        ACTIVE: '已启用',
        DISABLED: '已停用',
    },
};

export function adminAccountStatusLabel(status: string) {
    return ADMIN_ACCOUNT_STATUS_LABELS[getStoreLocale()][status as AdminAccountStatus] ?? status;
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

const PRODUCT_SOURCE_LABELS: Record<Locale, Record<ProductSourceName, string>> = {
    'pt-BR': {
        TAOBAO: 'Taobao',
        XIANYU: 'Xianyu',
        ALIBABA: 'Alibaba',
        MAOMAOBUY: 'MaoMaoBuy (estoque próprio)',
    },
    'zh-Hans': {
        TAOBAO: '淘宝',
        XIANYU: '闲鱼',
        ALIBABA: '阿里巴巴',
        MAOMAOBUY: 'MaoMaoBuy（自营库存）',
    },
};

export function productSourceLabel(source: string) {
    return PRODUCT_SOURCE_LABELS[getStoreLocale()][source as ProductSourceName] ?? source;
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

const ORDER_STATUS_LABELS: Record<Locale, Record<OrderStatus, string>> = {
    'pt-BR': {
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
    },
    'zh-Hans': {
        AWAITING_REVIEW: '待审核',
        AWAITING_CUSTOMER_APPROVAL: '待客户确认',
        GENERATING_PAYMENT_DATA: '生成付款信息中',
        UNPAID: '待付款',
        PENDING: '待处理',
        SUBMITTED: '已提交给供应商',
        PURCHASED: '已购买',
        SELLER_SHIPPED: '卖家已发货',
        IN_WAREHOUSE: '已到仓',
        INSPECTION_PENDING: '待验货',
        READY_TO_SHIP: '可发货',
        PARTIALLY_SHIPPED: '部分发货',
        SHIPPED: '已发货',
        COMPLETED: '已完成',
        REFUND: '已退款',
        INVALID: '无效',
        CANCELLED: '已取消',
    },
};

export function orderStatusLabel(status: string) {
    return ORDER_STATUS_LABELS[getStoreLocale()][status as OrderStatus] ?? status;
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

export interface AdminPaymentAttachment {
    id: string;
    mimeType: string;
    sizeBytes: string;
    url: string | null;
    uploadedBy: 'ADMIN' | 'USER';
    createdByAdminId: string | null;
    createdByUserId: string | null;
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
    paymentAttachments: AdminPaymentAttachment[];
    changeLogs: AdminOrderChangeLog[];
}

const ORDER_CHANGE_LOG_TYPE_LABELS: Record<Locale, Record<string, string>> = {
    'pt-BR': {
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
        PAYMENT_ATTACHMENT_ADDED: 'Documento de pagamento anexado',
        PAYMENT_ATTACHMENT_REMOVED: 'Documento de pagamento removido',
    },
    'zh-Hans': {
        DESCRIPTION_UPDATED: '描述已更新',
        PRICE_CHANGED: '金额已修改',
        MEDIA_ADDED: '已添加素材',
        MEDIA_REMOVED: '已移除素材',
        APPROVED: '订单已批准',
        REJECTED: '订单已拒绝',
        SHIPPING_ESTIMATE_CHANGED: '预估运费已修改',
        CHANGES_REQUESTED: '已请求客户确认',
        CUSTOMER_APPROVED_CHANGES: '客户已确认修改',
        CUSTOMER_REJECTED_CHANGES: '客户已拒绝修改',
        PAYMENT_DATA_SENT: '付款信息已发送给客户',
        MARKED_PAID_BY_CUSTOMER: '客户已标记为已付款',
        PAYMENT_CONFIRMED: '付款已确认',
        PAYMENT_ATTACHMENT_ADDED: '已添加付款单据',
        PAYMENT_ATTACHMENT_REMOVED: '已移除付款单据',
    },
};

export function orderChangeLogTypeLabel(type: string) {
    return ORDER_CHANGE_LOG_TYPE_LABELS[getStoreLocale()][type] ?? type;
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

const PACKAGE_STATUS_LABELS: Record<Locale, Record<PackageStatus, string>> = {
    'pt-BR': {
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
    },
    'zh-Hans': {
        DRAFT: '草稿',
        AWAITING_APPROVAL: '待审批',
        PREPARING: '准备中',
        READY_FOR_DISPATCH: '待发货',
        SHIPPED: '已发货',
        IN_TRANSIT: '运输中',
        CUSTOMS: '清关中',
        OUT_FOR_DELIVERY: '派送中',
        DELIVERED: '已签收',
        EXCEPTION: '异常',
        RETURNED: '已退回',
        CANCELLED: '已取消',
    },
};

export function packageStatusLabel(status: string) {
    return PACKAGE_STATUS_LABELS[getStoreLocale()][status as PackageStatus] ?? status;
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
    markedPaidByUserAt: string | null;
    photoUrls: string[];
    paymentAttachments: AdminPaymentAttachment[];
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

export const REFUND_STATUSES = [
    'REQUESTED',
    'APPROVED',
    'AWAITING_PROVIDER',
    'PROCESSING',
    'COMPLETED',
    'REJECTED',
    'FAILED',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

const REFUND_STATUS_LABELS: Record<Locale, Record<RefundStatus, string>> = {
    'pt-BR': {
        REQUESTED: 'Solicitado',
        APPROVED: 'Aprovado',
        AWAITING_PROVIDER: 'Aguardando provedor',
        PROCESSING: 'Em processamento',
        COMPLETED: 'Concluído',
        REJECTED: 'Rejeitado',
        FAILED: 'Falhou',
    },
    'zh-Hans': {
        REQUESTED: '已申请',
        APPROVED: '已批准',
        AWAITING_PROVIDER: '等待支付方',
        PROCESSING: '处理中',
        COMPLETED: '已完成',
        REJECTED: '已拒绝',
        FAILED: '失败',
    },
};

export function refundStatusLabel(status: string) {
    return REFUND_STATUS_LABELS[getStoreLocale()][status as RefundStatus] ?? status;
}

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
    return new Intl.DateTimeFormat(LOCALE_INTL_TAG[getStoreLocale()], {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}
