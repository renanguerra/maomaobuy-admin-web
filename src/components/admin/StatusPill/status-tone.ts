export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

/**
 * Cor de cada situação. A regra é sempre a mesma em todo o painel:
 * âmbar = depende de uma ação do admin ou do cliente, azul-teal = em
 * andamento, verde = encerrado com sucesso, coral = problema, cinza = inerte.
 */
const ORDER_STATUS_TONES: Record<string, StatusTone> = {
    AWAITING_REVIEW: 'warning',
    AWAITING_CUSTOMER_APPROVAL: 'warning',
    GENERATING_PAYMENT_DATA: 'warning',
    UNPAID: 'warning',
    PENDING: 'info',
    SUBMITTED: 'info',
    PURCHASED: 'info',
    SELLER_SHIPPED: 'info',
    IN_WAREHOUSE: 'info',
    INSPECTION_PENDING: 'warning',
    READY_TO_SHIP: 'info',
    PARTIALLY_SHIPPED: 'info',
    SHIPPED: 'info',
    COMPLETED: 'success',
    REFUND_REQUESTED: 'warning',
    REFUND: 'neutral',
    INVALID: 'danger',
    CANCELLED: 'neutral',
};

const PACKAGE_STATUS_TONES: Record<string, StatusTone> = {
    DRAFT: 'neutral',
    AWAITING_APPROVAL: 'warning',
    AWAITING_FREIGHT_QUOTE: 'info',
    AWAITING_FREIGHT_PAYMENT: 'warning',
    READY_FOR_DISPATCH: 'warning',
    SHIPPED: 'info',
    IN_TRANSIT: 'info',
    CUSTOMS: 'warning',
    OUT_FOR_DELIVERY: 'info',
    DELIVERED: 'success',
    EXCEPTION: 'danger',
    RETURNED: 'danger',
    CANCELLED: 'neutral',
};

const USER_STATUS_TONES: Record<string, StatusTone> = {
    ACTIVE: 'success',
    SUSPENDED: 'danger',
    PENDING_ACTIVATION: 'warning',
};

const ADMIN_ACCOUNT_STATUS_TONES: Record<string, StatusTone> = {
    ACTIVE: 'success',
    DISABLED: 'neutral',
};

const REFUND_STATUS_TONES: Record<string, StatusTone> = {
    REQUESTED: 'warning',
    APPROVED: 'info',
    AWAITING_PROVIDER: 'info',
    PROCESSING: 'info',
    COMPLETED: 'success',
    REJECTED: 'danger',
    FAILED: 'danger',
};

const INSPECTION_STATUS_TONES: Record<string, StatusTone> = {
    PENDING: 'neutral',
    AWAITING_CUSTOMER: 'info',
    AWAITING_ADMIN: 'warning',
    DECIDED: 'success',
};

export function inspectionStatusTone(status: string): StatusTone {
    return INSPECTION_STATUS_TONES[status] ?? 'neutral';
}

export function orderStatusTone(status: string): StatusTone {
    return ORDER_STATUS_TONES[status] ?? 'neutral';
}

export function packageStatusTone(status: string): StatusTone {
    return PACKAGE_STATUS_TONES[status] ?? 'neutral';
}

export function userStatusTone(status: string): StatusTone {
    return USER_STATUS_TONES[status] ?? 'neutral';
}

export function adminAccountStatusTone(status: string): StatusTone {
    return ADMIN_ACCOUNT_STATUS_TONES[status] ?? 'neutral';
}

export function refundStatusTone(status: string): StatusTone {
    return REFUND_STATUS_TONES[status] ?? 'neutral';
}

export function publishedTone(isPublished: boolean): StatusTone {
    return isPublished ? 'success' : 'neutral';
}
