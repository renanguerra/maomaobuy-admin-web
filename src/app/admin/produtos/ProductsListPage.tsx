'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FilterX, ImageOff, Package, Plus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { publishedTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminCategory, AdminProduct, Page } from '@/types/api';
import { money, productSourceLabel } from '@/types/api';

const LIMIT = 20;

interface Filters {
    category: string;
    subcategory: string;
    status: string;
}

const NO_FILTERS: Filters = { category: '', subcategory: '', status: '' };

interface LoadedPage {
    /** Identifica a consulta que produziu estes dados (filtros + página). */
    key: string;
    page: Page<AdminProduct>;
}

interface Failure {
    key: string;
    message: string;
}

function filtersKey(filters: Filters, pageNumber: number) {
    return `${pageNumber}|${filters.category}|${filters.subcategory}|${filters.status}`;
}

export function ProductsListPage() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    const queryKey = filtersKey(filters, pageNumber);
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => {
                /* filtro de categoria é opcional; falha silenciosa aqui */
            });
    }, []);

    useEffect(() => {
        let active = true;
        const key = filtersKey(filters, pageNumber);
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (filters.status) query.set('status', filters.status);
        if (filters.category) query.set('categoryId', filters.category);
        if (filters.subcategory) query.set('subcategoryId', filters.subcategory);

        api<Page<AdminProduct>>(`/products?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('products.list.error') });
            });

        return () => {
            active = false;
        };
    }, [filters, pageNumber, t]);

    const updateFilters = useCallback((patch: Partial<Filters>) => {
        setPageNumber(1);
        setFilters((current) => ({ ...current, ...patch }));
    }, []);

    const subcategoryOptions = useMemo(
        () => categories.find((category) => category.id === filters.category)?.subcategories ?? [],
        [categories, filters.category],
    );

    const hasFilters = filters.category !== '' || filters.subcategory !== '' || filters.status !== '';
    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<AdminProduct>[] = [
        {
            key: 'product',
            header: t('products.list.columns.product'),
            cell: (product) => {
                const cover = product.media.find((item) => item.type === 'IMAGE' && item.url);
                return (
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-warm-200 dark:border-night-line dark:bg-night-raised">
                            {cover?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="" className="h-full w-full object-cover" loading="lazy" src={cover.url} />
                            ) : (
                                <ImageOff className="h-4 w-4 text-muted dark:text-night-subtle" aria-hidden="true" />
                            )}
                        </span>
                        <span className="min-w-0">
                            <Link
                                className="block truncate font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                                href={`/admin/produtos/${product.id}`}
                            >
                                {product.name}
                            </Link>
                            <span className="block truncate text-xs text-muted dark:text-night-muted">
                                /{product.slug}
                            </span>
                        </span>
                    </span>
                );
            },
        },
        {
            key: 'categories',
            header: t('products.list.columns.category'),
            hideBelow: 'lg',
            cell: (product) => (
                <span className="text-muted dark:text-night-muted">
                    {[...product.categories, ...product.subcategories].map((entry) => entry.name).join(', ') ||
                        t('common.dash')}
                </span>
            ),
        },
        {
            key: 'marketplace',
            header: t('products.list.columns.marketplace'),
            hideBelow: 'md',
            cell: (product) => productSourceLabel(product.marketplace),
        },
        {
            key: 'price',
            header: t('products.list.columns.basePrice'),
            numeric: true,
            cell: (product) => (
                <span className="font-semibold">{money(product.sourceAmountMinor, product.sourceCurrency)}</span>
            ),
        },
        {
            key: 'variants',
            header: t('products.list.columns.variants'),
            hideBelow: 'lg',
            numeric: true,
            cell: (product) => product.variants.length,
        },
        {
            key: 'status',
            header: t('products.list.columns.status'),
            cell: (product) => (
                <StatusPill tone={publishedTone(product.isPublished)}>
                    {product.isPublished ? t('products.list.statusPublished') : t('products.list.statusDraft')}
                </StatusPill>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('products.list.description')}
                kicker={t('products.list.kicker')}
                title={t('products.list.title')}
                actions={
                    <ButtonLink
                        href="/admin/produtos/novo"
                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    >
                        {t('products.list.newButton')}
                    </ButtonLink>
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar
                    actions={
                        hasFilters ? (
                            <Button
                                leadingIcon={<FilterX className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => {
                                    setPageNumber(1);
                                    setFilters(NO_FILTERS);
                                }}
                                size="small"
                                variant="ghost"
                            >
                                {t('common.actions.clearFilters')}
                            </Button>
                        ) : undefined
                    }
                >
                    <Select
                        fieldClassName="w-full max-w-56"
                        label={t('products.list.categoryLabel')}
                        onChange={(event) => updateFilters({ category: event.target.value, subcategory: '' })}
                        options={categories.map((category) => ({ value: category.id, label: category.name }))}
                        placeholderOption={t('products.list.categoryAll')}
                        value={filters.category}
                    />
                    <Select
                        disabled={subcategoryOptions.length === 0}
                        fieldClassName="w-full max-w-56"
                        label={t('products.list.subcategoryLabel')}
                        onChange={(event) => updateFilters({ subcategory: event.target.value })}
                        options={subcategoryOptions.map((subcategory) => ({
                            value: subcategory.id,
                            label: subcategory.name,
                        }))}
                        placeholderOption={t('products.list.categoryAll')}
                        value={filters.subcategory}
                    />
                    <Select
                        fieldClassName="w-full max-w-44"
                        label={t('products.list.statusLabel')}
                        onChange={(event) => updateFilters({ status: event.target.value })}
                        placeholderOption={t('products.list.statusAll')}
                        value={filters.status}
                        options={[
                            { value: 'published', label: t('products.list.statusPublished') },
                            { value: 'draft', label: t('products.list.statusDraft') },
                        ]}
                    />
                </Toolbar>

                <DataTable
                    caption={t('products.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('products.list.loading')}
                    minWidth="56rem"
                    rowKey={(product) => product.id}
                    rows={result?.data ?? []}
                    empty={
                        <EmptyState
                            description={hasFilters ? t('products.list.emptyFilteredDescription') : undefined}
                            icon={Package}
                            title={hasFilters ? t('products.list.emptyFiltered') : t('products.list.empty')}
                            action={
                                hasFilters ? (
                                    <Button onClick={() => setFilters(NO_FILTERS)} size="small" variant="secondary">
                                        {t('common.actions.clearFilters')}
                                    </Button>
                                ) : (
                                    <ButtonLink
                                        href="/admin/produtos/novo"
                                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                        size="small"
                                    >
                                        {t('products.list.newButton')}
                                    </ButtonLink>
                                )
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
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('products.list.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
