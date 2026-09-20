'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';

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

/**
 * Uma chamada só: o backend devolve as seis contagens numa consulta. Antes
 * eram seis listagens `limit=1` em paralelo, cada uma pagando guard de
 * sessão + contagem + página com JOINs — ~30 consultas e seis conexões do
 * pool para seis números.
 */
function fetchCounts(): Promise<PendingCounts> {
    return api<PendingCounts>('/dashboard/pending-counts');
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
