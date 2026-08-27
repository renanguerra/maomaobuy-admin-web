'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Boxes, ClipboardList, CreditCard, Undo2 } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatCard } from '@/components/admin/StatCard';
import { orderStatusTone, packageStatusTone, refundStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { usePendingCounts } from '@/services/admin/pending-counts';
import { api } from '@/services/api';
import type { AdminOrder, AdminPackage, AdminRefundRequest, Page } from '@/types/api';
import { formatDate, money, orderStatusLabel, packageStatusLabel, refundStatusLabel } from '@/types/api';

const QUEUE_PREVIEW_LIMIT = 5;

interface Queues {
    orders: AdminOrder[];
    packages: AdminPackage[];
    refunds: AdminRefundRequest[];
}

/**
 * Primeira tela do painel: as filas que dependem de uma decisão do admin.
 * Os indicadores no topo levam à listagem já filtrada e as prévias abaixo
 * permitem abrir o registro sem passar pela listagem.
 */
export function AdminDashboardPage() {
    const { t } = useTranslation();
    const { counts } = usePendingCounts();
    const [queues, setQueues] = useState<Queues>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        let active = true;

        Promise.all([
            api<Page<AdminOrder>>(`/orders?status=AWAITING_REVIEW&limit=${QUEUE_PREVIEW_LIMIT}`),
            api<Page<AdminPackage>>(`/packages?status=AWAITING_APPROVAL&limit=${QUEUE_PREVIEW_LIMIT}`),
            api<AdminRefundRequest[]>('/finance/refunds'),
        ])
            .then(([orders, packages, refunds]) => {
                if (!active) return;
                setQueues({
                    orders: orders.data,
                    packages: packages.data,
                    refunds: refunds.filter((refund) => refund.status === 'REQUESTED').slice(0, QUEUE_PREVIEW_LIMIT),
                });
            })
            .catch(() => {
                if (active) setError(t('dashboard.error'));
            });

        return () => {
            active = false;
        };
    }, [t]);

    const loading = !queues && !error;

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('dashboard.description')}
                kicker={t('dashboard.kicker')}
                title={t('dashboard.title')}
            />

            {error && (
                <Alert tone="danger" title={t('dashboard.errorTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    href="/admin/pedidos?status=AWAITING_REVIEW"
                    hint={t('dashboard.stats.ordersAwaitingReviewHint')}
                    icon={ClipboardList}
                    label={t('dashboard.stats.ordersAwaitingReview')}
                    loading={!counts}
                    tone={counts && counts.ordersAwaitingReview > 0 ? 'warning' : 'success'}
                    value={counts?.ordersAwaitingReview ?? 0}
                />
                <StatCard
                    href="/admin/pedidos?status=UNPAID"
                    hint={t('dashboard.stats.ordersAwaitingPaymentHint')}
                    icon={CreditCard}
                    label={t('dashboard.stats.ordersAwaitingPayment')}
                    loading={!counts}
                    tone="brand"
                    value={counts?.ordersAwaitingPayment ?? 0}
                />
                <StatCard
                    href="/admin/pacotes?status=AWAITING_APPROVAL"
                    hint={t('dashboard.stats.packagesAwaitingApprovalHint')}
                    icon={Boxes}
                    label={t('dashboard.stats.packagesAwaitingApproval')}
                    loading={!counts}
                    tone={counts && counts.packagesAwaitingApproval > 0 ? 'warning' : 'success'}
                    value={counts?.packagesAwaitingApproval ?? 0}
                />
                <StatCard
                    href="/admin/financeiro"
                    hint={t('dashboard.stats.refundsPendingHint')}
                    icon={Undo2}
                    label={t('dashboard.stats.refundsPending')}
                    loading={!counts}
                    tone={counts && counts.refundsRequested > 0 ? 'danger' : 'success'}
                    value={counts?.refundsRequested ?? 0}
                />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                <SectionCard
                    description={t('dashboard.queues.ordersDescription')}
                    flush
                    title={t('dashboard.queues.ordersTitle')}
                    action={
                        <ButtonLink href="/admin/pedidos?status=AWAITING_REVIEW" size="small" variant="secondary">
                            {t('dashboard.queues.viewAll')}
                        </ButtonLink>
                    }
                >
                    <QueueList
                        emptyTitle={t('dashboard.queues.ordersEmpty')}
                        loading={loading}
                        loadingLabel={t('dashboard.loading')}
                        rows={(queues?.orders ?? []).map((order) => ({
                            id: order.id,
                            href: `/admin/pedidos/${order.id}`,
                            title: `#${order.id.slice(0, 8)}`,
                            meta: `${order.userName} · ${formatDate(order.createdAt)}`,
                            value: money(order.totalAmountMinor, order.currency),
                            pill: (
                                <StatusPill tone={orderStatusTone(order.status)}>
                                    {orderStatusLabel(order.status)}
                                </StatusPill>
                            ),
                        }))}
                    />
                </SectionCard>

                <SectionCard
                    description={t('dashboard.queues.packagesDescription')}
                    flush
                    title={t('dashboard.queues.packagesTitle')}
                    action={
                        <ButtonLink href="/admin/pacotes?status=AWAITING_APPROVAL" size="small" variant="secondary">
                            {t('dashboard.queues.viewAll')}
                        </ButtonLink>
                    }
                >
                    <QueueList
                        emptyTitle={t('dashboard.queues.packagesEmpty')}
                        loading={loading}
                        loadingLabel={t('dashboard.loading')}
                        rows={(queues?.packages ?? []).map((pkg) => ({
                            id: pkg.id,
                            href: `/admin/pacotes/${pkg.id}`,
                            title: pkg.packageCode,
                            meta: `${pkg.userName} · ${formatDate(pkg.createdAt)}`,
                            value: t('dashboard.queues.itemCount', { count: pkg.items.length }),
                            pill: (
                                <StatusPill tone={packageStatusTone(pkg.status)}>
                                    {packageStatusLabel(pkg.status)}
                                </StatusPill>
                            ),
                        }))}
                    />
                </SectionCard>

                <SectionCard
                    className="xl:col-span-2"
                    description={t('dashboard.queues.refundsDescription')}
                    flush
                    title={t('dashboard.queues.refundsTitle')}
                    action={
                        <ButtonLink href="/admin/financeiro" size="small" variant="secondary">
                            {t('dashboard.queues.viewAll')}
                        </ButtonLink>
                    }
                >
                    <QueueList
                        emptyTitle={t('dashboard.queues.refundsEmpty')}
                        loading={loading}
                        loadingLabel={t('dashboard.loading')}
                        rows={(queues?.refunds ?? []).map((refund) => ({
                            id: refund.id,
                            href: '/admin/financeiro',
                            title: money(refund.netAmountMinor, refund.currency),
                            meta: `${t('finance.userIdPrefix', { id: refund.userId.slice(0, 8) })} · ${formatDate(refund.createdAt)} · ${refund.reason}`,
                            pill: (
                                <StatusPill tone={refundStatusTone(refund.status)}>
                                    {refundStatusLabel(refund.status)}
                                </StatusPill>
                            ),
                        }))}
                    />
                </SectionCard>
            </div>
        </div>
    );
}

interface QueueRow {
    id: string;
    href: string;
    title: string;
    meta: string;
    value?: string;
    pill?: ReactNode;
}

function QueueList({
    rows,
    loading,
    loadingLabel,
    emptyTitle,
}: {
    rows: QueueRow[];
    loading: boolean;
    loadingLabel: string;
    emptyTitle: string;
}) {
    if (loading) {
        return (
            <p className="m-0 px-5 py-8 text-center text-sm text-muted dark:text-night-muted" aria-busy="true">
                {loadingLabel}
            </p>
        );
    }

    if (rows.length === 0) return <EmptyState title={emptyTitle} />;

    return (
        <ul className="m-0 grid list-none gap-0 p-0">
            {rows.map((row) => (
                <li className="border-b border-line last:border-b-0 dark:border-night-line" key={row.id}>
                    <Link
                        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 no-underline transition hover:bg-warm-100 dark:hover:bg-night-raised/60"
                        href={row.href}
                    >
                        <span className="min-w-0 flex-1">
                            <strong className="mm-data block truncate text-sm text-ink dark:text-night-text">
                                {row.title}
                            </strong>
                            <span className="mt-0.5 block truncate text-xs text-muted dark:text-night-muted">
                                {row.meta}
                            </span>
                        </span>
                        {row.pill}
                        {row.value && (
                            <span className="mm-data shrink-0 text-sm font-semibold text-ink dark:text-night-text">
                                {row.value}
                            </span>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
