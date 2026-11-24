import type { AccountType, Page } from './api';

/** Grupos prontos da lista de clientes (mesmos do backend). */
export const CUSTOMER_SEGMENTS = ['ONE_TIME', 'UNPACKED', 'FREIGHT_UNPAID', 'ACTIVE_WHOLESALE'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SORTS = ['newest', 'lastPurchase', 'spent'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerStats {
    /** Compras pagas e não desfeitas; resgate e brinde não contam. */
    purchases: number;
    /** Mercadoria paga em fen, sem cupom, sem item devolvido e sem frete. */
    spentAmountMinor: string;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
    unpackedUnits: number;
    freightUnpaid: number;
}

export interface CustomerListItem extends CustomerStats {
    id: string;
    name: string;
    username: string;
    email: string;
    status: string;
    accountType: AccountType;
    excludedFromReports: boolean;
    createdAt: string;
    tags: string[];
}

export interface CustomerPage extends Page<CustomerListItem> {
    segmentCounts: Record<CustomerSegment, number>;
}

export interface CustomerSummary extends CustomerStats {
    tags: string[];
    notes: number;
}

export interface CustomerNote {
    id: string;
    body: string;
    authorId: string | null;
    authorName: string | null;
    createdAt: string;
}

export interface CustomerTagCount {
    label: string;
    customers: number;
}

export const CUSTOMER_TAG_MAX_LENGTH = 30;
export const CUSTOMER_MAX_TAGS = 10;

export const CUSTOMER_TIMELINE_KINDS = [
    'ACCOUNT_CREATED',
    'ORDER_CREATED',
    'ORDER_PAID',
    'ORDER_MESSAGE',
    'PACKAGE_CREATED',
    'PACKAGE_PAID',
    'PACKAGE_SHIPPED',
    'PACKAGE_DELIVERED',
    'PACKAGE_MESSAGE',
    'PRODUCT_REQUEST',
    'EMAIL_SENT',
    'NOTE',
] as const;
export type CustomerTimelineKind = (typeof CUSTOMER_TIMELINE_KINDS)[number];

export interface CustomerTimelineEvent {
    key: string;
    kind: CustomerTimelineKind;
    at: string;
    resourceId: string | null;
    detail: string | null;
    author: 'CUSTOMER' | 'TEAM' | null;
}

export interface CustomerTimelinePage {
    data: CustomerTimelineEvent[];
    nextCursor: string | null;
}
