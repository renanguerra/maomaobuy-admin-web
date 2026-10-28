'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, Coins, Wallet } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatCard } from '@/components/admin/StatCard';
import { StatusPill, topUpStatusTone } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { SearchInput } from '@/components/ui/SearchInput';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { brl, cny, formatDate, type AdminTopUp, type AdminTopUpsPage, type TopUpStatus } from '@/types/api';

type Filter = TopUpStatus | 'all';

const LIMIT = 25;

/**
 * Histórico de recargas: quem pagou, quanto entrou no saldo e em que deu.
 * Recarga manual (pagamento recebido por fora) aparece com a origem
 * "Manual"; as do Pix e do cartão, com o provedor e o meio.
 */
export function TopUpsPage() {
    const { t } = useTranslation();
    const [result, setResult] = useState<AdminTopUpsPage>();
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();

    const load = useCallback(() => {
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (filter !== 'all') query.set('status', filter);
        if (search.trim().length >= 2) query.set('search', search.trim());

        api<AdminTopUpsPage>(`/finance/top-ups?${query.toString()}`)
            .then((page) => {
                setResult(page);
                setError(undefined);
            })
            .catch(() => setError(t('topUps.error')));
    }, [filter, search, pageNumber, t]);

    useEffect(() => {
        load();
    }, [load]);

    // Dicionário tipado por chave literal: o mapa deixa o compilador conferir.
    const statusLabel = (status: string): string =>
        ({
            AWAITING_PROVIDER: t('topUps.statuses.AWAITING_PROVIDER'),
            PENDING: t('topUps.statuses.PENDING'),
            CONFIRMED: t('topUps.statuses.CONFIRMED'),
            FAILED: t('topUps.statuses.FAILED'),
            EXPIRED: t('topUps.statuses.EXPIRED'),
            PARTIALLY_REFUNDED: t('topUps.statuses.PARTIALLY_REFUNDED'),
            REFUNDED: t('topUps.statuses.REFUNDED'),
            REVERSED: t('topUps.statuses.REVERSED'),
            CANCELLED: t('topUps.statuses.CANCELLED'),
        })[status] ?? status;

    const columns: DataTableColumn<AdminTopUp>[] = [
        {
            key: 'createdAt',
            header: t('topUps.columns.createdAt'),
            cell: (row) => <span className="text-muted dark:text-night-muted">{formatDate(row.createdAt)}</span>,
        },
        {
            key: 'customer',
            header: t('topUps.columns.customer'),
            cell: (row) => (
                <Link
                    className="text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/usuarios/${row.userId}`}
                >
                    {row.userName || row.userId.slice(0, 8)}
                </Link>
            ),
        },
        {
            key: 'status',
            header: t('topUps.columns.status'),
            cell: (row) => (
                <StatusPill tone={topUpStatusTone(row.status)}>
                    {/* Cartão sem resposta do provedor: alguém precisa conferir
                        no painel da AbacatePay se a cobrança passou. */}
                    {row.paymentMethod === 'CARD' && row.status === 'AWAITING_PROVIDER'
                        ? t('topUps.cardUnderReview')
                        : statusLabel(row.status)}
                </StatusPill>
            ),
        },
        {
            key: 'method',
            header: t('topUps.columns.method'),
            hideBelow: 'md',
            cell: (row) => (
                <span className="text-muted dark:text-night-muted">
                    {t(`topUps.methods.${row.paymentMethod}`)}
                    {row.cardLastFour && ` · ${row.cardBrand ?? ''} ${row.cardLastFour}`}
                </span>
            ),
        },
        {
            key: 'amount',
            header: t('topUps.columns.amount'),
            numeric: true,
            cell: (row) => <span className="mm-data text-ink dark:text-night-text">{brl(row.amountMinor)}</span>,
        },
        {
            key: 'credit',
            header: t('topUps.columns.credit'),
            numeric: true,
            cell: (row) => <span className="mm-data text-ink dark:text-night-text">{cny(row.creditAmountMinor)}</span>,
        },
        {
            key: 'rate',
            header: t('topUps.columns.rate'),
            hideBelow: 'lg',
            numeric: true,
            cell: (row) => (
                <span className="mm-data text-muted dark:text-night-muted">
                    {row.effectiveRate ? Number(row.effectiveRate).toFixed(4) : '—'}
                </span>
            ),
        },
        {
            key: 'provider',
            header: t('topUps.columns.provider'),
            hideBelow: 'md',
            cell: (row) => (
                <span className="text-muted dark:text-night-muted">
                    {row.providerName === 'MANUAL' ? t('topUps.manual') : (row.providerName ?? '—')}
                </span>
            ),
        },
        {
            key: 'confirmedAt',
            header: t('topUps.columns.confirmedAt'),
            hideBelow: 'lg',
            cell: (row) => (
                <span className="text-muted dark:text-night-muted">
                    {row.confirmedAt ? formatDate(row.confirmedAt) : '—'}
                </span>
            ),
        },
    ];

    const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / LIMIT));

    return (
        <div className="grid gap-6">
            <PageHeader description={t('topUps.description')} kicker={t('topUps.kicker')} title={t('topUps.title')} />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    icon={ArrowDownToLine}
                    label={t('topUps.kpi.paid')}
                    loading={!result && !error}
                    value={result ? brl(result.confirmedAmountMinor) : '—'}
                />
                <StatCard
                    icon={Coins}
                    label={t('topUps.kpi.credited')}
                    loading={!result && !error}
                    value={result ? cny(result.confirmedCreditMinor) : '—'}
                />
                <StatCard
                    icon={Wallet}
                    label={t('topUps.kpi.count')}
                    loading={!result && !error}
                    value={result ? String(result.total) : '—'}
                />
            </div>

            <SectionCard flush title={t('topUps.sectionTitle')}>
                <Toolbar>
                    <FilterTabs
                        label={t('topUps.filterLabel')}
                        onChange={(value) => {
                            setFilter(value as Filter);
                            setPageNumber(1);
                        }}
                        value={filter}
                        options={[
                            { value: 'all', label: t('topUps.filters.all') },
                            { value: 'CONFIRMED', label: statusLabel('CONFIRMED') },
                            { value: 'PENDING', label: statusLabel('PENDING') },
                            { value: 'AWAITING_PROVIDER', label: t('topUps.cardUnderReview') },
                            { value: 'FAILED', label: statusLabel('FAILED') },
                            { value: 'EXPIRED', label: statusLabel('EXPIRED') },
                            { value: 'CANCELLED', label: statusLabel('CANCELLED') },
                        ]}
                    />
                    <SearchInput
                        className="w-full sm:w-72"
                        clearLabel={t('common.actions.clearSearch')}
                        label={t('topUps.searchLabel')}
                        onChange={(value) => {
                            setSearch(value);
                            setPageNumber(1);
                        }}
                        placeholder={t('topUps.searchPlaceholder')}
                        value={search}
                    />
                </Toolbar>

                <DataTable
                    caption={t('topUps.tableCaption')}
                    columns={columns}
                    loading={!result && !error}
                    loadingLabel={t('topUps.loading')}
                    minWidth="60rem"
                    rowKey={(row) => row.id}
                    rows={result?.data ?? []}
                    empty={
                        <EmptyState
                            description={t('topUps.emptyDescription')}
                            icon={Wallet}
                            title={t('topUps.empty')}
                        />
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('topUps.countUnit', { count: result.total })}`}
                        totalPages={totalPages}
                    />
                )}
            </SectionCard>
        </div>
    );
}
