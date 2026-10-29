'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, SearchX } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { basisPointsLabel, cny, formatDate, type Influencer, type InfluencerStatus, type Page } from '@/types/api';
import { influencerStatusTone } from './influencer-format';

const LIMIT = 20;

type StatusFilter = 'all' | InfluencerStatus;

interface LoadedPage {
    key: string;
    page: Page<Influencer>;
}

interface Failure {
    key: string;
    message: string;
}

/**
 * Programa de influencers: a fila de pedidos em análise primeiro (o backend
 * já ordena assim), depois os aprovados com o que venderam.
 */
export function InfluencersListPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>('PENDING');
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

        api<Page<Influencer>>(`/influencers?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch((err) => {
                if (active)
                    setFailure({
                        key,
                        message:
                            err instanceof ApiError && err.status === 403
                                ? t('influencers.forbidden')
                                : t('influencers.error'),
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

    const columns: DataTableColumn<Influencer>[] = [
        {
            key: 'person',
            header: t('influencers.columns.person'),
            cell: (influencer) => (
                <Link
                    className="block min-w-0 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/influencers/${influencer.id}`}
                >
                    <span className="block truncate font-semibold">{influencer.user.name}</span>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">
                        {influencer.user.email}
                    </span>
                </Link>
            ),
        },
        {
            key: 'socials',
            header: t('influencers.columns.socials'),
            hideBelow: 'md',
            cell: (influencer) => (
                <span className="block text-xs text-ink dark:text-night-text">
                    {influencer.socialHandles.map((social) => (
                        <span className="block truncate" key={`${social.network}:${social.handle}`}>
                            <span className="text-muted dark:text-night-muted">
                                {t(`influencers.networks.${social.network}`)}
                            </span>{' '}
                            @{social.handle}
                        </span>
                    ))}
                </span>
            ),
        },
        {
            key: 'coupon',
            header: t('influencers.columns.coupon'),
            cell: (influencer) =>
                influencer.coupon ? (
                    <span className="block">
                        <span className="mm-data block font-semibold">{influencer.coupon.code}</span>
                        <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                            {t('influencers.couponRates', {
                                discount: basisPointsLabel(influencer.coupon.discountBasisPoints),
                                commission: basisPointsLabel(influencer.effectiveCommissionBasisPoints),
                            })}
                        </span>
                    </span>
                ) : (
                    <span className="text-xs text-muted dark:text-night-muted">
                        {t('influencers.appliedOn', { date: formatDate(influencer.appliedAt) })}
                    </span>
                ),
        },
        {
            key: 'level',
            header: t('influencers.columns.level'),
            hideBelow: 'lg',
            cell: (influencer) => (
                <span className="block">
                    <span className="block text-sm">{influencer.level?.name ?? t('common.dash')}</span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {t('influencers.ordersCount', { count: influencer.qualifiedOrders })}
                    </span>
                </span>
            ),
        },
        {
            key: 'commission',
            header: t('influencers.columns.commission'),
            numeric: true,
            hideBelow: 'md',
            cell: (influencer) => (
                <span className="block">
                    <span className="mm-data block font-semibold">{cny(influencer.totals.creditedMinor)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {t('influencers.pendingAmount', { amount: cny(influencer.totals.pendingMinor) })}
                    </span>
                </span>
            ),
        },
        {
            key: 'status',
            header: t('influencers.columns.status'),
            cell: (influencer) => (
                <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={influencerStatusTone(influencer.status)}>
                        {t(`influencers.statuses.${influencer.status}`)}
                    </StatusPill>
                    {influencer.pendingBenefits > 0 && (
                        <StatusPill hideDot tone="warning">
                            {t('influencers.pendingBenefitsTag', { count: influencer.pendingBenefits })}
                        </StatusPill>
                    )}
                </span>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <ButtonLink href="/admin/influencers/niveis" variant="secondary">
                        {t('influencers.levels.manage')}
                    </ButtonLink>
                }
                description={t('influencers.description')}
                kicker={t('influencers.kicker')}
                title={t('influencers.title')}
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
                        label={t('influencers.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('influencers.searchPlaceholder')}
                        value={search}
                    />
                    <FilterTabs<StatusFilter>
                        label={t('influencers.columns.status')}
                        onChange={(value) => {
                            setStatus(value);
                            setPageNumber(1);
                        }}
                        options={[
                            { value: 'PENDING', label: t('influencers.filters.PENDING') },
                            { value: 'APPROVED', label: t('influencers.filters.APPROVED') },
                            { value: 'REJECTED', label: t('influencers.filters.REJECTED') },
                            { value: 'DISABLED', label: t('influencers.filters.DISABLED') },
                            { value: 'all', label: t('influencers.filters.all') },
                        ]}
                        value={status}
                    />
                </Toolbar>

                <DataTable
                    caption={t('influencers.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('common.loading')}
                    minWidth="52rem"
                    rowKey={(influencer) => influencer.id}
                    rows={result?.data ?? []}
                    empty={
                        search ? (
                            <EmptyState icon={SearchX} title={t('influencers.emptySearch')} />
                        ) : (
                            <EmptyState
                                icon={Megaphone}
                                title={t(status === 'PENDING' ? 'influencers.emptyPending' : 'influencers.empty')}
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
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('influencers.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
