'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, FilterX } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { orderStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { ORDER_STATUSES, formatDate, money, orderStatusLabel, type AdminOrder, type Page } from '@/types/api';

const LIMIT = 20;

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
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    // A consulta em andamento é identificada por página + status: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const queryKey = `${pageNumber}|${status}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${status}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (status) query.set('status', status);

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
    }, [pageNumber, status, t]);

    // O filtro vive na URL: o link do painel inicial já chega filtrado e o
    // admin pode compartilhar a mesma visão com um colega.
    const applyStatus = useCallback(
        (next: string) => {
            setPageNumber(1);
            router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<AdminOrder>[] = [
        {
            key: 'order',
            header: t('orders.list.columns.order'),
            cell: (order) => (
                <Link
                    className="mm-data font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/pedidos/${order.id}`}
                >
                    #{order.id.slice(0, 8)}
                </Link>
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
            cell: (order) => order.items.length,
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
                        status ? (
                            <Button
                                leadingIcon={<FilterX className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => applyStatus('')}
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
                        onChange={(event) => applyStatus(event.target.value)}
                        placeholderOption={t('orders.list.statusAll')}
                        value={status}
                        options={ORDER_STATUSES.map((value) => ({ value, label: orderStatusLabel(value) }))}
                    />
                </Toolbar>

                <DataTable
                    caption={t('orders.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('orders.list.loading')}
                    minWidth="52rem"
                    rowKey={(order) => order.id}
                    rows={result?.data ?? []}
                    empty={
                        <EmptyState
                            description={status ? t('orders.list.emptyFilteredDescription') : undefined}
                            icon={ClipboardList}
                            title={status ? t('orders.list.emptyFiltered') : t('orders.list.empty')}
                            action={
                                status ? (
                                    <Button onClick={() => applyStatus('')} size="small" variant="secondary">
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
