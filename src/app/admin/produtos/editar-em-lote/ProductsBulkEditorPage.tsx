'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileJson, Upload, XCircle } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { publishedTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminProduct, Page } from '@/types/api';
import { money } from '@/types/api';
import { parseBulkEditDocument, type BulkEditProductBody, type BulkEditRow } from './bulk-product-editor-parser';

const EXPORT_PAGE_LIMIT = 100;
const STATUS_OPTIONS = ['published', 'draft'] as const;

type RowOutcome =
    | { status: 'pending' }
    | { status: 'success'; steps: string[] }
    | { status: 'partial'; steps: string[]; message: string }
    | { status: 'error'; message: string };

function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function exportRow(product: AdminProduct) {
    const categories = product.categories.map((category) => {
        const subcategorySlugs = product.subcategories
            .filter((subcategory) => subcategory.categoryId === category.id)
            .map((subcategory) => subcategory.slug);
        return subcategorySlugs.length > 0 ? { slug: category.slug, subcategories: subcategorySlugs } : category.slug;
    });

    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        marketplace: product.marketplace,
        marketplaceUrl: product.marketplaceUrl ?? undefined,
        sourceAmountMinor: product.sourceAmountMinor,
        estimatedShippingAmountMinor: product.estimatedShippingAmountMinor ?? '',
        stock: product.stock,
        weightGrams: product.weightGrams ?? undefined,
        lengthMm: product.lengthMm ?? undefined,
        widthMm: product.widthMm ?? undefined,
        heightMm: product.heightMm ?? undefined,
        isPublished: product.isPublished,
        isPreSale: product.isPreSale,
        releaseDate: product.releaseDate ?? undefined,
        categories,
        variants: product.variants.map((variant) => ({
            externalId: variant.externalId,
            label: variant.label,
            amountAdjustmentMinor: variant.amountAdjustmentMinor,
            isAvailable: variant.isAvailable,
        })),
    };
}

/**
 * Editor em lote de produtos: exporta um filtro para JSON e aceita o mesmo
 * arquivo de volta, editado, para aplicar via `PATCH /products/:id` — o mesmo
 * corpo que o formulário de edição já envia (`toProductPayload`). Variações
 * usam suas próprias rotas (criar/editar/remover), então cada uma é
 * comparada contra o produto retornado pelo PATCH para só mexer no que
 * mudou. Mídia fica de fora — segue sendo produto a produto, como hoje.
 */
