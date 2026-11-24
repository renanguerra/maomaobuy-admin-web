'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferências da pessoa neste navegador: telas fixadas e últimos acessos da
 * busca. Conveniência, não dado — navegador sem armazenamento só perde o
 * atalho. Os últimos acessos levam nome de cliente, por isso ficam na sessão
 * do navegador e saem no logout.
 */
type Area = 'local' | 'session';

const listeners = new Set<() => void>();
const parsed = new Map<string, { raw: string | null; value: readonly unknown[] }>();
const EMPTY: readonly unknown[] = [];

function storage(area: Area): Storage | undefined {
    try {
        return area === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
        return undefined;
    }
}

/** A mesma leitura devolve a mesma lista, como o `useSyncExternalStore` exige. */
function readList(area: Area, key: string): readonly unknown[] {
    let raw: string | null = null;
    try {
        raw = storage(area)?.getItem(key) ?? null;
    } catch {
        raw = null;
    }
    const cached = parsed.get(key);
    if (cached && cached.raw === raw) return cached.value;
    let value = EMPTY;
    try {
        const json: unknown = raw ? JSON.parse(raw) : undefined;
        if (Array.isArray(json)) value = json;
    } catch {
        value = EMPTY;
    }
    parsed.set(key, { raw, value });
    return value;
}

function writeList(area: Area, key: string, value: readonly unknown[]) {
    try {
        storage(area)?.setItem(key, JSON.stringify(value));
    } catch {
        /* sem armazenamento: o atalho não fica guardado */
    }
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener('storage', listener);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', listener);
    };
}

function useStoredList(area: Area, key: string) {
    const getSnapshot = useCallback(() => readList(area, key), [area, key]);
    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export const MAX_PINS = 6;
const pinsKey = (adminId: string) => `mm-admin-pins:${adminId}`;

function pinsOf(stored: readonly unknown[]): string[] {
    return stored.filter((value): value is string => typeof value === 'string').slice(0, MAX_PINS);
}

/** Telas fixadas, pela chave do item de menu. */
export function usePinnedItems(adminId: string | undefined) {
    const key = pinsKey(adminId ?? '');
    const pins = pinsOf(useStoredList('local', key));

    function toggle(item: string) {
        if (!adminId) return;
        // Lê o guardado agora: dois cliques seguidos não podem perder o primeiro.
        const current = pinsOf(readList('local', key));
        const next = current.includes(item) ? current.filter((pin) => pin !== item) : [...current, item];
        if (next.length <= MAX_PINS) writeList('local', key, next);
    }

    return { pins, toggle };
}

export interface RecentEntry {
    href: string;
    title: string;
    meta?: string;
}

const MAX_RECENTS = 5;
const recentsKey = (adminId: string) => `mm-admin-recents:${adminId}`;

function isRecent(value: unknown): value is RecentEntry {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.href === 'string' &&
        (entry.href === '/admin' || entry.href.startsWith('/admin/')) &&
        typeof entry.title === 'string' &&
        (entry.meta === undefined || typeof entry.meta === 'string')
    );
}

export function useRecentEntries(adminId: string | undefined) {
    return useStoredList('session', recentsKey(adminId ?? ''))
        .filter(isRecent)
        .slice(0, MAX_RECENTS);
}

export function rememberEntry(adminId: string | undefined, entry: RecentEntry) {
    if (!adminId) return;
    const key = recentsKey(adminId);
    const others = readList('session', key)
        .filter(isRecent)
        .filter((item) => item.href !== entry.href);
    writeList('session', key, [entry, ...others].slice(0, MAX_RECENTS));
}

export function clearRecentEntries(adminId: string | undefined) {
    if (adminId) writeList('session', recentsKey(adminId), EMPTY);
}

let lastWorkHref: string | undefined;

/** Última tela fora de Ajustes, para onde o "Voltar ao painel" leva. */
export function rememberWorkHref(href: string) {
    lastWorkHref = href;
}

export function getWorkHref() {
    return lastWorkHref;
}
