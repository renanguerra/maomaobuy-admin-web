'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Wallet, XCircle } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { refundStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import { api, ApiError } from '@/services/api';
import { formatDate, money, refundStatusLabel, type AdminRefundRequest } from '@/types/api';

type RefundFilter = 'requested' | 'all';
type DialogState = { kind: 'approve' | 'reject'; refundId: string } | null;

export function FinancePage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [refunds, setRefunds] = useState<AdminRefundRequest[]>();
    const [filter, setFilter] = useState<RefundFilter>('requested');
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogState>(null);

    const load = useCallback(() => {
        api<AdminRefundRequest[]>('/finance/refunds')
            .then((list) => {
                setRefunds(list);
                setError(undefined);
            })
            .catch(() => setError(t('finance.error')));
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleRefundConfirm(values: { totpCode: string; reason: string }) {
        if (!dialog) return;

        const action = dialog.kind === 'approve' ? 'approve' : 'reject';
        try {
            await api(`/finance/refunds/${dialog.refundId}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setDialog(null);
            notify({
                tone: 'success',
                title: action === 'approve' ? t('finance.feedback.approved') : t('finance.feedback.rejected'),
            });
            load();
            void refreshPendingCounts();
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('finance.actionError'));
        }
    }

    const requestedCount = refunds?.filter((refund) => refund.status === 'REQUESTED').length ?? 0;
    const rows = useMemo(
        () =>
            filter === 'requested'
                ? (refunds ?? []).filter((refund) => refund.status === 'REQUESTED')
                : (refunds ?? []),
        [filter, refunds],
    );

    const columns: DataTableColumn<AdminRefundRequest>[] = [
        {
            key: 'amount',
            header: t('finance.columns.amount'),
            numeric: true,
            cell: (refund) => <span className="font-semibold">{money(refund.netAmountMinor, refund.currency)}</span>,
        },
        {
            key: 'user',
            header: t('finance.columns.user'),
            cell: (refund) => (
                <Link
                    className="mm-data text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/usuarios/${refund.userId}`}
                >
                    {refund.userId.slice(0, 8)}
                </Link>
            ),
        },
        {
            key: 'reason',
            header: t('finance.columns.reason'),
            hideBelow: 'md',
            cell: (refund) => <span className="text-muted dark:text-night-muted">{refund.reason}</span>,
        },
        {
            key: 'status',
            header: t('finance.columns.status'),
            cell: (refund) => (
                <StatusPill tone={refundStatusTone(refund.status)}>{refundStatusLabel(refund.status)}</StatusPill>
            ),
        },
        {
            key: 'createdAt',
            header: t('finance.columns.createdAt'),
            hideBelow: 'lg',
            numeric: true,
            cell: (refund) => <span className="text-muted dark:text-night-muted">{formatDate(refund.createdAt)}</span>,
        },
        {
            key: 'actions',
            header: <span className="sr-only">{t('finance.columns.actions')}</span>,
            align: 'right',
            card: 'full',
            cell: (refund) =>
                refund.status === 'REQUESTED' ? (
                    <span className="flex justify-end gap-2">
                        <Button
                            leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog({ kind: 'approve', refundId: refund.id })}
                            size="small"
                        >
                            {t('finance.approveButton')}
                        </Button>
                        <Button
                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog({ kind: 'reject', refundId: refund.id })}
                            size="small"
                            variant="danger"
                        >
                            {t('finance.rejectButton')}
                        </Button>
                    </span>
                ) : (
                    <span className="text-muted dark:text-night-subtle">{t('common.dash')}</span>
                ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('finance.description')}
                kicker={t('finance.kicker')}
                title={t('finance.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard description={t('finance.sectionDescription')} flush title={t('finance.sectionTitle')}>
                <Toolbar>
                    <FilterTabs
                        label={t('finance.filterLabel')}
                        onChange={setFilter}
                        value={filter}
                        options={[
                            { value: 'requested', label: t('finance.filters.requested'), count: requestedCount },
                            { value: 'all', label: t('finance.filters.all'), count: refunds?.length },
                        ]}
                    />
                </Toolbar>

                <DataTable
                    caption={t('finance.tableCaption')}
                    columns={columns}
                    loading={!refunds && !error}
                    loadingLabel={t('finance.loading')}
                    minWidth="52rem"
                    rowKey={(refund) => refund.id}
                    rows={rows}
                    empty={
                        <EmptyState
                            description={t('finance.emptyDescription')}
                            icon={Wallet}
                            title={filter === 'requested' ? t('finance.empty') : t('finance.emptyAll')}
                        />
                    }
                />
            </SectionCard>

            <ActionDialog
                confirmLabel={t('finance.dialogs.approve.confirmLabel')}
                description={t('finance.dialogs.approve.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
                open={dialog?.kind === 'approve'}
                title={t('finance.dialogs.approve.title')}
            />
            <ActionDialog
                confirmLabel={t('finance.dialogs.reject.confirmLabel')}
                description={t('finance.dialogs.reject.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
                open={dialog?.kind === 'reject'}
                requireReason
                title={t('finance.dialogs.reject.title')}
                variant="danger"
            />
        </div>
    );
}
