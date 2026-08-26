'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminCategory, AdminProduct, Page } from '@/types/api';
import { money, productSourceLabel } from '@/types/api';

const STATUS_FILTERS = [
    { value: '', key: 'statusAll' },
    { value: 'published', key: 'statusPublished' },
    { value: 'draft', key: 'statusDraft' },
] as const;

const LIMIT = 20;

export function ProductsListPage() {
    const { t } = useTranslation();
    const [page, setPage] = useState<Page<AdminProduct>>();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [pageNumber, setPageNumber] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [subcategoryFilter, setSubcategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('');

    function load(filters: { category: string; subcategory: string; status: string }, currentPage: number) {
        setLoading(true);
        const query = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
        if (filters.status) query.set('status', filters.status);
        if (filters.category) query.set('categoryId', filters.category);
        if (filters.subcategory) query.set('subcategoryId', filters.subcategory);
        api<Page<AdminProduct>>(`/products?${query.toString()}`)
            .then(setPage)
            .catch(() => setError(t('products.list.error')))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load({ category: '', subcategory: '', status: '' }, 1);
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => {
                /* filtro de categoria é opcional; falha silenciosa aqui */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const subcategoryOptions = useMemo(
        () => categories.find((category) => category.id === categoryFilter)?.subcategories ?? [],
        [categories, categoryFilter],
    );

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPageNumber(1);
        load({ category: categoryFilter, subcategory: subcategoryFilter, status: statusFilter }, 1);
    }

    function goToPage(next: number) {
        setPageNumber(next);
        load({ category: categoryFilter, subcategory: subcategoryFilter, status: statusFilter }, next);
    }

    const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

    return (
        <main>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="mm-kicker mb-3">{t('products.list.kicker')}</p>
                    <h1 className="m-0 text-3xl tracking-[-.03em]">{t('products.list.title')}</h1>
                </div>
                <Link href="/admin/produtos/novo">
                    <Button leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>{t('products.list.newButton')}</Button>
                </Link>
            </div>

            <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={handleSearch}>
                <label className="grid gap-2 text-sm font-semibold">
                    {t('products.list.categoryLabel')}
                    <select
                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                        value={categoryFilter}
                        onChange={(event) => {
                            setCategoryFilter(event.target.value);
                            setSubcategoryFilter('');
                        }}
                    >
                        <option value="">{t('products.list.categoryAll')}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                    {t('products.list.subcategoryLabel')}
                    <select
                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas disabled:opacity-50"
                        value={subcategoryFilter}
                        onChange={(event) => setSubcategoryFilter(event.target.value)}
                        disabled={subcategoryOptions.length === 0}
                    >
                        <option value="">{t('products.list.categoryAll')}</option>
                        {subcategoryOptions.map((subcategory) => (
                            <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                    {t('products.list.statusLabel')}
                    <select
                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number]['value'])}
                    >
                        {STATUS_FILTERS.map((filter) => (
                            <option key={filter.value} value={filter.value}>
                                {t(`products.list.${filter.key}`)}
                            </option>
                        ))}
                    </select>
                </label>
                <Button type="submit" variant="secondary">
                    {t('products.list.searchButton')}
                </Button>
            </form>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">{t('products.list.loading')}</p>}

            {!loading && page && (
                <>
                    <div className="mt-8 overflow-x-auto">
                        <table className="w-full min-w-[900px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                    <th className="py-3 pr-4">{t('products.list.columns.product')}</th>
                                    <th className="py-3 pr-4">{t('products.list.columns.category')}</th>
                                    <th className="py-3 pr-4">{t('products.list.columns.marketplace')}</th>
                                    <th className="py-3 pr-4">{t('products.list.columns.basePrice')}</th>
                                    <th className="py-3 pr-4">{t('products.list.columns.variants')}</th>
                                    <th className="py-3 pr-4">{t('products.list.columns.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((product) => (
                                    <tr className="border-b border-line dark:border-night-line" key={product.id}>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary" href={`/admin/produtos/${product.id}`}>
                                                {product.name}
                                            </Link>
                                            <p className="mt-0.5 text-xs text-muted dark:text-night-muted">/{product.slug}</p>
                                        </td>
                                        <td className="py-3 pr-4 text-muted dark:text-night-muted">
                                            {[...product.categories, ...product.subcategories].map((entry) => entry.name).join(', ') || t('common.dash')}
                                        </td>
                                        <td className="py-3 pr-4">{productSourceLabel(product.marketplace)}</td>
                                        <td className="py-3 pr-4 mm-data">{money(product.sourceAmountMinor, product.sourceCurrency)}</td>
                                        <td className="py-3 pr-4">{product.variants.length}</td>
                                        <td className="py-3 pr-4">
                                            <span className="mm-kicker">{product.isPublished ? t('products.list.statusPublished') : t('products.list.statusDraft')}</span>
                                        </td>
                                    </tr>
                                ))}
                                {page.data.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-muted" colSpan={6}>
                                            {t('products.list.empty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted dark:text-night-muted">
                            {t('common.pagination.page', { page: pageNumber, total: totalPages })} · {t('products.list.countUnit', { count: page.total })}
                        </span>
                        <div className="flex gap-3">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber - 1)}
                                disabled={pageNumber <= 1}
                            >
                                {t('common.pagination.previous')}
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber + 1)}
                                disabled={pageNumber >= totalPages}
                            >
                                {t('common.pagination.next')}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
