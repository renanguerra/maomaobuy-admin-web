'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SearchX, Users } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { CustomerTag } from '@/components/admin/CustomerCard';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill, userStatusTone } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { cny, formatDate, userStatusLabel } from '@/types/api';
import {
    CUSTOMER_SEGMENTS,
    CUSTOMER_SORTS,
    type CustomerListItem,
    type CustomerPage,
    type CustomerSegment,
    type CustomerSort,
    type CustomerTagCount,
} from '@/types/customers';

const LIMIT = 20;
const ACCOUNT_TYPES = ['RETAIL', 'WHOLESALE', 'WHOLESALE_APPLICANT'] as const;

type SegmentFilter = 'all' | CustomerSegment;

interface Filters {
    search: string;
    segment: SegmentFilter;
    accountType: string;
    tag: string;
    sort: CustomerSort;
    page: number;
}

const INITIAL: Filters = { search: '', segment: 'all', accountType: '', tag: '', sort: 'newest', page: 1 };

/**
 * Clientes como relacionamento: quanto compraram, quando foi a última vez e o
 * que está parado. Os grupos prontos respondem as perguntas do dia.
 */
export function UsersListPage() {
    const { t } = useTranslation();
    const [filters, setFilters] = useState(INITIAL);
    const [tags, setTags] = useState<CustomerTagCount[]>([]);
    const [loaded, setLoaded] = useState<{ key: string; page: CustomerPage }>();
    const [failure, setFailure] = useState<{ key: string; message: string }>();

    const query = new URLSearchParams({
        page: String(filters.page),
        limit: String(LIMIT),
        sort: filters.sort,
        ...(filters.search && { search: filters.search }),
        ...(filters.segment !== 'all' && { segment: filters.segment }),
        ...(filters.accountType && { accountType: filters.accountType }),
        ...(filters.tag && { tag: filters.tag }),
    }).toString();

    // A consulta em andamento é identificada pelos filtros: enquanto o que
    // está em tela não corresponder a eles, a lista está carregando.
    const result = loaded?.key === query ? loaded.page : undefined;
    const error = failure?.key === query ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        api<CustomerPage>(`/customers?${query}`)
            .then((page) => {
                if (active) setLoaded({ key: query, page });
            })
            .catch(() => {
                if (active) setFailure({ key: query, message: t('users.list.error') });
            });
        return () => {
            active = false;
        };
    }, [query, t]);

    useEffect(() => {
        let active = true;
        api<CustomerTagCount[]>('/customers/tags')
            .then((list) => {
                if (active) setTags(list);
            })
            .catch(() => {
                // Sem as etiquetas some só o filtro por elas.
            });
        return () => {
            active = false;
        };
    }, []);

    // Trocar qualquer filtro volta à primeira página: a paginação antiga não
    // vale mais para o novo conjunto de resultados.
    const change = useCallback((patch: Partial<Filters>) => {
        setFilters((current) => ({ ...current, page: 1, ...patch }));
    }, []);
    const handleSearch = useCallback((search: string) => change({ search }), [change]);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
    // Os números dos grupos continuam na tela enquanto a próxima página carrega.
    const counts = (result ?? loaded?.page)?.segmentCounts;
    const filtered = filters.search || filters.segment !== 'all' || filters.accountType || filters.tag;

    const columns: DataTableColumn<CustomerListItem>[] = [
        {
            key: 'name',
            header: t('users.list.columns.name'),
            cell: (customer) => (
                <div className="min-w-0">
                    <Link
                        className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/usuarios/${customer.id}`}
                    >
                        {customer.name}
                    </Link>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">{customer.email}</span>
                    {customer.tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                            {customer.tags.map((tag) => (
                                <CustomerTag key={tag} label={tag} />
                            ))}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'account',
            header: t('users.list.columns.account'),
            hideBelow: 'md',
            cell: (customer) => (
                <span className="flex flex-wrap gap-1.5">
                    <span className="text-muted dark:text-night-muted">
                        {t(`users.accountTypes.${customer.accountType}`)}
                    </span>
                    {customer.status !== 'ACTIVE' && (
                        <StatusPill tone={userStatusTone(customer.status)}>
                            {userStatusLabel(customer.status)}
                        </StatusPill>
                    )}
                    {customer.excludedFromReports && (
                        <StatusPill hideDot tone="warning">
                            {t('users.detail.internalAccount')}
                        </StatusPill>
                    )}
                </span>
            ),
        },
        {
            key: 'purchases',
            header: t('customers.stats.purchases'),
            numeric: true,
            cell: (customer) => customer.purchases,
        },
        {
            key: 'spent',
            header: t('customers.stats.spent'),
            numeric: true,
            cell: (customer) => <span className="mm-data">{cny(customer.spentAmountMinor)}</span>,
        },
        {
            key: 'lastPurchase',
            header: t('customers.stats.lastPurchase'),
            hideBelow: 'lg',
            numeric: true,
            cell: (customer) => (
                <span className="text-muted dark:text-night-muted">{formatDate(customer.lastPurchaseAt)}</span>
            ),
        },
        {
            key: 'waiting',
            header: t('customers.waiting.title'),
            hideBelow: 'md',
            cell: (customer) => <Waiting customer={customer} />,
        },
        {
            key: 'createdAt',
            header: t('users.list.columns.createdAt'),
            hideBelow: 'lg',
            numeric: true,
            card: 'hide',
            cell: (customer) => (
                <span className="text-muted dark:text-night-muted">{formatDate(customer.createdAt)}</span>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader description={t('users.list.description')} title={t('users.list.title')} />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <FilterTabs<SegmentFilter>
                label={t('customers.segments.label')}
                onChange={(segment) => change({ segment })}
                options={[
                    { value: 'all', label: t('customers.segments.all') },
                    ...CUSTOMER_SEGMENTS.map((segment) => ({
                        value: segment,
                        label: t(`customers.segments.${segment}`),
                        count: counts?.[segment],
                    })),
                ]}
                value={filters.segment}
            />

            <SectionCard flush>
                <Toolbar>
                    <SearchInput
                        className="w-full max-w-sm"
                        clearLabel={t('common.actions.clearSearch')}
                        label={t('users.list.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('users.list.searchPlaceholder')}
                        value={filters.search}
                    />
                    <Select
                        fieldClassName="max-sm:min-w-36 max-sm:flex-1"
                        hideLabel
                        label={t('customers.filters.accountType')}
                        onChange={(event) => change({ accountType: event.target.value })}
                        options={[
                            { value: '', label: t('customers.filters.allAccountTypes') },
                            ...ACCOUNT_TYPES.map((type) => ({ value: type, label: t(`users.accountTypes.${type}`) })),
                        ]}
                        value={filters.accountType}
                    />
                    {tags.length > 0 && (
                        <Select
                            fieldClassName="max-sm:min-w-36 max-sm:flex-1"
                            hideLabel
                            label={t('customers.filters.tag')}
                            onChange={(event) => change({ tag: event.target.value })}
                            options={[
                                { value: '', label: t('customers.filters.allTags') },
                                ...tags.map((tag) => ({ value: tag.label, label: `${tag.label} (${tag.customers})` })),
                            ]}
                            value={filters.tag}
                        />
                    )}
                    <Select
                        fieldClassName="max-sm:min-w-36 max-sm:flex-1"
                        hideLabel
                        label={t('customers.filters.sort')}
                        onChange={(event) => change({ sort: event.target.value as CustomerSort })}
                        options={CUSTOMER_SORTS.map((sort) => ({ value: sort, label: t(`customers.sorts.${sort}`) }))}
                        value={filters.sort}
                    />
                </Toolbar>

                <DataTable
                    caption={t('users.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('users.list.loading')}
                    minWidth="52rem"
                    rowKey={(customer) => customer.id}
                    rows={result?.data ?? []}
                    empty={
                        filtered ? (
                            <EmptyState
                                description={t('customers.emptyFilteredDescription')}
                                icon={SearchX}
                                title={t('users.list.emptySearch')}
                            />
                        ) : (
                            <EmptyState icon={Users} title={t('users.list.empty')} />
                        )
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={(page) => change({ page })}
                        page={filters.page}
                        previousLabel={t('common.pagination.previous')}
                        disabled={loading}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: filters.page, total: totalPages })} · ${t('users.list.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}

/** O que está parado com o cliente, em palavras. */
function Waiting({ customer }: { customer: CustomerListItem }) {
    const { t } = useTranslation();
    if (customer.unpackedUnits === 0 && customer.freightUnpaid === 0)
        return <span className="text-muted dark:text-night-subtle">{t('common.dash')}</span>;
    return (
        <span className="grid gap-0.5 text-xs font-semibold text-amber-700 dark:text-night-warning">
            {customer.unpackedUnits > 0 && (
                <span>{t('customers.waiting.unpacked', { count: customer.unpackedUnits })}</span>
            )}
            {customer.freightUnpaid > 0 && (
                <span>{t('customers.waiting.freight', { count: customer.freightUnpaid })}</span>
            )}
        </span>
    );
}
