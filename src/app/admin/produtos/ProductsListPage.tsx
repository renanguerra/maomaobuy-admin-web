'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileJson, FileX, FilterX, ImageOff, Package, Plus, Trash2, Upload, X } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { publishedTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminProduct, BulkResult, Page } from '@/types/api';
import { money, productSourceLabel } from '@/types/api';

type BulkAction = 'publish' | 'draft' | 'delete';

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
    const { notify } = useToast();
    const confirm = useConfirm();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const [refreshToken, setRefreshToken] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<BulkAction>();

    const queryKey = filtersKey(filters, pageNumber);
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;
    const rows = useMemo(() => result?.data ?? [], [result]);

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
    }, [filters, pageNumber, refreshToken, t]);

    // Muda a página sem deixar uma seleção de outra listagem sobreviver.
    const changePage = useCallback((next: number) => {
        setPageNumber(next);
        setSelectedIds(new Set());
    }, []);

    const updateFilters = useCallback((patch: Partial<Filters>) => {
        setPageNumber(1);
        setFilters((current) => ({ ...current, ...patch }));
        setSelectedIds(new Set());
    }, []);

    const subcategoryOptions = useMemo(
        () => categories.find((category) => category.id === filters.category)?.subcategories ?? [],
        [categories, filters.category],
    );

    const hasFilters = filters.category !== '' || filters.subcategory !== '' || filters.status !== '';
    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const allOnPageSelected = rows.length > 0 && rows.every((product) => selectedIds.has(product.id));

    const toggleSelected = useCallback((id: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAllOnPage = useCallback(() => {
        setSelectedIds((current) => {
            if (rows.length > 0 && rows.every((product) => current.has(product.id))) return new Set();
            return new Set(rows.map((product) => product.id));
        });
    }, [rows]);

    async function runBulkAction(action: BulkAction) {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        if (action === 'delete') {
            const confirmed = await confirm({
                title: t('products.list.bulk.deleteTitle', { count: ids.length }),
                description: t('products.list.bulk.deleteConfirm', { count: ids.length }),
                confirmLabel: t('common.actions.delete'),
                tone: 'danger',
            });
            if (!confirmed) return;
        }

        setBulkAction(action);
        // Uma requisição para a seleção inteira, resolvida no banco com um
        // UPDATE só. O backend não recusa o lote por causa de um id que sumiu
        // no meio do caminho: devolve quantos pegou e quais ficaram de fora.
        let succeeded = 0;
        try {
            const result = await api<BulkResult>(`/products/bulk/${action}`, {
                method: 'POST',
                body: JSON.stringify({ ids }),
            });
            succeeded = result.affected;
        } catch (err) {
            if (!(err instanceof ApiError)) throw err;
        } finally {
            setBulkAction(undefined);
        }
        setSelectedIds(new Set());
        setRefreshToken((current) => current + 1);

        const failed = ids.length - succeeded;
        notify({
            tone: failed === 0 ? 'success' : succeeded === 0 ? 'danger' : 'warning',
            title: t(`products.list.bulk.${action}ResultTitle`, { count: succeeded }),
            description: failed > 0 ? t('products.list.bulk.partialFailure', { failed, total: ids.length }) : undefined,
        });
    }

    const columns: DataTableColumn<AdminProduct>[] = [
        {
            key: 'select',
            header: (
                <Checkbox
                    checked={allOnPageSelected}
                    label={<span className="sr-only">{t('products.list.bulk.selectAllAria')}</span>}
                    onChange={toggleSelectAllOnPage}
                />
            ),
            card: 'hide',
            width: '2.75rem',
            cell: (product) => (
                <Checkbox
                    checked={selectedIds.has(product.id)}
                    label={
                        <span className="sr-only">{t('products.list.bulk.selectAria', { name: product.name })}</span>
                    }
                    onChange={() => toggleSelected(product.id)}
                />
            ),
        },
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
                <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={publishedTone(product.isPublished)}>
                        {product.isPublished ? t('products.list.statusPublished') : t('products.list.statusDraft')}
                    </StatusPill>
                    {product.isPreSale && <StatusPill tone="warning">{t('products.list.statusPreSale')}</StatusPill>}
                </div>
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
                    <>
                        <ButtonLink
                            href="/admin/produtos/importar"
                            leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                            variant="secondary"
                        >
                            {t('products.list.importButton')}
                        </ButtonLink>
                        <ButtonLink
                            href="/admin/produtos/editar-em-lote"
                            leadingIcon={<FileJson className="h-4 w-4" aria-hidden="true" />}
                            variant="secondary"
                        >
                            {t('products.list.bulkEditorButton')}
                        </ButtonLink>
                        <ButtonLink
                            href="/admin/produtos/novo"
                            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        >
                            {t('products.list.newButton')}
                        </ButtonLink>
                    </>
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
                                    setSelectedIds(new Set());
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

                {selectedIds.size > 0 && (
                    <Toolbar
                        className="bg-warm-100 dark:bg-night-canvas"
                        actions={
                            <>
                                <Button
                                    leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                    loading={bulkAction === 'publish'}
                                    disabled={bulkAction !== undefined && bulkAction !== 'publish'}
                                    onClick={() => runBulkAction('publish')}
                                    size="small"
                                    variant="secondary"
                                >
                                    {t('products.list.bulk.markPublished')}
                                </Button>
                                <Button
                                    leadingIcon={<FileX className="h-4 w-4" aria-hidden="true" />}
                                    loading={bulkAction === 'draft'}
                                    disabled={bulkAction !== undefined && bulkAction !== 'draft'}
                                    onClick={() => runBulkAction('draft')}
                                    size="small"
                                    variant="secondary"
                                >
                                    {t('products.list.bulk.markDraft')}
                                </Button>
                                <Button
                                    leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                    loading={bulkAction === 'delete'}
                                    disabled={bulkAction !== undefined && bulkAction !== 'delete'}
                                    onClick={() => runBulkAction('delete')}
                                    size="small"
                                    variant="dangerGhost"
                                >
                                    {t('products.list.bulk.deleteButton')}
                                </Button>
                            </>
                        }
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('products.list.bulk.selectedCount', { count: selectedIds.size })}
                            <Button
                                aria-label={t('products.list.bulk.clearSelection')}
                                disabled={bulkAction !== undefined}
                                iconOnly
                                onClick={() => setSelectedIds(new Set())}
                                size="small"
                                variant="ghost"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </span>
                    </Toolbar>
                )}

                <DataTable
                    caption={t('products.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('products.list.loading')}
                    minWidth="56rem"
                    rowKey={(product) => product.id}
                    rows={rows}
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
                        onChange={changePage}
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
