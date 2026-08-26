'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { logoutAdminAccount, useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { AdminAccount, Page } from '@/types/api';
import { adminAccountStatusLabel, formatDate } from '@/types/api';
import { CreateAdminAccountPanel } from './CreateAdminAccountPanel';
import { ResetAdminAccountPasswordDialog } from './ResetAdminAccountPasswordDialog';

export function AdminAccountsPage() {
    const { t } = useTranslation();
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
            .catch(() => setError(t('admins.list.error')))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        if (admin) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            setFeedback(t(row.status === 'ACTIVE' ? 'admins.list.feedback.deactivated' : 'admins.list.feedback.reactivated', { name: row.name }));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('admins.list.actionError'));
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
        setFeedback(t('admins.feedback.passwordReset', { name: updated.name }));
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
                    <p className="mm-kicker mb-3">{t('admins.list.kicker')}</p>
                    <h1 className="m-0 text-3xl tracking-[-.03em]">{t('admins.list.title')}</h1>
                    <p className="mt-2 text-sm text-muted dark:text-night-muted">{t('admins.list.loggedInAs', { name: admin.name, email: admin.email })}</p>
                </div>
                <Button
                    size="small"
                    variant="ghost"
                    onClick={handleSignOut}
                    loading={signingOut}
                    leadingIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
                >
                    {t('admins.list.signOutButton')}
                </Button>
            </div>

            {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}
            {error && <p className="mt-4 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">{t('admins.list.loading')}</p>}

            {!loading && page && (
                <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                <th className="py-3 pr-4">{t('admins.list.columns.name')}</th>
                                <th className="py-3 pr-4">{t('admins.list.columns.email')}</th>
                                <th className="py-3 pr-4">{t('admins.list.columns.status')}</th>
                                <th className="py-3 pr-4">{t('admins.list.columns.createdAt')}</th>
                                <th className="py-3 pr-4">{t('admins.list.columns.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {page.data.map((row) => (
                                <tr className="border-b border-line dark:border-night-line" key={row.id}>
                                    <td className="py-3 pr-4 font-semibold">
                                        {row.name}
                                        {row.id === admin.id && <span className="ml-2 text-xs font-normal text-muted dark:text-night-muted">{t('common.you')}</span>}
                                    </td>
                                    <td className="py-3 pr-4">{row.email}</td>
                                    <td className="py-3 pr-4">
                                        <span className="mm-kicker">{adminAccountStatusLabel(row.status)}</span>
                                    </td>
                                    <td className="py-3 pr-4 text-muted dark:text-night-muted">{formatDate(row.createdAt)}</td>
                                    <td className="py-3 pr-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="small" variant="secondary" onClick={() => setResetTarget(row)}>
                                                {t('admins.list.resetPasswordButton')}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant={row.status === 'ACTIVE' ? 'danger' : 'primary'}
                                                onClick={() => toggleStatus(row)}
                                                loading={pendingId === row.id}
                                                disabled={row.id === admin.id}
                                            >
                                                {row.status === 'ACTIVE' ? t('admins.list.deactivateButton') : t('admins.list.activateButton')}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {page.data.length === 0 && (
                                <tr>
                                    <td className="py-6 text-muted" colSpan={5}>
                                        {t('admins.list.empty')}
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
