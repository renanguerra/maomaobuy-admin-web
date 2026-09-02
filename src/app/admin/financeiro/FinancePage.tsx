'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Banknote, CheckCircle2, HandCoins, Wallet, XCircle } from 'lucide-react';
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
import { brl, formatDate, money, refundNeedsAction, refundStatusLabel, type AdminRefundRequest } from '@/types/api';

type RefundFilter = 'requested' | 'all';
type RefundAction = 'approve' | 'reject' | 'execute' | 'settle-manually';
type DialogState = { kind: RefundAction; refundId: string } | null;

/**
 * Depois de aprovado, o reembolso fica esperando o dinheiro voltar. São dois
 * caminhos e o painel precisa dos dois: `execute` manda o provedor estornar a
 * cobrança de origem; `settle-manually` fecha o que o provedor não cobre —
 * estorno parcial, falha dele, ou o Pix feito na mão.
 *
 * As listas não são iguais de propósito. `PROCESSING` só aceita baixa manual:
 * é o estado que consegue ficar órfão se o processo morrer no meio da chamada
 * ao provedor, e mandar executar de novo por cima disso arriscaria devolver
 * duas vezes.
 */
const EXECUTABLE_STATUSES = ['AWAITING_PROVIDER', 'FAILED'];
const SETTLEABLE_STATUSES = ['AWAITING_PROVIDER', 'FAILED', 'PROCESSING'];

const FEEDBACK_KEY = {
    approve: 'finance.feedback.approved',
    reject: 'finance.feedback.rejected',
    execute: 'finance.feedback.executed',
    'settle-manually': 'finance.feedback.settled',
} as const satisfies Record<RefundAction, string>;

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

        const action = dialog.kind;
        try {
            await api(`/finance/refunds/${dialog.refundId}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setDialog(null);
            notify({ tone: 'success', title: t(FEEDBACK_KEY[action]) });
            load();
            void refreshPendingCounts();
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('finance.actionError'));
        }
    }

    const requestedCount = refunds?.filter((refund) => refundNeedsAction(refund.status)).length ?? 0;
    const rows = useMemo(
        () =>
            filter === 'requested'
                ? (refunds ?? []).filter((refund) => refundNeedsAction(refund.status))
                : (refunds ?? []),
        [filter, refunds],
    );

    const columns: DataTableColumn<AdminRefundRequest>[] = [
        {
            // As duas moedas juntas de propósito: o que sai do saldo do cliente
            // é yuan, o que o provedor estorna é real, e é o segundo que
            // precisa bater com a cobrança original para a devolução
            // automática ser aceita.
            key: 'amount',
            header: t('finance.columns.amount'),
            numeric: true,
            cell: (refund) => (
                <span className="grid justify-items-end gap-0.5">
                    <span className="font-semibold">{money(refund.netAmountMinor, refund.currency)}</span>
                    <span className="text-xs text-muted dark:text-night-subtle">
                        {t('finance.payoutHint', { amount: brl(refund.payoutAmountMinor) })}
                    </span>
                </span>
            ),
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
            cell: (refund) => {
                if (refund.status === 'REQUESTED')
                    return (
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
                    );

                if (SETTLEABLE_STATUSES.includes(refund.status))
                    return (
                        <span className="flex justify-end gap-2">
                            {EXECUTABLE_STATUSES.includes(refund.status) && (
                                <Button
                                    leadingIcon={<Banknote className="h-4 w-4" aria-hidden="true" />}
                                    onClick={() => setDialog({ kind: 'execute', refundId: refund.id })}
                                    size="small"
                                >
                                    {t('finance.executeButton')}
                                </Button>
                            )}
                            <Button
                                leadingIcon={<HandCoins className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog({ kind: 'settle-manually', refundId: refund.id })}
                                size="small"
                                variant="secondary"
                            >
                                {t('finance.settleButton')}
                            </Button>
                        </span>
                    );

                return <span className="text-muted dark:text-night-subtle">{t('common.dash')}</span>;
            },
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
            <ActionDialog
                confirmLabel={t('finance.dialogs.execute.confirmLabel')}
                description={t('finance.dialogs.execute.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
                open={dialog?.kind === 'execute'}
                title={t('finance.dialogs.execute.title')}
            />
            <ActionDialog
                confirmLabel={t('finance.dialogs.settle.confirmLabel')}
                description={t('finance.dialogs.settle.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
                open={dialog?.kind === 'settle-manually'}
                requireReason
                title={t('finance.dialogs.settle.title')}
            />
        </div>
    );
}
