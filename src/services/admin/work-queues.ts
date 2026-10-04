import type { OrderStatus, PackageStatus, WorkQueueStageKey } from '@/types/api';

/**
 * Abas das listagens de pedidos e pacotes. Cada aba é uma etapa de trabalho
 * (às vezes mais de um status) e, exceto "Todos", lista o mais parado
 * primeiro — é fila, não arquivo. `counts` diz quais filas do painel somam
 * no número da aba; sem `counts` a aba não mostra número (o status dela não
 * corresponde exatamente a uma fila).
 */
export interface QueueTab<S extends string> {
    statuses: readonly S[];
    counts?: readonly WorkQueueStageKey[];
}

export const ORDER_QUEUE_TABS = {
    all: { statuses: [] },
    review: { statuses: ['AWAITING_REVIEW'], counts: ['ordersToReview'] },
    purchase: { statuses: ['SUBMITTED'], counts: ['ordersToPurchase'] },
    seller: { statuses: ['PURCHASED', 'SELLER_SHIPPED'], counts: ['ordersWithSeller', 'ordersInboundToWarehouse'] },
    inspect: { statuses: ['IN_WAREHOUSE'], counts: ['ordersToInspect'] },
    refund: { statuses: ['REFUND_REQUESTED'], counts: ['ordersRefundToConfirm'] },
    customer: {
        statuses: ['AWAITING_CUSTOMER_APPROVAL', 'UNPAID', 'INSPECTION_PENDING', 'READY_TO_SHIP', 'PARTIALLY_SHIPPED'],
    },
} as const satisfies Record<string, QueueTab<OrderStatus>>;

export type OrderQueueTab = keyof typeof ORDER_QUEUE_TABS;

export const PACKAGE_QUEUE_TABS = {
    all: { statuses: [] },
    review: { statuses: ['DRAFT', 'AWAITING_APPROVAL'], counts: ['packagesDraft', 'packagesToReview'] },
    quote: { statuses: ['AWAITING_FREIGHT_QUOTE'], counts: ['packagesToQuote'] },
    freight: { statuses: ['AWAITING_FREIGHT_PAYMENT'], counts: ['packagesAwaitingFreightPayment'] },
    dispatch: { statuses: ['READY_FOR_DISPATCH'], counts: ['packagesToDispatch'] },
    transit: {
        statuses: ['SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY'],
        counts: ['packagesInTransit'],
    },
    exception: { statuses: ['EXCEPTION'], counts: ['packagesException'] },
} as const satisfies Record<string, QueueTab<PackageStatus>>;

export type PackageQueueTab = keyof typeof PACKAGE_QUEUE_TABS;

export function isQueueTab<T extends string>(tabs: Record<T, unknown>, value: string | null): value is T {
    return value !== null && Object.prototype.hasOwnProperty.call(tabs, value);
}

/** Pedidos que são vez do time — a prévia do painel inicial. */
export const TEAM_ORDER_STATUSES: readonly OrderStatus[] = [
    'AWAITING_REVIEW',
    'SUBMITTED',
    'IN_WAREHOUSE',
    'REFUND_REQUESTED',
];

/** Pacotes que são vez do time — a prévia do painel inicial. */
export const TEAM_PACKAGE_STATUSES: readonly PackageStatus[] = [
    'DRAFT',
    'AWAITING_APPROVAL',
    'AWAITING_FREIGHT_QUOTE',
    'READY_FOR_DISPATCH',
    'EXCEPTION',
];

/** Para onde cada cartão do painel leva. */
export const STAGE_LINKS: Record<WorkQueueStageKey, string> = {
    ordersToReview: '/admin/pedidos?fila=review',
    ordersToPurchase: '/admin/pedidos?fila=purchase',
    ordersToInspect: '/admin/inspecoes',
    inspectionsAwaitingAdmin: '/admin/inspecoes',
    ordersRefundToConfirm: '/admin/pedidos?fila=refund',
    packagesDraft: '/admin/pacotes?fila=review',
    packagesToReview: '/admin/pacotes?fila=review',
    packagesToQuote: '/admin/pacotes?fila=quote',
    packagesToDispatch: '/admin/pacotes?fila=dispatch',
    packagesException: '/admin/pacotes?fila=exception',
    productRequestsNew: '/admin/pedidos-de-produto',
    refundRequests: '/admin/financeiro',
    ordersWithSeller: '/admin/pedidos?fila=seller',
    ordersInboundToWarehouse: '/admin/pedidos?fila=seller',
    packagesInTransit: '/admin/pacotes?fila=transit',
    ordersAwaitingCustomerApproval: '/admin/pedidos?status=AWAITING_CUSTOMER_APPROVAL',
    ordersAwaitingPayment: '/admin/pedidos?status=UNPAID',
    inspectionsAwaitingCustomer: '/admin/pedidos?status=INSPECTION_PENDING',
    ordersUnpacked: '/admin/sem-pacote',
    packagesAwaitingFreightPayment: '/admin/pacotes?fila=freight',
};
