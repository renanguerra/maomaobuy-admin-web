import { LOCALE_INTL_TAG, type Locale } from '@/i18n/locale';
import { getStoreLocale } from '@/i18n/locale-store';

export interface Page<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
}

/**
 * Resultado das ações em lote de produtos. `ignoredIds` traz o que o banco não
 * alcançou — excluído por outro admin, por exemplo — para a tela dizer "3 de 4"
 * sem chutar.
 */
export interface BulkResult {
    requested: number;
    affected: number;
    ignoredIds: string[];
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

export const ADMIN_ROLES = ['SUPPORT', 'CATALOG', 'WAREHOUSE', 'FINANCE', 'SUPERADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const ADMIN_ROLE_LABELS: Record<Locale, Record<AdminRole, string>> = {
    'pt-BR': {
        SUPPORT: 'Suporte',
        CATALOG: 'Catálogo',
        WAREHOUSE: 'Armazém',
        FINANCE: 'Financeiro',
        SUPERADMIN: 'Superadmin',
    },
    'zh-Hans': {
        SUPPORT: '客服',
        CATALOG: '商品目录',
        WAREHOUSE: '仓库',
        FINANCE: '财务',
        SUPERADMIN: '超级管理员',
    },
};

export function adminRoleLabel(role: string) {
    return ADMIN_ROLE_LABELS[getStoreLocale()][role as AdminRole] ?? role;
}

export interface AdminAccount {
    id: string;
    name: string;
    email: string;
    status: string;
    role: string;
    /** Autenticador TOTP cadastrado e confirmado no backend. */
    totpEnrolled: boolean;
    createdAt: string;
    passwordChangedAt: string;
}

export interface TotpEnrollmentStart {
    /** Base32, para digitar à mão quando a câmera não lê o QR. */
    secret: string;
    /** `otpauth://totp/...` — é o conteúdo do QR. */
    otpauthUri: string;
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
    /** Peso e medidas do item embalado — só a importação em lote os edita hoje. */
    weightGrams: number | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
    isPublished: boolean;
    /** Pré-venda e o dia de lançamento anunciado (`YYYY-MM-DD`), sempre juntos. */
    isPreSale: boolean;
    releaseDate: string | null;
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
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
    'AWAITING_REVIEW',
    'AWAITING_CUSTOMER_APPROVAL',
    'UNPAID',
    'SUBMITTED',
    'PURCHASED',
    'SELLER_SHIPPED',
    'IN_WAREHOUSE',
    'INSPECTION_PENDING',
    'READY_TO_SHIP',
    'PARTIALLY_SHIPPED',
    'SHIPPED',
    'COMPLETED',
    'REFUND_REQUESTED',
    'REFUND',
    'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const ORDER_STATUS_LABELS: Record<Locale, Record<OrderStatus, string>> = {
    'pt-BR': {
        AWAITING_REVIEW: 'Aguardando análise',
        AWAITING_CUSTOMER_APPROVAL: 'Aguardando aprovação do cliente',
        UNPAID: 'Aguardando pagamento',
        SUBMITTED: 'Enviado ao fornecedor',
        PURCHASED: 'Comprado',
        SELLER_SHIPPED: 'Enviado pelo vendedor',
        IN_WAREHOUSE: 'No depósito',
        INSPECTION_PENDING: 'Aguardando inspeção',
        READY_TO_SHIP: 'Pronto para envio',
        PARTIALLY_SHIPPED: 'Parcialmente enviado',
        SHIPPED: 'Enviado',
        COMPLETED: 'Concluído',
        REFUND_REQUESTED: 'Reembolso pendente',
        REFUND: 'Reembolsado',
        CANCELLED: 'Cancelado',
    },
    'zh-Hans': {
        AWAITING_REVIEW: '待审核',
        AWAITING_CUSTOMER_APPROVAL: '待客户确认',
        UNPAID: '待付款',
        SUBMITTED: '已提交给供应商',
        PURCHASED: '已购买',
        SELLER_SHIPPED: '卖家已发货',
        IN_WAREHOUSE: '已到仓',
        INSPECTION_PENDING: '待验货',
        READY_TO_SHIP: '可发货',
        PARTIALLY_SHIPPED: '部分发货',
        SHIPPED: '已发货',
        COMPLETED: '已完成',
        REFUND_REQUESTED: '待退款',
        REFUND: '已退款',
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

export interface OptionalService {
    id: string;
    code: string;
    name: string;
    description: string;
    kind: 'SERVICE' | 'BUNDLE';
    pricingUnit: 'PER_ITEM' | 'PER_PHOTO' | 'PER_ORDER';
    currency: string;
    priceCnyMinor: string;
    /** Teto da faixa em adicional de preço variável; `null` em preço fixo. */
    maxPriceCnyMinor: string | null;
    maxQuantity: number | null;
    isActive: boolean;
    sortOrder: number;
}

export interface OrderOptionalService {
    id: string;
    optionalServiceId: string;
    code: string;
    name: string;
    pricingUnit: 'PER_ITEM' | 'PER_PHOTO' | 'PER_ORDER';
    currency: string;
    quantity: number;
    unitAmountMinor: string;
    totalAmountMinor: string;
    status: 'REQUESTED' | 'COMPLETED' | 'CANCELLED';
    customerNote: string | null;
    adminNote: string | null;
    completedAt: string | null;
}

export interface AdminOrder {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    origin: string | null;
    /** `IN_STOCK` já está no armazém; `SOURCED` ainda precisa ser comprado. */
    fulfillmentMode: 'IN_STOCK' | 'SOURCED';
    status: string;
    currency: string;
    /** Valor da mercadoria, sem os adicionais. */
    totalAmountMinor: string;
    /** Soma dos adicionais contratados. */
    optionalServicesAmountMinor: string;
    /** O que sai da carteira do cliente: mercadoria mais adicionais. */
    chargeableTotalAmountMinor: string;
    /** Entrada no armazém — início da contagem da armazenagem. */
    warehouseArrivedAt: string | null;
    /** Armazenagem já cobrada deste pedido, em fen. */
    storageFeeChargedMinor: string;
    /** Último total autorizado pelo cliente. Menor que o total = precisa de nova aprovação. */
    customerApprovedTotalMinor: string | null;
    shippingEstimateAmountMinor: string | null;
    createdAt: string;
    reviewedAt: string | null;
    reviewedByAdminId: string | null;
    rejectionReason: string | null;
    paidAt: string | null;
    stockReservationExpiresAt: string | null;
    shippedAt: string | null;
    completedAt: string | null;
    adminDescription: string | null;
    items: AdminOrderItem[];
    optionalServices: OrderOptionalService[];
    media: AdminOrderMedia[];
    inspections: OrderInspection[];
    changeLogs: AdminOrderChangeLog[];
}

const ORDER_CHANGE_LOG_TYPE_LABELS: Record<Locale, Record<string, string>> = {
    'pt-BR': {
        DESCRIPTION_UPDATED: 'Descrição atualizada',
        PRICE_CHANGED: 'Valor alterado',
        MEDIA_ADDED: 'Mídia adicionada',
        MEDIA_REMOVED: 'Mídia removida',
        APPROVED: 'Pedido aprovado',
        OPTIONAL_SERVICES_UPDATED: 'Serviços adicionais atualizados',
        OPTIONAL_SERVICE_COMPLETED: 'Serviço adicional concluído',
        OPTIONAL_SERVICE_CANCELLED: 'Serviço adicional cancelado',
        STORAGE_FEE_CHARGED: 'Armazenagem cobrada',
        REJECTED: 'Pedido rejeitado',
        SHIPPING_ESTIMATE_CHANGED: 'Frete estimado alterado',
        CHANGES_REQUESTED: 'Aprovação do cliente solicitada',
        CUSTOMER_APPROVED_CHANGES: 'Cliente aprovou as alterações',
        CUSTOMER_REJECTED_CHANGES: 'Cliente rejeitou as alterações',
        CANCELLED_BY_CUSTOMER: 'Cliente cancelou o pedido',
        PAYMENT_DATA_SENT: 'Pedido liberado para pagamento',
        MARKED_PAID_BY_CUSTOMER: 'Cliente marcou como pago',
        PAYMENT_CONFIRMED: 'Pagamento confirmado',
    },
    'zh-Hans': {
        DESCRIPTION_UPDATED: '描述已更新',
        PRICE_CHANGED: '金额已修改',
        MEDIA_ADDED: '已添加素材',
        MEDIA_REMOVED: '已移除素材',
        APPROVED: '订单已批准',
        OPTIONAL_SERVICES_UPDATED: '增值服务已更新',
        OPTIONAL_SERVICE_COMPLETED: '增值服务已完成',
        OPTIONAL_SERVICE_CANCELLED: '增值服务已取消',
        STORAGE_FEE_CHARGED: '仓储费已计收',
        REJECTED: '订单已拒绝',
        SHIPPING_ESTIMATE_CHANGED: '预估运费已修改',
        CHANGES_REQUESTED: '已请求客户确认',
        CUSTOMER_APPROVED_CHANGES: '客户已确认修改',
        CUSTOMER_REJECTED_CHANGES: '客户已拒绝修改',
        CANCELLED_BY_CUSTOMER: '客户已取消订单',
        PAYMENT_DATA_SENT: '订单已开放付款',
        MARKED_PAID_BY_CUSTOMER: '客户已标记为已付款',
        PAYMENT_CONFIRMED: '付款已确认',
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
    'AWAITING_FREIGHT_QUOTE',
    'AWAITING_FREIGHT_PAYMENT',
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
        AWAITING_APPROVAL: 'Aguardando conferência',
        AWAITING_FREIGHT_QUOTE: 'Aguardando cotação do frete',
        AWAITING_FREIGHT_PAYMENT: 'Aguardando pagamento do frete',
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
        AWAITING_APPROVAL: '待审核',
        AWAITING_FREIGHT_QUOTE: '待报价运费',
        AWAITING_FREIGHT_PAYMENT: '待支付运费',
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
    /** Frete cobrado do cliente: custo mais margem. */
    shippingAmountMinor: string | null;
    /** Custo da transportadora, digitado pelo admin. */
    freightCostAmountMinor: string | null;
    /** Margem aplicada naquela cotação, em pontos-base. */
    freightMarkupBasisPoints: number | null;
    /** Armazenagem dos pedidos do pacote, cobrada junto com o frete. */
    storageFeeAmountMinor: string;
    /** Frete mais armazenagem: o que sai da carteira do cliente. */
    totalDueAmountMinor: string | null;
    destination: AddressSnapshot;
    shippedAt: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
    lastTrackingEventAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    paidAt: string | null;
    markedPaidByUserAt: string | null;
    photoUrls: string[];
    /** Chaves do bucket paralelas a `photoUrls` (mesmo índice) — usadas para remover uma foto. */
    photoKeys: string[];
    createdAt: string;
    items: AdminPackageItem[];
    userId: string;
    userEmail: string;
    userName: string;
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

export interface AdminSetting {
    key: string;
    type: 'INTEGER' | 'DECIMAL';
    value: string;
    description: string | null;
    updatedAt: string;
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

/**
 * Reembolsos que ainda dependem de alguém do financeiro.
 *
 * `REQUESTED` espera a decisão; os outros três esperam o dinheiro voltar —
 * pelo provedor ou por baixa manual. Contar só `REQUESTED` escondia da fila
 * justamente os que já foram aprovados e nunca foram fechados.
 */
export const REFUND_STATUSES_NEEDING_ACTION: RefundStatus[] = [
    'REQUESTED',
    'AWAITING_PROVIDER',
    'PROCESSING',
    'FAILED',
];

export function refundNeedsAction(status: string): boolean {
    return REFUND_STATUSES_NEEDING_ACTION.includes(status as RefundStatus);
}

// ---------------------------------------------------------------------------
// Pedidos de produto
// ---------------------------------------------------------------------------

export const PRODUCT_REQUEST_STATUSES = ['NEW', 'REVIEWING', 'FULFILLED', 'DECLINED'] as const;
export type ProductRequestStatus = (typeof PRODUCT_REQUEST_STATUSES)[number];

const PRODUCT_REQUEST_STATUS_LABELS: Record<Locale, Record<ProductRequestStatus, string>> = {
    'pt-BR': {
        NEW: 'Novo',
        REVIEWING: 'Em análise',
        FULFILLED: 'Disponibilizado',
        DECLINED: 'Recusado',
    },
    'zh-Hans': {
        NEW: '新请求',
        REVIEWING: '审核中',
        FULFILLED: '已提供',
        DECLINED: '已拒绝',
    },
};

export function productRequestStatusLabel(status: string) {
    return PRODUCT_REQUEST_STATUS_LABELS[getStoreLocale()][status as ProductRequestStatus] ?? status;
}

/**
 * Uma linha da fila de saída de e-mails. Sem o endereço do destinatário: o
 * painel precisa saber se o e-mail saiu, não ler o e-mail de ninguém — por
 * isso o backend devolve só o domínio.
 */
export interface AdminEmailDelivery {
    id: string;
    kind: string;
    category: string;
    status: string;
    recipientDomain: string;
    userId: string | null;
    subjectId: string | null;
    attempts: number;
    scheduledFor: string;
    sentAt: string | null;
    lastError: string | null;
    createdAt: string;
}

export const EMAIL_DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export interface AdminProductRequest {
    id: string;
    userId: string;
    description: string;
    referenceUrl: string | null;
    status: string;
    adminNote: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * A carteira de um cliente vista pela operação. Todos os valores são fen: o
 * saldo conta em yuan desde que a recarga passou a cobrar o câmbio uma vez só.
 */
export interface AdminWallet {
    userId: string;
    currency: string;
    status: string;
    pendingAmountMinor: string;
    availableAmountMinor: string;
    reservedAmountMinor: string;
    blockedAmountMinor: string;
    /** Valor em aberto depois de um estorno; é o que trava a carteira. */
    debtAmountMinor: string;
    totalAmountMinor: string;
    lockReason: string | null;
    lockedAt: string | null;
}

export interface AdminRefundRequest {
    id: string;
    userId: string;
    /** Fen retirados do saldo do cliente. */
    amountMinor: string;
    feeAmountMinor: string;
    netAmountMinor: string;
    currency: string;
    /**
     * Centavos de BRL que voltam ao cliente: a soma do que cada recarga de
     * origem custou, não uma conversão do câmbio de hoje. É este o valor que o
     * provedor precisa estornar, e é por ele que a devolução automática só
     * funciona quando bate com a cobrança original.
     */
    payoutAmountMinor: string;
    payoutCurrency: string;
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

export function cny(minor: string | number) {
    return money(minor, 'CNY');
}

export function formatDate(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(LOCALE_INTL_TAG[getStoreLocale()], {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

// ---------------------------------------------------------------------------
// Inspeções
// ---------------------------------------------------------------------------

export const INSPECTION_STATUSES = ['PENDING', 'AWAITING_CUSTOMER', 'AWAITING_ADMIN', 'DECIDED'] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

const INSPECTION_STATUS_LABELS: Record<Locale, Record<InspectionStatus, string>> = {
    'pt-BR': {
        PENDING: 'Rascunho',
        AWAITING_CUSTOMER: 'Com o cliente',
        AWAITING_ADMIN: 'Ação pedida pelo cliente',
        DECIDED: 'Decidida',
    },
    'zh-Hans': {
        PENDING: '草稿',
        AWAITING_CUSTOMER: '等待客户',
        AWAITING_ADMIN: '客户请求处理',
        DECIDED: '已决定',
    },
};

export function inspectionStatusLabel(status: string) {
    return INSPECTION_STATUS_LABELS[getStoreLocale()][status as InspectionStatus] ?? status;
}

export interface AdminInspectionMedia {
    id: string;
    type: 'IMAGE' | 'VIDEO';
    mimeType: string;
    sizeBytes: string;
    sortOrder: number;
    altText: string | null;
    url: string | null;
}

export interface AdminInspection {
    id: string;
    orderItemId: string;
    orderId: string | null;
    productName: string | null;
    userId: string;
    status: string;
    summary: string | null;
    tests: Array<{ name: string; result: string; notes?: string }>;
    media: AdminInspectionMedia[];
    decision: string | null;
    decisionNote: string | null;
    completedAt: string | null;
    decisionDeadlineAt: string | null;
    decidedAt: string | null;
    createdAt: string;
}

/** O laudo como ele chega dentro do pedido — a forma que o painel edita. */
export interface OrderInspection {
    id: string;
    orderItemId: string;
    productName: string;
    status: string;
    summary: string | null;
    tests: Array<{ name: string; result: string; notes?: string }>;
    media: AdminInspectionMedia[];
    decision: string | null;
    decisionNote: string | null;
    decisionDeadlineAt: string | null;
    decidedAt: string | null;
}

/** Item que chegou ao armazém e ainda não tem laudo aberto. */
export interface AdminPendingInspectionItem {
    orderItemId: string;
    orderId: string;
    userId: string;
    productName: string;
}
