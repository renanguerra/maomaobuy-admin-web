'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { AdminAccount } from '@/types/api';

const listeners = new Set<() => void>();
let current: AdminAccount | null = null;
let loaded = false;
let pendingLoad: Promise<AdminAccount | null> | null = null;

function emitChanged() {
    for (const listener of listeners) listener();
}

/**
 * Sessão individual do admin logado, separada do token compartilhado do
 * painel (ver `services/auth/auth.ts`). Usada apenas pela tela de
 * gerenciamento de contas admin.
 */
export async function checkAdminAccountAuth(): Promise<AdminAccount | null> {
    if (pendingLoad) return pendingLoad;

    pendingLoad = (async () => {
        try {
            current = await api<AdminAccount>('/admin-auth/me');
        } catch {
            current = null;
        } finally {
            loaded = true;
        }
        return current;
    })();

    try {
        return await pendingLoad;
    } finally {
        pendingLoad = null;
    }
}

export function useAdminAccountAuth() {
    const [, rerender] = useState(0);
    useEffect(() => {
        const listener = () => rerender((value) => value + 1);
        listeners.add(listener);
        if (!loaded) void checkAdminAccountAuth().then(emitChanged);
        return () => {
            listeners.delete(listener);
        };
    }, []);
    return { isReady: loaded, admin: current };
}

export async function loginAdminAccount(email: string, password: string) {
    const { admin } = await api<{ admin: AdminAccount }>('/admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    current = admin;
    loaded = true;
    emitChanged();
    return admin;
}

export async function logoutAdminAccount() {
    await api('/admin-auth/logout', { method: 'POST' });
    current = null;
    loaded = true;
    emitChanged();
}
