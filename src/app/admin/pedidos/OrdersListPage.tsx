'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, ClipboardPlus, FilterX } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { orderStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { AgeBadge } from '@/components/admin/AgeBadge';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { queueStage, usePendingCounts } from '@/services/admin/pending-counts';
import { ORDER_QUEUE_TABS, isQueueTab, type OrderQueueTab } from '@/services/admin/work-queues';
import { api } from '@/services/api';
import {
    ORDER_STATUSES,
    formatDate,
    money,
    orderStatusLabel,
    totalUnits,
    type AdminOrder,
    type Page,
    type WorkQueueStageKey,
} from '@/types/api';

const LIMIT = 20;

/**
 * O pedido não tem título próprio: o que identifica ele para quem olha a fila
 * é o produto. Com mais de um item, o primeiro dá nome e o resto vira contagem.
 */
function orderTitle(order: AdminOrder): string {
    const [first, ...rest] = order.items;
    if (!first) return '—';
    return rest.length > 0 ? `${first.productName} +${rest.length}` : first.productName;
}

interface LoadedPage {
    /** Identifica a consulta que produziu estes dados (página + status). */
    key: string;
    page: Page<AdminOrder>;
}

interface Failure {
    key: string;
    message: string;
}

export function OrdersListPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Tudo que filtra vive na URL: o cartão do painel já chega filtrado e o
    // admin pode mandar a mesma visão para um colega.
    const fila = searchParams.get('fila');
    const tab: OrderQueueTab = isQueueTab(ORDER_QUEUE_TABS, fila) ? fila : 'all';
    // `status` aceita vários, separados por vírgula ("Ver fila" do painel).
    const status = searchParams.get('status') ?? '';
    const search = searchParams.get('busca') ?? '';
    // Cancelados ficam de fora por padrão; um filtro de status manda mais.
    const showCancelled = searchParams.get('cancelados') === '1';
    const statuses = status ? status.split(',') : [...ORDER_QUEUE_TABS[tab].statuses];
    // Fila de trabalho lista o mais parado primeiro; "Todos" é arquivo.
    const sort = tab !== 'all' || status.includes(',') ? 'oldest' : 'newest';
    const filtered = tab !== 'all' || status !== '' || search !== '' || showCancelled;
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const { queue } = usePendingCounts();

    // A consulta em andamento é identificada pelos filtros: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const statusParam = statuses.join(',');
    const queryKey = `${pageNumber}|${statusParam}|${search}|${sort}|${showCancelled}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = queryKey;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT), sort });
        if (statusParam) query.set('status', statusParam);
        else if (!showCancelled) query.set('hideCancelled', 'true');
        if (search.length >= 2) query.set('search', search);

        api<Page<AdminOrder>>(`/orders?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('orders.list.error') });
            });

        return () => {
            active = false;
        };
    }, [queryKey, pageNumber, statusParam, search, sort, showCancelled, t]);

    function applyFilters(next: { tab?: OrderQueueTab; status?: string; search?: string; showCancelled?: boolean }) {
        setPageNumber(1);
        const query = new URLSearchParams();
        if (next.tab && next.tab !== 'all') query.set('fila', next.tab);
        if (next.status) query.set('status', next.status);
        if (next.search) query.set('busca', next.search);
        if (next.showCancelled) query.set('cancelados', '1');
        const queryString = query.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }

    const clearFilters = () => applyFilters({});

    const tabOptions = (Object.keys(ORDER_QUEUE_TABS) as OrderQueueTab[]).map((value) => {
        const tabDef: { statuses: readonly string[]; counts?: readonly WorkQueueStageKey[] } = ORDER_QUEUE_TABS[value];
        return {
            value,
            label: t(`orders.list.tabs.${value}`),
            count:
                queue && tabDef.counts
                    ? tabDef.counts.reduce((sum, key) => sum + queueStage(queue, key).count, 0)
                    : undefined,
        };
    });

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<AdminOrder>[] = [
        {
            key: 'order',
            header: t('orders.list.columns.order'),
            cell: (order) => (
                <span className="block min-w-0">
                    <Link
                        className="block truncate font-semibold text-ink no-underline hover:underline dark:text-night-text"
                        href={`/admin/pedidos/${order.id}`}
                        title={orderTitle(order)}
                    >
                        {orderTitle(order)}
                    </Link>
                    <Link
                        className="mm-data block text-xs text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/pedidos/${order.id}`}
                    >
                        #{order.id.slice(0, 8)}
                    </Link>
                </span>
            ),
        },
        {
            key: 'client',
            header: t('orders.list.columns.client'),
            cell: (order) => (
                <span className="block min-w-0">
                    <Link
                        className="block truncate font-semibold text-ink no-underline hover:underline dark:text-night-text"
                        href={`/admin/usuarios/${order.userId}`}
                    >
                        {order.userName}
                    </Link>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">{order.userEmail}</span>
                </span>
            ),
        },
        {
            key: 'items',
            header: t('orders.list.columns.items'),
            hideBelow: 'lg',
            numeric: true,
            cell: (order) => {
                const units = totalUnits(order.items);
                return (
                    <span className="inline-grid justify-items-end leading-tight">
                        <strong className="mm-data text-sm text-ink dark:text-night-text">{units}</strong>
                        {units !== order.items.length && (
                            <span className="text-xs text-muted dark:text-night-muted">
                                {t('orders.list.linesHint', { count: order.items.length })}
                            </span>
                        )}
                    </span>
                );
            },
        },
        {
            key: 'total',
            header: t('orders.list.columns.total'),
            numeric: true,
            cell: (order) => <span className="font-semibold">{money(order.totalAmountMinor, order.currency)}</span>,
        },
        {
            key: 'status',
            header: t('orders.list.columns.status'),
            cell: (order) => (
                <StatusPill tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>
            ),
        },
        {
            key: 'stage',
            header: t('orders.list.stageColumn'),
            cell: (order) => <AgeBadge deadlineAt={order.stageDeadlineAt} since={order.stageSince} />,
        },
        {
            key: 'createdAt',
            header: t('orders.list.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (order) => <span className="text-muted dark:text-night-muted">{formatDate(order.createdAt)}</span>,
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <ButtonLink
                        href="/admin/pedidos/novo"
                        leadingIcon={<ClipboardPlus className="h-4 w-4" aria-hidden="true" />}
                    >
                        {t('orders.create.newButton')}
                    </ButtonLink>
                }
                description={t('orders.list.description')}
                kicker={t('orders.list.kicker')}
                title={t('orders.list.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar
                    actions={
                        filtered ? (
                            <Button
                                leadingIcon={<FilterX className="h-4 w-4" aria-hidden="true" />}
                                onClick={clearFilters}
                                size="small"
                                variant="ghost"
                            >
                                {t('common.actions.clearFilters')}
                            </Button>
                        ) : undefined
                    }
                >
                    <div className="grid w-full gap-3">
                        <FilterTabs
                            label={t('orders.list.tabsLabel')}
                            onChange={(value) => applyFilters({ tab: value, search })}
                            options={tabOptions}
                            value={status ? ('custom' as OrderQueueTab) : tab}
                        />
                        <div className="flex flex-wrap items-end gap-3">
                            <SearchInput
                                className="w-full max-w-sm"
                                clearLabel={t('common.actions.clearSearch')}
                                label={t('orders.list.searchLabel')}
                                onChange={(value) => applyFilters({ tab, status, search: value, showCancelled })}
                                placeholder={t('orders.list.searchPlaceholder')}
                                value={search}
                            />
                            <Select
                                fieldClassName="w-full max-w-60"
                                label={t('orders.list.statusLabel')}
                                onChange={(event) =>
                                    applyFilters({ status: event.target.value, search, showCancelled })
                                }
                                placeholderOption={t('orders.list.statusAll')}
                                value={status.includes(',') ? '' : status}
                                options={ORDER_STATUSES.map((value) => ({ value, label: orderStatusLabel(value) }))}
                            />
                            <Checkbox
                                checked={showCancelled || status === 'CANCELLED'}
                                className="pb-2.5"
                                disabled={statuses.length > 0}
                                label={t('orders.list.showCancelled')}
                                onChange={(event) => applyFilters({ tab, search, showCancelled: event.target.checked })}
                            />
                        </div>
                    </div>
                </Toolbar>

                <DataTable
                    caption={t('orders.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('orders.list.loading')}
                    minWidth="60rem"
                    rowKey={(order) => order.id}
                    rows={result?.data ?? []}
                    empty={
                        <EmptyState
                            description={filtered ? t('orders.list.emptyFilteredDescription') : undefined}
                            icon={ClipboardList}
                            title={filtered ? t('orders.list.emptyFiltered') : t('orders.list.empty')}
                            action={
                                filtered ? (
                                    <Button onClick={clearFilters} size="small" variant="secondary">
                                        {t('common.actions.clearFilters')}
                                    </Button>
                                ) : undefined
                            }
                        />
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        disabled={loading}
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('orders.list.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
