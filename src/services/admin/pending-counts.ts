'use client';

import { useEffect, useSyncExternalStore } from 'react';
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

type QueueState = { queue: WorkQueue | undefined; status: 'idle' | 'loading' | 'ready' | 'error' };
type Listener = () => void;

/** Idade máxima do cache antes de uma tela nova (ou a volta à aba) buscar de novo. */
const STALE_AFTER_MS = 60_000;

let cache: WorkQueue | undefined;
const initialState: QueueState = { queue: undefined, status: 'idle' };
let state = initialState;
let generation = 0;
let fetchedAt = 0;
let inFlight: Promise<WorkQueue> | undefined;
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

function publish(next: WorkQueue | undefined, status: QueueState['status']) {
    cache = next;
    state = { queue: next, status };
    for (const listener of listeners) listener();
}

/**
 * Uma chamada só: o backend devolve todas as filas numa consulta, com
 * contagem, atrasados e o mais antigo de cada uma.
 */
function fetchQueue(): Promise<WorkQueue> {
    return api<WorkQueue>('/dashboard/work-queue', { signal: AbortSignal.timeout(15_000) });
}

/** Recarrega as filas e avisa todo mundo que as exibe (sidebar, painel, abas). */
export async function refreshPendingCounts(): Promise<WorkQueue | undefined> {
    if (inFlight) return inFlight.catch(() => undefined);
    const currentGeneration = generation;
    publish(cache, 'loading');
    const request = fetchQueue()
        .then((queue) => {
            if (generation === currentGeneration) {
                fetchedAt = Date.now();
                publish(queue, 'ready');
            }
            return queue;
        })
        .catch((error: unknown) => {
            if (generation === currentGeneration) publish(cache, 'error');
            throw error;
        })
        .finally(() => {
            if (inFlight === request) inFlight = undefined;
        });
    inFlight = request;
    return request.catch(() => undefined);
}

export function clearPendingCounts() {
    generation += 1;
    fetchedAt = 0;
    inFlight = undefined;
    publish(undefined, 'idle');
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
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const { queue, status } = snapshot;

    useEffect(() => {
        refreshIfStale();
        const onVisible = () => {
            if (document.visibilityState === 'visible') refreshIfStale();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return {
        queue,
        error: status === 'error',
        loading: status === 'idle' || status === 'loading',
        counts: queue ? badgesOf(queue) : undefined,
        refresh: refreshPendingCounts,
    };
}
