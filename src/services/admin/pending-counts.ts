'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { WorkQueue, WorkQueueStage, WorkQueueStageKey } from '@/types/api';

/** Selo de um item do menu: quanto é nosso e quanto disso já passou do prazo. */
export interface MenuBadgeCount {
    count: number;
    overdue: number;
}

/**
 * Filas que somam no selo de cada área do menu. Só entra o que é vez do time
 * (`TEAM`): o que espera o cliente não é pendência nossa, e o que está com
 * vendedor ou transportadora só aparece no painel quando atrasa.
 */
const BADGE_STAGES = {
    orders: ['ordersToReview', 'ordersToPurchase', 'ordersRefundToConfirm'],
    inspections: ['ordersToInspect', 'inspectionsAwaitingAdmin'],
    packages: ['packagesDraft', 'packagesToReview', 'packagesToQuote', 'packagesToDispatch', 'packagesException'],
    productRequests: ['productRequestsNew'],
    finance: ['refundRequests'],
} as const satisfies Record<string, readonly WorkQueueStageKey[]>;

export type PendingCounts = Record<keyof typeof BADGE_STAGES, MenuBadgeCount>;

/** Uma fila pelo nome; fila desconhecida (backend antigo) volta zerada. */
export function queueStage(queue: WorkQueue | undefined, key: WorkQueueStageKey): WorkQueueStage {
    return (
        queue?.stages.find((stage) => stage.key === key) ?? {
            key,
            owner: 'TEAM',
            count: 0,
            overdue: 0,
            oldestSince: null,
            deadlineHours: null,
        }
    );
}

function badgesOf(queue: WorkQueue): PendingCounts {
    const entries = Object.entries(BADGE_STAGES).map(([badge, keys]) => {
        const stages = keys.map((key) => queueStage(queue, key));
        return [
            badge,
            {
                count: stages.reduce((sum, stage) => sum + stage.count, 0),
                overdue: stages.reduce((sum, stage) => sum + stage.overdue, 0),
            },
        ];
    });
    return Object.fromEntries(entries) as PendingCounts;
}

type Listener = (queue: WorkQueue | undefined) => void;

/** Idade máxima do cache antes de uma tela nova (ou a volta à aba) buscar de novo. */
const STALE_AFTER_MS = 60_000;

let cache: WorkQueue | undefined;
let fetchedAt = 0;
let inFlight: Promise<WorkQueue> | undefined;
const listeners = new Set<Listener>();

function publish(next: WorkQueue | undefined) {
    cache = next;
    for (const listener of listeners) listener(next);
}

/**
 * Uma chamada só: o backend devolve todas as filas numa consulta, com
 * contagem, atrasados e o mais antigo de cada uma.
 */
function fetchQueue(): Promise<WorkQueue> {
    return api<WorkQueue>('/dashboard/work-queue');
}

/** Recarrega as filas e avisa todo mundo que as exibe (sidebar, painel, abas). */
export async function refreshPendingCounts(): Promise<WorkQueue | undefined> {
    inFlight ??= fetchQueue()
        .then((queue) => {
            fetchedAt = Date.now();
            publish(queue);
            return queue;
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
    fetchedAt = 0;
    publish(undefined);
}

function refreshIfStale() {
    if (Date.now() - fetchedAt > STALE_AFTER_MS) void refreshPendingCounts();
}

/**
 * Filas de trabalho usadas nos selos da barra lateral, no painel inicial e
 * nas abas das listagens. Ficam em cache no módulo para que trocar de página
 * não dispare a mesma consulta; voltar à aba depois de um minuto atualiza.
 */
export function usePendingCounts() {
    const [queue, setQueue] = useState<WorkQueue | undefined>(cache);

    useEffect(() => {
        listeners.add(setQueue);
        refreshIfStale();
        const onVisible = () => {
            if (document.visibilityState === 'visible') refreshIfStale();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            listeners.delete(setQueue);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return { queue, counts: queue ? badgesOf(queue) : undefined, refresh: refreshPendingCounts };
}
