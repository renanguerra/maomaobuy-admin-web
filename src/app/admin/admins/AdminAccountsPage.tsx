'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/services/api';
import { logoutAdminAccount, useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { AdminAccount, Page } from '@/types/api';
import { adminAccountStatusLabel, formatDate } from '@/types/api';
import { CreateAdminAccountPanel } from './CreateAdminAccountPanel';
import { ResetAdminAccountPasswordDialog } from './ResetAdminAccountPasswordDialog';

export function AdminAccountsPage() {
    const { admin } = useAdminAccountAuth();
    const [page, setPage] = useState<Page<AdminAccount>>();
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<string>();
    const [resetTarget, setResetTarget] = useState<AdminAccount>();
    const [signingOut, setSigningOut] = useState(false);
    const [pendingId, setPendingId] = useState<string>();

    function load() {
        setLoading(true);
        api<Page<AdminAccount>>('/admin-accounts?limit=100')
            .then(setPage)
            .catch(() => setError('Não foi possível carregar os admins.'))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        if (admin) load();
    }, [admin]);

    if (!admin) return null;

    function updateRow(updated: AdminAccount) {
        setPage((current) => (current ? { ...current, data: current.data.map((row) => (row.id === updated.id ? updated : row)) } : current));
    }

    function addRow(created: AdminAccount) {
        setPage((current) => (current ? { ...current, data: [created, ...current.data], total: current.total + 1 } : current));
    }

    async function toggleStatus(row: AdminAccount) {
        setPendingId(row.id);
        setError(undefined);
        try {
            const updated = await api<AdminAccount>(`/admin-accounts/${row.id}/${row.status === 'ACTIVE' ? 'disable' : 'enable'}`, {
                method: 'POST',
            });
            updateRow(updated);
            setFeedback(row.status === 'ACTIVE' ? `${row.name} foi desativado.` : `${row.name} foi reativado.`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.');
        } finally {
            setPendingId(undefined);
        }
    }

    async function handleResetPassword(password: string) {
        if (!resetTarget) return;
        const updated = await api<AdminAccount>(`/admin-accounts/${resetTarget.id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        updateRow(updated);
        setFeedback(`Senha de ${updated.name} redefinida.`);
        setResetTarget(undefined);
    }

    async function handleSignOut() {
        setSigningOut(true);
        try {
            await logoutAdminAccount();
        } finally {
            setSigningOut(false);
        }
    }

    return (
        <main>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="mm-kicker mb-3">Sistema</p>
                    <h1 className="m-0 text-3xl tracking-[-.03em]">Administradores</h1>
                    <p className="mt-2 text-sm text-muted dark:text-night-muted">
                        Logado como <strong>{admin.name}</strong> ({admin.email})
                    </p>
                </div>
                <Button
                    size="small"
                    variant="ghost"
                    onClick={handleSignOut}
                    loading={signingOut}
                    leadingIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
                >
                    Sair da conta admin
                </Button>
            </div>

            {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}
            {error && <p className="mt-4 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">Carregando admins…</p>}

            {!loading && page && (
                <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                <th className="py-3 pr-4">Nome</th>
                                <th className="py-3 pr-4">E-mail</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Criado em</th>
                                <th className="py-3 pr-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {page.data.map((row) => (
                                <tr className="border-b border-line dark:border-night-line" key={row.id}>
                                    <td className="py-3 pr-4 font-semibold">
                                        {row.name}
                                        {row.id === admin.id && <span className="ml-2 text-xs font-normal text-muted dark:text-night-muted">(você)</span>}
                                    </td>
                                    <td className="py-3 pr-4">{row.email}</td>
                                    <td className="py-3 pr-4">
                                        <span className="mm-kicker">{adminAccountStatusLabel(row.status)}</span>
                                    </td>
                                    <td className="py-3 pr-4 text-muted dark:text-night-muted">{formatDate(row.createdAt)}</td>
                                    <td className="py-3 pr-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="small" variant="secondary" onClick={() => setResetTarget(row)}>
                                                Redefinir senha
                                            </Button>
                                            <Button
                                                size="small"
                                                variant={row.status === 'ACTIVE' ? 'danger' : 'primary'}
                                                onClick={() => toggleStatus(row)}
                                                loading={pendingId === row.id}
                                                disabled={row.id === admin.id}
                                            >
                                                {row.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {page.data.length === 0 && (
                                <tr>
                                    <td className="py-6 text-muted" colSpan={5}>
                                        Nenhum admin encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateAdminAccountPanel onCreated={addRow} />

            <ResetAdminAccountPasswordDialog
                open={Boolean(resetTarget)}
                adminName={resetTarget?.name}
                onCancel={() => setResetTarget(undefined)}
                onConfirm={handleResetPassword}
            />
        </main>
    );
}
