'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, SearchX, TicketPercent } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, couponStatus, formatDate, type Coupon, type CouponScope, type Page } from '@/types/api';
import { CouponFormDialog, type CouponFormValues } from './CouponFormDialog';
import { couponDiscountLabel, couponStatusTone } from './coupon-format';

const LIMIT = 20;

type ScopeFilter = 'all' | CouponScope;
type Editing = { coupon?: Coupon } | null;

interface LoadedPage {
    key: string;
    page: Page<Coupon>;
}

interface Failure {
    key: string;
    message: string;
}

/**
 * Lista de cupons. Inclui inativos, expirados e esgotados de propósito: o
 * admin precisa ver o que existiu para prorrogar, reativar ou copiar — e
 * para responder ao suporte por que um código foi recusado.
 */
export function CouponsListPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ScopeFilter>('all');
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const [editing, setEditing] = useState<Editing>(null);
    const [version, setVersion] = useState(0);

    const queryKey = `${pageNumber}|${search}|${scope}|${version}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${search}|${scope}|${version}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (search) query.set('search', search);
        if (scope !== 'all') query.set('scope', scope);

        api<Page<Coupon>>(`/coupons?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch((err) => {
                if (active)
                    setFailure({
                        key,
                        message: err instanceof ApiError && err.status === 403 ? t('coupons.forbidden') : t('coupons.error'),
                    });
            });

        return () => {
            active = false;
        };
    }, [pageNumber, search, scope, version, t]);

    const handleSearch = useCallback((term: string) => {
        setSearch(term);
        setPageNumber(1);
    }, []);

    async function submit(values: CouponFormValues) {
        const existing = editing?.coupon;
        // Na edição, código, escopo e tipo não vão no corpo: o backend não os altera.
        const { code, scope: valuesScope, discountType, ...editable } = values;
        await api(existing ? `/coupons/${existing.id}` : '/coupons', {
            method: existing ? 'PATCH' : 'POST',
            body: JSON.stringify(existing ? editable : { code, scope: valuesScope, discountType, ...editable }),
        });
        notify({ tone: 'success', title: t(existing ? 'coupons.updatedFeedback' : 'coupons.createdFeedback') });
        setEditing(null);
        setVersion((current) => current + 1);
    }

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<Coupon>[] = [
        {
            key: 'coupon',
            header: t('coupons.columns.coupon'),
            cell: (coupon) => (
                <span className="block min-w-0">
                    <Link
                        className="mm-data block text-sm font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/cupons/${coupon.id}`}
                    >
                        {coupon.code}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted dark:text-night-muted">{coupon.name}</span>
                </span>
            ),
        },
        {
            key: 'scope',
            header: t('coupons.columns.scope'),
            hideBelow: 'md',
            cell: (coupon) => (
                <StatusPill hideDot tone={coupon.scope === 'SHIPPING' ? 'info' : 'neutral'}>
                    {t(`coupons.scopes.${coupon.scope}`)}
                </StatusPill>
            ),
        },
        {
            key: 'discount',
            header: t('coupons.columns.discount'),
            cell: (coupon) => (
                <span className="block">
                    <span className="mm-data font-semibold">{couponDiscountLabel(coupon)}</span>
                    {(coupon.maxDiscountMinor || coupon.minAmountMinor) && (
                        <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                            {[
                                coupon.maxDiscountMinor ? t('coupons.upTo', { max: cny(coupon.maxDiscountMinor) }) : null,
                                coupon.minAmountMinor ? t('coupons.minAmount', { min: cny(coupon.minAmountMinor) }) : null,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'uses',
            header: t('coupons.columns.uses'),
            numeric: true,
            cell: (coupon) => (
                <span className="block">
                    <span className="mm-data">
                        {coupon.maxUses === null
                            ? t('coupons.usesUnlimited', { used: coupon.usedCount })
                            : t('coupons.uses', { used: coupon.usedCount, max: coupon.maxUses })}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {t('coupons.perUser', { count: coupon.maxUsesPerUser })}
                    </span>
                </span>
            ),
        },
        {
            key: 'target',
            header: t('coupons.columns.target'),
            hideBelow: 'lg',
            cell: (coupon) =>
                coupon.user ? (
                    <Link
                        className="block min-w-0 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/usuarios/${coupon.user.id}`}
                    >
                        <span className="block truncate">{coupon.user.name}</span>
                        <span className="block truncate text-xs text-muted dark:text-night-muted">{coupon.user.email}</span>
                    </Link>
                ) : (
                    <span className="text-xs text-muted dark:text-night-muted">{t('coupons.open')}</span>
                ),
        },
        {
            key: 'validity',
            header: t('coupons.columns.validity'),
            hideBelow: 'lg',
            cell: (coupon) => (
                <span className="text-xs text-muted dark:text-night-muted">
                    {coupon.expiresAt
                        ? t('coupons.untilDate', { date: formatDate(coupon.expiresAt) })
                        : t('coupons.noExpiry')}
                </span>
            ),
        },
        {
            key: 'status',
            header: t('coupons.columns.status'),
            cell: (coupon) => {
                const status = couponStatus(coupon);
                return <StatusPill tone={couponStatusTone(status)}>{t(`coupons.statuses.${status}`)}</StatusPill>;
            },
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (coupon) => (
                <Button
                    aria-label={t('coupons.edit')}
                    iconOnly
                    onClick={() => setEditing({ coupon })}
                    size="small"
                    variant="ghost"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={<Button onClick={() => setEditing({})}>{t('coupons.newCoupon')}</Button>}
                description={t('coupons.description')}
                kicker={t('coupons.kicker')}
                title={t('coupons.title')}
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
                        label={t('coupons.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('coupons.searchPlaceholder')}
                        value={search}
                    />
                    <FilterTabs<ScopeFilter>
                        label={t('coupons.columns.scope')}
                        onChange={(value) => {
                            setScope(value);
                            setPageNumber(1);
                        }}
                        options={[
                            { value: 'all', label: t('coupons.filters.all') },
                            { value: 'ORDER', label: t('coupons.filters.ORDER') },
                            { value: 'SHIPPING', label: t('coupons.filters.SHIPPING') },
                        ]}
                        value={scope}
                    />
                </Toolbar>

                <DataTable
                    caption={t('coupons.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('common.loading')}
                    minWidth="52rem"
                    rowKey={(coupon) => coupon.id}
                    rows={result?.data ?? []}
                    empty={
                        search || scope !== 'all' ? (
                            <EmptyState icon={SearchX} title={t('coupons.emptySearch')} />
                        ) : (
                            <EmptyState icon={TicketPercent} title={t('coupons.empty')} />
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
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('coupons.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>

            <CouponFormDialog
                coupon={editing?.coupon}
                onClose={() => setEditing(null)}
                onSubmit={submit}
                open={editing !== null}
            />
        </div>
    );
}