export function ProductsBulkEditorPage() {
    const { t } = useTranslation();

    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [categoriesState, setCategoriesState] = useState<'loading' | 'ready' | 'error'>('loading');

    const [exportStatus, setExportStatus] = useState('');
    const [exportCategory, setExportCategory] = useState('');
    const [exportSubcategory, setExportSubcategory] = useState('');
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string>();

    const [jsonText, setJsonText] = useState('');
    const [rows, setRows] = useState<BulkEditRow[]>();
    const [parseError, setParseError] = useState<string>();
    const [outcomes, setOutcomes] = useState<Record<number, RowOutcome>>({});
    const [applying, setApplying] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then((loaded) => {
                setCategories(loaded);
                setCategoriesState('ready');
            })
            .catch(() => setCategoriesState('error'));
    }, []);

    const exportSubcategoryOptions = useMemo(
        () => categories.find((category) => category.id === exportCategory)?.subcategories ?? [],
        [categories, exportCategory],
    );

    async function handleExport() {
        setExporting(true);
        setExportError(undefined);
        try {
            const collected: AdminProduct[] = [];
            let page = 1;
            for (;;) {
                const query = new URLSearchParams({ page: String(page), limit: String(EXPORT_PAGE_LIMIT) });
                if (exportStatus) query.set('status', exportStatus);
                if (exportCategory) query.set('categoryId', exportCategory);
                if (exportSubcategory) query.set('subcategoryId', exportSubcategory);
                const result = await api<Page<AdminProduct>>(`/products?${query.toString()}`);
                collected.push(...result.data);
                if (result.data.length === 0 || collected.length >= result.total) break;
                page += 1;
            }
            downloadJson(`produtos-${new Date().toISOString().slice(0, 10)}.json`, collected.map(exportRow));
        } catch (err) {
            setExportError(err instanceof ApiError ? err.message : t('products.bulkEditor.exportSection.error'));
        } finally {
            setExporting(false);
        }
    }

    function handleParse() {
        setOutcomes({});
        try {
            const parsed = parseBulkEditDocument(jsonText, categories);
            setRows(parsed);
            setParseError(undefined);
        } catch (err) {
            setRows(undefined);
            const key = err instanceof Error ? err.message : '';
            setParseError(
                key === 'invalidJson' || key === 'notArray'
                    ? t(`products.bulkEditor.${key}`)
                    : t('products.bulkEditor.invalidJson'),
            );
        }
    }

    function handleFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => setJsonText(String(reader.result ?? ''));
        reader.onerror = () => setParseError(t('products.bulkEditor.fileReadError'));
        reader.readAsText(file);
    }

    async function applyRowEdit(edit: BulkEditProductBody): Promise<{ steps: string[]; failedMessage?: string }> {
        let current: AdminProduct;
        try {
            current = await api<AdminProduct>(`/products/${edit.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: edit.name,
                    slug: edit.slug,
                    description: edit.description,
                    marketplace: edit.marketplace,
                    marketplaceUrl: edit.marketplace === 'MAOMAOBUY' ? undefined : edit.marketplaceUrl,
                    sourceAmountMinor: edit.sourceAmountMinor,
                    estimatedShippingAmountMinor: edit.estimatedShippingAmountMinor,
                    stock: edit.stock,
                    weightGrams: edit.weightGrams,
                    lengthMm: edit.lengthMm,
                    widthMm: edit.widthMm,
                    heightMm: edit.heightMm,
                    isPublished: edit.isPublished,
                    isPreSale: edit.isPreSale,
                    releaseDate: edit.isPreSale ? edit.releaseDate : undefined,
                    categoryIds: edit.categoryIds ?? [],
                    subcategoryIds: edit.subcategoryIds ?? [],
                }),
            });
        } catch (err) {
            return { steps: [], failedMessage: err instanceof ApiError ? err.message : t('common.errors.generic') };
        }

        const steps = [t('products.bulkEditor.steps.fields')];
        if (!edit.variants) return { steps };

        const currentByExternalId = new Map(current.variants.map((variant) => [variant.externalId, variant]));

        for (const variantEdit of edit.variants) {
            const existing = currentByExternalId.get(variantEdit.externalId);
            try {
                if (variantEdit.remove) {
                    if (!existing) continue;
                    await api(`/products/${edit.id}/variants/${existing.id}`, { method: 'DELETE' });
                    steps.push(t('products.bulkEditor.steps.variantRemoved', { externalId: variantEdit.externalId }));
                    continue;
                }
                if (!existing) {
                    await api(`/products/${edit.id}/variants`, {
                        method: 'POST',
                        body: JSON.stringify({
                            externalId: variantEdit.externalId,
                            label: variantEdit.label,
                            amountAdjustmentMinor: variantEdit.amountAdjustmentMinor,
                            isAvailable: variantEdit.isAvailable,
                        }),
                    });
                    steps.push(t('products.bulkEditor.steps.variantCreated', { externalId: variantEdit.externalId }));
                    continue;
                }
                const changed =
                    existing.label !== variantEdit.label ||
                    existing.amountAdjustmentMinor !== variantEdit.amountAdjustmentMinor ||
                    existing.isAvailable !== variantEdit.isAvailable;
                if (!changed) continue;
                await api(`/products/${edit.id}/variants/${existing.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        label: variantEdit.label,
                        amountAdjustmentMinor: variantEdit.amountAdjustmentMinor,
                        isAvailable: variantEdit.isAvailable,
                    }),
                });
                steps.push(t('products.bulkEditor.steps.variantUpdated', { externalId: variantEdit.externalId }));
            } catch (err) {
                return {
                    steps,
                    failedMessage: err instanceof ApiError ? err.message : t('common.errors.generic'),
                };
            }
        }

        return { steps };
    }

    async function handleApply() {
        if (!rows) return;
        const pending = rows.filter((row) => row.result.ok);
        setApplying(true);
        setOutcomes(Object.fromEntries(pending.map((row) => [row.index, { status: 'pending' as const }])));

        for (const row of pending) {
            if (!row.result.ok) continue;
            const { steps, failedMessage } = await applyRowEdit(row.result.edit);
            const outcome: RowOutcome =
                failedMessage !== undefined
                    ? steps.length > 0
                        ? { status: 'partial', steps, message: failedMessage }
                        : { status: 'error', message: failedMessage }
                    : { status: 'success', steps };
            setOutcomes((current) => ({ ...current, [row.index]: outcome }));
        }

        setApplying(false);
    }

    function downloadFailedItems() {
        if (!rows) return;
        const failedRaw = rows
            .filter(
                (row) =>
                    !row.result.ok ||
                    outcomes[row.index]?.status === 'error' ||
                    outcomes[row.index]?.status === 'partial',
            )
            .map((row) => row.raw);
        downloadJson('produtos-com-falha.json', failedRaw);
    }

    const validCount = rows?.filter((row) => row.result.ok).length ?? 0;
    const summary = useMemo(() => {
        const values = Object.values(outcomes);
        if (values.length === 0) return undefined;
        const pendingCount = values.filter((item) => item.status === 'pending').length;
        if (pendingCount > 0) return undefined;
        const success = values.filter((item) => item.status === 'success').length;
        const failed = values.filter((item) => item.status === 'error' || item.status === 'partial').length;
        return { success, failed, total: rows?.length ?? values.length };
    }, [outcomes, rows]);

    const hasFailures =
        Object.values(outcomes).some((item) => item.status === 'error' || item.status === 'partial') ||
        (rows?.some((row) => !row.result.ok) ?? false);

    const columns: DataTableColumn<BulkEditRow>[] = [
        {
            key: 'item',
            header: t('products.bulkEditor.columns.item'),
            cell: (row) => <span className="font-semibold text-ink dark:text-night-text">{row.label}</span>,
        },
        {
            key: 'marketplace',
            header: t('products.bulkEditor.columns.marketplace'),
            hideBelow: 'md',
            cell: (row) => (row.result.ok ? row.result.edit.marketplace : t('common.dash')),
        },
        {
            key: 'price',
            header: t('products.bulkEditor.columns.price'),
            numeric: true,
            hideBelow: 'md',
            cell: (row) => (row.result.ok ? money(row.result.edit.sourceAmountMinor, 'CNY') : t('common.dash')),
        },
        {
            key: 'stock',
            header: t('products.bulkEditor.columns.stock'),
            numeric: true,
            hideBelow: 'lg',
            cell: (row) => (row.result.ok ? row.result.edit.stock : t('common.dash')),
        },
        {
            key: 'published',
            header: t('products.bulkEditor.columns.published'),
            hideBelow: 'lg',
            cell: (row) =>
                row.result.ok ? (
                    <StatusPill tone={publishedTone(row.result.edit.isPublished)}>
                        {row.result.edit.isPublished
                            ? t('products.list.statusPublished')
                            : t('products.list.statusDraft')}
                    </StatusPill>
                ) : (
                    t('common.dash')
                ),
        },
        {
            key: 'status',
            header: t('products.bulkEditor.columns.status'),
            cell: (row) => {
                const outcome = outcomes[row.index];
                if (!row.result.ok)
                    return (
                        <span className="grid gap-1">
                            <StatusPill tone="danger">{t('products.bulkEditor.failedStatus')}</StatusPill>
                            <span className="text-xs text-muted dark:text-night-muted">{row.result.error}</span>
                        </span>
                    );
                if (!outcome) return <StatusPill tone="neutral">{t('products.bulkEditor.validRow')}</StatusPill>;
                if (outcome.status === 'pending')
                    return <StatusPill tone="info">{t('products.bulkEditor.pendingStatus')}</StatusPill>;
                if (outcome.status === 'success')
                    return (
                        <span className="grid gap-1">
                            <StatusPill tone="success">{t('products.bulkEditor.appliedStatus')}</StatusPill>
                            <span className="text-xs text-muted dark:text-night-muted">
                                {outcome.steps.join(' · ')}
                            </span>
                        </span>
                    );
                if (outcome.status === 'partial')
                    return (
                        <span className="grid gap-1">
                            <StatusPill tone="warning">{t('products.bulkEditor.partialStatus')}</StatusPill>
                            {outcome.steps.length > 0 && (
                                <span className="text-xs text-muted dark:text-night-muted">
                                    {outcome.steps.join(' · ')}
                                </span>
                            )}
                            <span className="text-xs text-muted dark:text-night-muted">{outcome.message}</span>
                        </span>
                    );
                return (
                    <span className="grid gap-1">
                        <StatusPill tone="danger">{t('products.bulkEditor.failedStatus')}</StatusPill>
                        <span className="text-xs text-muted dark:text-night-muted">{outcome.message}</span>
                    </span>
                );
            },
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/produtos"
                backLabel={t('products.bulkEditor.backLink')}
                description={t('products.bulkEditor.description')}
                kicker={t('products.bulkEditor.kicker')}
                title={t('products.bulkEditor.title')}
            />

            <SectionCard title={t('products.bulkEditor.exportSection.title')}>
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Select
                            label={t('products.bulkEditor.exportSection.statusLabel')}
                            onChange={(event) => setExportStatus(event.target.value)}
                            placeholderOption={t('products.bulkEditor.exportSection.statusAll')}
                            value={exportStatus}
                            options={STATUS_OPTIONS.map((value) => ({
                                value,
                                label:
                                    value === 'published'
                                        ? t('products.list.statusPublished')
                                        : t('products.list.statusDraft'),
                            }))}
                        />
                        <Select
                            label={t('products.list.categoryLabel')}
                            onChange={(event) => {
                                setExportCategory(event.target.value);
                                setExportSubcategory('');
                            }}
                            placeholderOption={t('products.list.categoryAll')}
                            value={exportCategory}
                            options={categories.map((category) => ({ value: category.id, label: category.name }))}
                        />
                        <Select
                            disabled={exportSubcategoryOptions.length === 0}
                            label={t('products.list.subcategoryLabel')}
                            onChange={(event) => setExportSubcategory(event.target.value)}
                            placeholderOption={t('products.list.categoryAll')}
                            value={exportSubcategory}
                            options={exportSubcategoryOptions.map((subcategory) => ({
                                value: subcategory.id,
                                label: subcategory.name,
                            }))}
                        />
                    </div>

                    {exportError && (
                        <Alert tone="danger">
                            <p>{exportError}</p>
                        </Alert>
                    )}

                    <div>
                        <Button
                            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
                            loading={exporting}
                            onClick={handleExport}
                            type="button"
                        >
                            {exporting
                                ? t('products.bulkEditor.exportSection.exportingButton')
                                : t('products.bulkEditor.exportSection.exportButton')}
                        </Button>
                    </div>
                </div>
            </SectionCard>

            <Alert title={t('products.bulkEditor.schemaHelp.title')}>
                <p>{t('products.bulkEditor.schemaHelp.description')}</p>
            </Alert>

            <SectionCard
                title={t('products.bulkEditor.textareaLabel')}
                action={
                    <>
                        <input
                            accept="application/json"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) handleFile(file);
                                event.target.value = '';
                            }}
                            ref={fileInputRef}
                            type="file"
                        />
                        <Button
                            leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => fileInputRef.current?.click()}
                            size="small"
                            type="button"
                            variant="secondary"
                        >
                            {t('products.bulkEditor.uploadButton')}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4">
                    <Textarea
                        className="min-h-64 font-mono text-xs"
                        hideLabel
                        label={t('products.bulkEditor.textareaLabel')}
                        onChange={(event) => setJsonText(event.target.value)}
                        placeholder={t('products.bulkEditor.textareaPlaceholder')}
                        rows={14}
                        value={jsonText}
                    />

                    {categoriesState === 'error' && (
                        <Alert tone="danger">
                            <p>{t('products.bulkEditor.categoriesLoadError')}</p>
                        </Alert>
                    )}

                    {parseError && (
                        <Alert tone="danger">
                            <p>{parseError}</p>
                        </Alert>
                    )}

                    <div className="flex justify-end">
                        <Button
                            disabled={jsonText.trim().length === 0 || categoriesState !== 'ready'}
                            leadingIcon={<FileJson className="h-4 w-4" aria-hidden="true" />}
                            onClick={handleParse}
                            type="button"
                        >
                            {t('products.bulkEditor.parseButton')}
                        </Button>
                    </div>
                </div>
            </SectionCard>

            {rows && (
                <SectionCard
                    flush
                    title={t('products.bulkEditor.previewTitle')}
                    action={
                        <>
                            {hasFailures && (
                                <Button
                                    leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                                    onClick={downloadFailedItems}
                                    size="small"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t('products.bulkEditor.downloadFailedButton')}
                                </Button>
                            )}
                            <Button
                                disabled={validCount === 0}
                                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                loading={applying}
                                onClick={handleApply}
                                size="small"
                                type="button"
                            >
                                {applying
                                    ? t('products.bulkEditor.applyingButton')
                                    : t('products.bulkEditor.applyButton', { count: validCount })}
                            </Button>
                        </>
                    }
                >
                    {summary && (
                        <div className="border-b border-line p-4 dark:border-night-line">
                            <Alert tone={summary.failed > 0 ? 'warning' : 'success'}>
                                <p>
                                    {t('products.bulkEditor.summary', {
                                        success: summary.success,
                                        failed: summary.failed,
                                        total: summary.total,
                                    })}
                                </p>
                            </Alert>
                        </div>
                    )}
                    <DataTable
                        caption={t('products.bulkEditor.previewCaption')}
                        columns={columns}
                        loadingLabel=""
                        minWidth="56rem"
                        rowKey={(row) => String(row.index)}
                        rows={rows}
                        empty={
                            <Alert tone="warning">
                                <p>{t('products.bulkEditor.noValidRows')}</p>
                            </Alert>
                        }
                    />
                </SectionCard>
            )}
        </div>
    );
}
