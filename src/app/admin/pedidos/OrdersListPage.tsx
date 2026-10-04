'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import {
    ORDER_STATUSES,
    formatDate,
    money,
    orderStatusLabel,
    totalUnits,
    type AdminOrder,
    type Page,
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

    const status = searchParams.get('status') ?? '';
    // Cancelados ficam de fora por padrão; um filtro de status manda mais.
    const showCancelled = searchParams.get('cancelados') === '1';
    const filtered = status !== '' || showCancelled;
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    // A consulta em andamento é identificada por página + status: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const queryKey = `${pageNumber}|${status}|${showCancelled}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${status}|${showCancelled}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (status) query.set('status', status);
        else if (!showCancelled) query.set('hideCancelled', 'true');

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
    }, [pageNumber, status, showCancelled, t]);

    // O filtro vive na URL: o link do painel inicial já chega filtrado e o
    // admin pode compartilhar a mesma visão com um colega.
    const applyFilters = useCallback(
        (next: { status: string; showCancelled: boolean }) => {
            setPageNumber(1);
            const query = new URLSearchParams();
            if (next.status) query.set('status', next.status);
            if (next.showCancelled) query.set('cancelados', '1');
            const search = query.toString();
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    const clearFilters = useCallback(() => applyFilters({ status: '', showCancelled: false }), [applyFilters]);

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
                    <Select
                        fieldClassName="w-full max-w-xs"
                        label={t('orders.list.statusLabel')}
                        onChange={(event) => applyFilters({ status: event.target.value, showCancelled })}
                        placeholderOption={t('orders.list.statusAll')}
                        value={status}
                        options={ORDER_STATUSES.map((value) => ({ value, label: orderStatusLabel(value) }))}
                    />
                    <Checkbox
                        checked={showCancelled || status === 'CANCELLED'}
                        className="pb-2.5"
                        disabled={status !== ''}
                        label={t('orders.list.showCancelled')}
                        onChange={(event) => applyFilters({ status, showCancelled: event.target.checked })}
                    />
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
