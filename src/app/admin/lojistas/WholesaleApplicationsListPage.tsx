'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SearchX, Store } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { SearchInput } from '@/components/ui/SearchInput';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import {
    formatCnpj,
    formatDate,
    type Page,
    type WholesaleApplication,
    type WholesaleApplicationStatus,
} from '@/types/api';
import { cnpjLookupTone, wholesaleStatusTone } from './wholesale-format';

const LIMIT = 20;

type StatusFilter = 'all' | WholesaleApplicationStatus;

interface LoadedPage {
    key: string;
    page: Page<WholesaleApplication>;
}

interface Failure {
    key: string;
    message: string;
}

/**
 * Fila de contas de lojista: em análise primeiro, a mais antiga no topo (o
 * backend ordena assim quando o filtro é de fila aberta).
 */
export function WholesaleApplicationsListPage() {
    const { t } = useTranslation();
    // `?busca=<e-mail>` chega da ficha do cliente: todas as solicitações dele.
    const initialSearch = useSearchParams().get('busca') ?? '';
    const [search, setSearch] = useState(initialSearch);
    const [status, setStatus] = useState<StatusFilter>(initialSearch ? 'all' : 'PENDING');
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    const queryKey = `${pageNumber}|${search}|${status}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${search}|${status}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (search) query.set('search', search);
        if (status !== 'all') query.set('status', status);

        api<Page<WholesaleApplication>>(`/wholesale-applications?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch((err) => {
                if (active)
                    setFailure({
                        key,
                        message:
                            err instanceof ApiError && err.status === 403
                                ? t('wholesale.forbidden')
                                : t('wholesale.error'),
                    });
            });

        return () => {
            active = false;
        };
    }, [pageNumber, search, status, t]);

    const handleSearch = useCallback((term: string) => {
        setSearch(term);
        setPageNumber(1);
    }, []);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<WholesaleApplication>[] = [
        {
            key: 'company',
            header: t('wholesale.columns.company'),
            cell: (application) => (
                <Link
                    className="block min-w-0 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/lojistas/${application.id}`}
                >
                    <span className="block truncate font-semibold">
                        {application.tradeName ?? application.legalName}
                    </span>
                    <span className="mm-data block truncate text-xs text-muted dark:text-night-muted">
                        {formatCnpj(application.cnpj)}
                    </span>
                </Link>
            ),
        },
        {
            key: 'account',
            header: t('wholesale.columns.account'),
            hideBelow: 'md',
            cell: (application) => (
                <span className="block min-w-0">
                    <span className="block truncate text-sm">{application.user.name}</span>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">
                        {application.user.email}
                    </span>
                </span>
            ),
        },
        {
            key: 'origin',
            header: t('wholesale.columns.origin'),
            hideBelow: 'lg',
            cell: (application) => <span className="text-sm">{t(`wholesale.origins.${application.origin}`)}</span>,
        },
        {
            key: 'lookup',
            header: t('wholesale.columns.lookup'),
            hideBelow: 'md',
            cell: (application) => (
                <span className="flex flex-wrap gap-1.5">
                    <StatusPill hideDot tone={cnpjLookupTone(application.cnpjLookupStatus)}>
                        {t(`wholesale.lookupStatuses.${application.cnpjLookupStatus ?? 'PENDING'}`)}
                    </StatusPill>
                    {application.influencerStatus && (
                        <StatusPill hideDot tone="warning">
                            {t('wholesale.influencerTag')}
                        </StatusPill>
                    )}
                </span>
            ),
        },
        {
            key: 'submitted',
            header: t('wholesale.columns.submittedAt'),
            numeric: true,
            hideBelow: 'md',
            cell: (application) => <span className="text-sm">{formatDate(application.submittedAt)}</span>,
        },
        {
            key: 'status',
            header: t('wholesale.columns.status'),
            cell: (application) => (
                <StatusPill tone={wholesaleStatusTone(application.status)}>
                    {t(`wholesale.statuses.${application.status}`)}
                </StatusPill>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('wholesale.description')}
                kicker={t('wholesale.kicker')}
                title={t('wholesale.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar>
                    <SearchInput
                        className="w-full max-w-sm"
                        clearLabel={t('common.actions.clearSearch')}
                        label={t('wholesale.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('wholesale.searchPlaceholder')}
                        value={search}
                    />
                    <FilterTabs<StatusFilter>
                        label={t('wholesale.columns.status')}
                        onChange={(value) => {
                            setStatus(value);
                            setPageNumber(1);
                        }}
                        options={[
                            { value: 'PENDING', label: t('wholesale.filters.PENDING') },
                            { value: 'NEEDS_INFO', label: t('wholesale.filters.NEEDS_INFO') },
                            { value: 'APPROVED', label: t('wholesale.filters.APPROVED') },
                            { value: 'REJECTED', label: t('wholesale.filters.REJECTED') },
                            { value: 'REVOKED', label: t('wholesale.filters.REVOKED') },
                            { value: 'all', label: t('wholesale.filters.all') },
                        ]}
                        value={status}
                    />
                </Toolbar>

                <DataTable
                    caption={t('wholesale.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('common.loading')}
                    minWidth="52rem"
                    rowKey={(application) => application.id}
                    rows={result?.data ?? []}
                    empty={
                        search ? (
                            <EmptyState icon={SearchX} title={t('wholesale.emptySearch')} />
                        ) : (
                            <EmptyState
                                icon={Store}
                                title={t(status === 'PENDING' ? 'wholesale.emptyPending' : 'wholesale.empty')}
                            />
                        )
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        disabled={loading}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('wholesale.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
