'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { refundNeedsAction } from '@/types/api';
import type { AdminInspection, AdminOrder, AdminPackage, AdminProductRequest, AdminRefundRequest, Page } from '@/types/api';

export interface PendingCounts {
    ordersAwaitingReview: number;
    ordersAwaitingPayment: number;
    packagesAwaitingApproval: number;
    /** Inspeções em que o cliente pediu uma ação nossa — fila do armazém. */
    inspectionsAwaitingAdmin: number;
    refundsRequested: number;
    productRequestsNew: number;
}

type Listener = (counts: PendingCounts | undefined) => void;

let cache: PendingCounts | undefined;
let inFlight: Promise<PendingCounts> | undefined;
const listeners = new Set<Listener>();

function publish(next: PendingCounts | undefined) {
    cache = next;
    for (const listener of listeners) listener(next);
}

async function fetchCounts(): Promise<PendingCounts> {
    // `limit=1` porque só interessa o `total` — o corpo da resposta é descartado.
    const [awaitingReview, awaitingPayment, awaitingApproval, inspections, refunds, productRequests] =
        await Promise.all([
            api<Page<AdminOrder>>('/orders?status=AWAITING_REVIEW&limit=1'),
            api<Page<AdminOrder>>('/orders?status=UNPAID&limit=1'),
            api<Page<AdminPackage>>('/packages?status=AWAITING_APPROVAL&limit=1'),
            api<AdminInspection[]>('/inspections?status=AWAITING_ADMIN'),
            api<AdminRefundRequest[]>('/finance/refunds'),
            api<Page<AdminProductRequest>>('/product-requests?status=NEW&limit=1'),
        ]);

    return {
        ordersAwaitingReview: awaitingReview.total,
        ordersAwaitingPayment: awaitingPayment.total,
        packagesAwaitingApproval: awaitingApproval.total,
        inspectionsAwaitingAdmin: inspections.length,
        refundsRequested: refunds.filter((refund) => refundNeedsAction(refund.status)).length,
        productRequestsNew: productRequests.total,
    };
}

/** Recarrega os contadores e avisa todo mundo que os exibe (sidebar, painel). */
export async function refreshPendingCounts(): Promise<PendingCounts | undefined> {
    inFlight ??= fetchCounts()
        .then((counts) => {
            publish(counts);
            return counts;
        })
        .finally(() => {
            inFlight = undefined;
        });

    try {
        return await inFlight;
    } catch {
        return undefined;
    }
}

export function clearPendingCounts() {
    publish(undefined);
}

/**
 * Contadores de fila usados nos selos da barra lateral e nos indicadores do
 * painel inicial. Ficam em cache no módulo para que trocar de página não
 * dispare a mesma consulta de novo.
 */
export function usePendingCounts() {
    const [counts, setCounts] = useState<PendingCounts | undefined>(cache);

    useEffect(() => {
        listeners.add(setCounts);
        if (!cache) void refreshPendingCounts();
        return () => {
            listeners.delete(setCounts);
        };
    }, []);

    return { counts, refresh: refreshPendingCounts };
}
