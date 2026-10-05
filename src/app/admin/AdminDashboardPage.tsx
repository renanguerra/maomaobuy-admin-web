'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleAlert, CircleCheck } from 'lucide-react';
import { AgeBadge, useFormatAge } from '@/components/admin/AgeBadge';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { Skeleton } from '@/components/admin/Skeleton';
import { orderStatusTone, packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { queueStage, usePendingCounts } from '@/services/admin/pending-counts';
import { STAGE_LINKS, TEAM_ORDER_STATUSES, TEAM_PACKAGE_STATUSES } from '@/services/admin/work-queues';
import { api } from '@/services/api';
import type { AdminOrder, AdminPackage, Page, WorkQueueStage, WorkQueueStageKey } from '@/types/api';
import { orderStatusLabel, packageStatusLabel } from '@/types/api';

const PREVIEW_LIMIT = 6;

/** Ordem dos cartões: a ordem em que a operação percorre o fluxo. */
const TEAM_STAGES: readonly WorkQueueStageKey[] = [
    'ordersToReview',
    'ordersToPurchase',
    'ordersWithSeller',
    'ordersInboundToWarehouse',
    'ordersToInspect',
    'inspectionsAwaitingAdmin',
    'packagesDraft',
    'packagesToReview',
    'packagesToQuote',
    'packagesToDispatch',
    'packagesInTransit',
    'packagesException',
    'ordersRefundToConfirm',
    'productRequestsNew',
    'refundRequests',
];

/** Filas raras: só aparecem quando têm alguma coisa. */
const HIDDEN_WHEN_EMPTY: ReadonlySet<WorkQueueStageKey> = new Set([
    'packagesDraft',
    'packagesException',
    'ordersRefundToConfirm',
    'refundRequests',
]);

const CUSTOMER_STAGES: readonly WorkQueueStageKey[] = [
    'ordersAwaitingCustomerApproval',
    'ordersAwaitingPayment',
    'inspectionsAwaitingCustomer',
    'ordersUnpacked',
    'packagesAwaitingFreightPayment',
];

interface Previews {
    orders: AdminOrder[];
    packages: AdminPackage[];
}

/**
 * Primeira tela do painel: tudo que depende do time, com prazo por etapa.
 * Duas faixas — o que é nosso (inclusive o que está com vendedor ou
 * transportadora há tempo demais) e o que espera o cliente — e embaixo os
 * pedidos e pacotes mais parados, para abrir direto.
 */
export function AdminDashboardPage() {
    const { t } = useTranslation();
    const { queue, error: queueError, loading: queueLoading, refresh } = usePendingCounts();
    const [previews, setPreviews] = useState<Previews>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        let active = true;
        const orderQuery = new URLSearchParams({
            status: TEAM_ORDER_STATUSES.join(','),
            sort: 'oldest',
            limit: String(PREVIEW_LIMIT),
        });
        const packageQuery = new URLSearchParams({
            status: TEAM_PACKAGE_STATUSES.join(','),
            sort: 'oldest',
            limit: String(PREVIEW_LIMIT),
        });

        Promise.all([
            api<Page<AdminOrder>>(`/orders?${orderQuery.toString()}`),
            api<Page<AdminPackage>>(`/packages?${packageQuery.toString()}`),
        ])
            .then(([orders, packages]) => {
                if (active) setPreviews({ orders: orders.data, packages: packages.data });
            })
            .catch(() => {
                if (active) setError(t('dashboard.error'));
            });

        return () => {
            active = false;
        };
    }, [t]);

    const overdueTotal = queue
        ? queue.stages.filter((stage) => stage.owner !== 'CUSTOMER').reduce((sum, stage) => sum + stage.overdue, 0)
        : 0;
    const loadingPreviews = !previews && !error;

    return (
        <div className="grid gap-7">
            <PageHeader
                description={t('dashboard.description')}
                kicker={t('dashboard.kicker')}
                title={t('dashboard.title')}
                actions={queue && !queueError && <OverdueSummary count={overdueTotal} />}
            />

            {error && (
                <Alert tone="danger" title={t('dashboard.errorTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {queueError && (
                <Alert
                    tone="danger"
                    title={t('dashboard.queueErrorTitle')}
                    action={
                        <Button size="small" variant="secondary" onClick={() => void refresh()} disabled={queueLoading}>
                            {t('common.actions.retry')}
                        </Button>
                    }
                >
                    <p>{t(queue ? 'dashboard.queueStale' : 'dashboard.queueError')}</p>
                </Alert>
            )}
            {(queue || !queueError) && (
                <>
                    <Lane hint={t('dashboard.lanes.teamHint')} title={t('dashboard.lanes.team')}>
                        {TEAM_STAGES.map((key) => {
                            const stage = queueStage(queue, key);
                            if (queue && HIDDEN_WHEN_EMPTY.has(key) && stage.count === 0) return null;
                            return <QueueTile key={key} loading={!queue} stage={stage} />;
                        })}
                    </Lane>

                    <Lane hint={t('dashboard.lanes.waitingHint')} title={t('dashboard.lanes.waiting')} muted>
                        {CUSTOMER_STAGES.map((key) => (
                            <QueueTile key={key} loading={!queue} stage={queueStage(queue, key)} />
                        ))}
                    </Lane>
                </>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
                <SectionCard
                    description={t('dashboard.previews.ordersDescription')}
                    flush
                    title={t('dashboard.previews.ordersTitle')}
                    action={
                        <ButtonLink
                            href={`/admin/pedidos?status=${TEAM_ORDER_STATUSES.join(',')}`}
                            size="small"
                            variant="secondary"
                        >
                            {t('dashboard.previews.viewAll')}
                        </ButtonLink>
                    }
                >
                    <PreviewList
                        emptyTitle={t('dashboard.previews.ordersEmpty')}
                        loading={loadingPreviews}
                        loadingLabel={t('dashboard.loading')}
                        rows={(previews?.orders ?? []).map((order) => ({
                            id: order.id,
                            href: `/admin/pedidos/${order.id}`,
                            title: orderTitle(order),
                            meta: `#${order.id.slice(0, 8)} · ${order.userName}`,
                            since: order.stageSince,
                            deadlineAt: order.stageDeadlineAt,
                            pill: (
                                <StatusPill tone={orderStatusTone(order.status)}>
                                    {orderStatusLabel(order.status)}
                                </StatusPill>
                            ),
                        }))}
                    />
                </SectionCard>

                <SectionCard
                    description={t('dashboard.previews.packagesDescription')}
                    flush
                    title={t('dashboard.previews.packagesTitle')}
                    action={
                        <ButtonLink
                            href={`/admin/pacotes?status=${TEAM_PACKAGE_STATUSES.join(',')}`}
                            size="small"
                            variant="secondary"
                        >
                            {t('dashboard.previews.viewAll')}
                        </ButtonLink>
                    }
                >
                    <PreviewList
                        emptyTitle={t('dashboard.previews.packagesEmpty')}
                        loading={loadingPreviews}
                        loadingLabel={t('dashboard.loading')}
                        rows={(previews?.packages ?? []).map((pkg) => ({
                            id: pkg.id,
                            href: `/admin/pacotes/${pkg.id}`,
                            title: pkg.packageCode,
                            meta: `${pkg.userName} · ${t('dashboard.previews.itemCount', { count: pkg.items.length })}`,
                            since: pkg.stageSince,
                            deadlineAt: pkg.stageDeadlineAt,
                            pill: (
                                <StatusPill tone={packageStatusTone(pkg.status)}>
                                    {packageStatusLabel(pkg.status)}
                                </StatusPill>
                            ),
                        }))}
                    />
                </SectionCard>
            </div>
        </div>
    );
}

function orderTitle(order: AdminOrder): string {
    const [first, ...rest] = order.items;
    if (!first) return `#${order.id.slice(0, 8)}`;
    return rest.length > 0 ? `${first.productName} +${rest.length}` : first.productName;
}

function OverdueSummary({ count }: { count: number }) {
    const { t } = useTranslation();
    if (count === 0) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-50 px-3 py-1.5 text-sm font-semibold text-jade-700 dark:bg-night-success-surface dark:text-night-success">
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
                {t('dashboard.allOnTime')}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-origin-50 px-3 py-1.5 text-sm font-semibold text-origin-700 dark:bg-night-coral-surface dark:text-night-coral">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            {t('dashboard.overdueSummary', { count })}
        </span>
    );
}

function Lane({
    title,
    hint,
    muted = false,
    children,
}: {
    title: string;
    hint: string;
    muted?: boolean;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-3" aria-label={title}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                    className={`m-0 text-xs font-bold tracking-[.08em] uppercase ${
                        muted ? 'text-muted dark:text-night-subtle' : 'text-ink dark:text-night-text'
                    }`}
                >
                    {title}
                </h2>
                <p className="m-0 text-xs text-muted dark:text-night-muted">{hint}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{children}</div>
        </section>
    );
}

/**
 * Cartão de uma fila. Fila nossa mostra quantos há e o mais antigo; fila com
 * terceiro (vendedor, transportadora) mostra só os atrasados, porque o resto
 * não pede nada da gente; fila do cliente fica tracejada e sem alarme, exceto
 * o armazém, onde o atraso vira cobrança de armazenagem.
 */
function QueueTile({ stage, loading }: { stage: WorkQueueStage; loading: boolean }) {
    const { t } = useTranslation();
    const formatAge = useFormatAge();
    const external = stage.owner === 'EXTERNAL';
    const customer = stage.owner === 'CUSTOMER';
    const value = external ? stage.overdue : stage.count;
    const late = stage.overdue > 0;
    const empty = value === 0;
    const oldestAge = stage.oldestSince ? formatAge(stage.oldestSince) : '';

    let hint: string;
    if (stage.count === 0) hint = t('dashboard.hints.empty');
    else if (external)
        hint = late
            ? t('dashboard.hints.externalOverdue', { count: stage.count, age: oldestAge })
            : t('dashboard.hints.externalOnTime', { count: stage.count });
    else if (stage.key === 'ordersUnpacked' && late)
        hint = t('dashboard.hints.unpackedOverdue', { count: stage.overdue });
    else if (late && !customer) hint = t('dashboard.hints.overdue', { count: stage.overdue, age: oldestAge });
    else hint = t('dashboard.hints.oldest', { age: oldestAge });

    const frame = late
        ? 'border-origin-300 shadow-[inset_3px_0_0_var(--color-origin-500)] dark:border-night-coral/50'
        : customer
          ? 'border-dashed bg-transparent dark:bg-transparent'
          : '';

    return (
        <Link
            className={`mm-card group grid content-start gap-1 p-3.5 text-inherit no-underline transition hover:border-brand-300 dark:hover:border-night-accent/40 ${frame}`}
            href={STAGE_LINKS[stage.key]}
        >
            <span className="flex items-start justify-between gap-2">
                <span className="text-sm leading-snug font-semibold text-ink dark:text-night-text">
                    {t(`dashboard.stages.${stage.key}`)}
                </span>
                <ArrowUpRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm-400 transition group-hover:text-primary dark:text-night-subtle dark:group-hover:text-night-accent"
                    aria-hidden="true"
                />
            </span>
            {loading ? (
                <Skeleton className="mt-1 h-7 w-10" />
            ) : (
                <span
                    className={`mm-data text-2xl leading-tight font-bold ${
                        late
                            ? 'text-origin-700 dark:text-night-coral'
                            : empty
                              ? 'text-warm-400 dark:text-night-subtle'
                              : 'text-ink dark:text-night-text'
                    }`}
                >
                    {value}
                </span>
            )}
            {!loading && (
                <span
                    className={`text-xs ${
                        late
                            ? 'font-semibold text-origin-700 dark:text-night-coral'
                            : 'text-muted dark:text-night-muted'
                    }`}
                >
                    {hint}
                </span>
            )}
        </Link>
    );
}

interface PreviewRow {
    id: string;
    href: string;
    title: string;
    meta: string;
    since: string;
    deadlineAt: string | null;
    pill: ReactNode;
}

function PreviewList({
    rows,
    loading,
    loadingLabel,
    emptyTitle,
}: {
    rows: PreviewRow[];
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
                        className="flex items-center gap-3 px-5 py-3 no-underline transition hover:bg-warm-100 dark:hover:bg-night-raised/60"
                        href={row.href}
                    >
                        <AgeBadge deadlineAt={row.deadlineAt} since={row.since} />
                        <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm text-ink dark:text-night-text">
                                {row.title}
                            </strong>
                            <span className="mm-data mt-0.5 block truncate text-xs text-muted dark:text-night-muted">
                                {row.meta}
                            </span>
                        </span>
                        <span className="hidden sm:inline-flex">{row.pill}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
