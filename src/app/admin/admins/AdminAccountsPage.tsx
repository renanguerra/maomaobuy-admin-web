'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { adminAccountStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { AdminAccount, Page } from '@/types/api';
import { adminAccountStatusLabel, formatDate } from '@/types/api';
import { CreateAdminAccountDialog } from './CreateAdminAccountDialog';
import { ResetAdminAccountPasswordDialog } from './ResetAdminAccountPasswordDialog';

export function AdminAccountsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const { admin } = useAdminAccountAuth();
    const [result, setResult] = useState<Page<AdminAccount>>();
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [resetTarget, setResetTarget] = useState<AdminAccount>();
    const [pendingId, setPendingId] = useState<string>();

    const load = useCallback(() => {
        api<Page<AdminAccount>>('/admin-accounts?limit=100')
            .then((page) => {
                setResult(page);
                setError(undefined);
            })
            .catch(() => setError(t('admins.list.error')))
            .finally(() => setLoading(false));
    }, [t]);

    useEffect(() => {
        if (admin) load();
    }, [admin, load]);

    if (!admin) return null;

    function updateRow(updated: AdminAccount) {
        setResult((current) =>
            current
                ? { ...current, data: current.data.map((row) => (row.id === updated.id ? updated : row)) }
                : current,
        );
    }

    async function toggleStatus(row: AdminAccount) {
        const disabling = row.status === 'ACTIVE';
        const confirmed = await confirm({
            title: disabling ? t('admins.list.deactivateTitle') : t('admins.list.activateTitle'),
            description: disabling
                ? t('admins.list.deactivateConfirm', { name: row.name })
                : t('admins.list.activateConfirm', { name: row.name }),
            confirmLabel: disabling ? t('admins.list.deactivateButton') : t('admins.list.activateButton'),
            tone: disabling ? 'danger' : 'primary',
        });
        if (!confirmed) return;

        setPendingId(row.id);
        try {
            const updated = await api<AdminAccount>(`/admin-accounts/${row.id}/${disabling ? 'disable' : 'enable'}`, {
                method: 'POST',
            });
            updateRow(updated);
            notify({
                tone: 'success',
                title: t(disabling ? 'admins.list.feedback.deactivated' : 'admins.list.feedback.reactivated', {
                    name: row.name,
                }),
            });
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('admins.list.actionError'),
            });
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
        setResetTarget(undefined);
        notify({ tone: 'success', title: t('admins.feedback.passwordReset', { name: updated.name }) });
    }

    const columns: DataTableColumn<AdminAccount>[] = [
        {
            key: 'name',
            header: t('admins.list.columns.name'),
            cell: (row) => (
                <span className="font-semibold text-ink dark:text-night-text">
                    {row.name}
                    {row.id === admin?.id && (
                        <span className="ml-2 text-xs font-normal text-muted dark:text-night-subtle">
                            {t('common.you')}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'email',
            header: t('admins.list.columns.email'),
            cell: (row) => <span className="text-muted dark:text-night-muted">{row.email}</span>,
        },
        {
            key: 'status',
            header: t('admins.list.columns.status'),
            cell: (row) => (
                <StatusPill tone={adminAccountStatusTone(row.status)}>{adminAccountStatusLabel(row.status)}</StatusPill>
            ),
        },
        {
            key: 'createdAt',
            header: t('admins.list.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (row) => <span className="text-muted dark:text-night-muted">{formatDate(row.createdAt)}</span>,
        },
        {
            key: 'actions',
            header: <span className="sr-only">{t('admins.list.columns.actions')}</span>,
            align: 'right',
            card: 'full',
            cell: (row) => (
                <span className="flex justify-end gap-2">
                    <Button onClick={() => setResetTarget(row)} size="small" variant="secondary">
                        {t('admins.list.resetPasswordButton')}
                    </Button>
                    <Button
                        disabled={row.id === admin?.id}
                        loading={pendingId === row.id}
                        onClick={() => toggleStatus(row)}
                        size="small"
                        variant={row.status === 'ACTIVE' ? 'dangerGhost' : 'primary'}
                    >
                        {row.status === 'ACTIVE' ? t('admins.list.deactivateButton') : t('admins.list.activateButton')}
                    </Button>
                </span>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('admins.list.description')}
                kicker={t('admins.list.kicker')}
                title={t('admins.list.title')}
                actions={
                    <Button
                        leadingIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setCreating(true)}
                    >
                        {t('admins.create.newButton')}
                    </Button>
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <DataTable
                    caption={t('admins.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('admins.list.loading')}
                    minWidth="48rem"
                    rowKey={(row) => row.id}
                    rows={result?.data ?? []}
                    empty={<EmptyState icon={ShieldCheck} title={t('admins.list.empty')} />}
                />
            </SectionCard>

            <CreateAdminAccountDialog
                onClose={() => setCreating(false)}
                open={creating}
                onCreated={(created) => {
                    setResult((current) =>
                        current ? { ...current, data: [created, ...current.data], total: current.total + 1 } : current,
                    );
                    setCreating(false);
                    notify({ tone: 'success', title: t('admins.create.createdToast', { name: created.name }) });
                }}
            />

            <ResetAdminAccountPasswordDialog
                adminName={resetTarget?.name}
                onCancel={() => setResetTarget(undefined)}
                onConfirm={handleResetPassword}
                open={Boolean(resetTarget)}
            />
        </div>
    );
}
