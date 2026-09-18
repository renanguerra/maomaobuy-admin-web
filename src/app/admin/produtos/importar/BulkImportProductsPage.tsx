'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileJson, Upload, XCircle } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminProduct } from '@/types/api';
import { money } from '@/types/api';
import { parseBulkImportDocument, type BulkImportRow } from './bulk-import-parser';

const TEMPLATE = [
    {
        name: 'Camiseta MaoMao',
        slug: 'camiseta-maomao',
        description: 'Descrição completa do produto.',
        marketplace: 'TAOBAO',
        marketplaceUrl: 'https://item.taobao.com/item.htm?id=123456',
        sourceAmountMinor: '12990',
        estimatedShippingAmountMinor: '4990',
        stock: 25,
        weightGrams: 1200,
        lengthMm: 250,
        widthMm: 180,
        heightMm: 120,
        categories: [{ slug: 'roupas', subcategories: ['camisetas'] }],
        variants: [
            { externalId: 'azul-p', label: 'Azul, P', amountAdjustmentMinor: '0', isAvailable: true },
            { externalId: 'azul-m', label: 'Azul, M', amountAdjustmentMinor: '0', isAvailable: true },
        ],
        images: ['https://cdn.exemplo.com/produto/foto-1.jpg', 'https://cdn.exemplo.com/produto/foto-2.jpg'],
    },
    {
        name: 'Produto de estoque próprio',
        marketplace: 'MAOMAOBUY',
        description: 'Vendido direto pela MaoMaoBuy, sem link de origem.',
        sourceAmountMinor: '5000',
        stock: 10,
    },
];

type Outcome =
    | { status: 'pending' }
    | { status: 'success'; productId: string; imagesTotal: number; imagesImported: number }
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

/**
 * Importação em massa via JSON. Cada item passa pelas mesmas validações do
 * formulário de novo produto (mesmo `POST /products`); a única diferença é
 * que categorias/subcategorias são referenciadas por slug, não por UUID, já
 * que ninguém escreve um JSON à mão sabendo o ID de uma categoria.
 *
 * Produtos entram sempre como rascunho — sem mídia no lote, publicar de
 * primeira deixaria itens sem foto na loja.
 */
export function BulkImportProductsPage() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [categoriesState, setCategoriesState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [jsonText, setJsonText] = useState('');
    const [rows, setRows] = useState<BulkImportRow[]>();
    const [parseError, setParseError] = useState<string>();
    const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /*
     * A análise resolve slug -> id contra esta lista, então analisar antes de
     * ela chegar acusa "Categoria X não encontrada" em todo item que referencia
     * categoria — erro que aponta para o JSON quando a culpa é do carregamento.
     * Por isso o estado é explícito e o botão de analisar espera por ele.
     */
    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then((loaded) => {
                setCategories(loaded);
                setCategoriesState('ready');
            })
            .catch(() => setCategoriesState('error'));
    }, []);

    function handleParse() {
        setOutcomes({});
        try {
            const parsed = parseBulkImportDocument(jsonText, categories);
            setRows(parsed);
            setParseError(undefined);
        } catch (err) {
            setRows(undefined);
            const key = err instanceof Error ? err.message : '';
            setParseError(
                key === 'invalidJson' || key === 'notArray'
                    ? t(`products.bulkImport.${key}`)
                    : t('products.bulkImport.invalidJson'),
            );
        }
    }

    function handleFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => setJsonText(String(reader.result ?? ''));
        reader.onerror = () => setParseError(t('products.bulkImport.fileReadError'));
        reader.readAsText(file);
    }

    async function handleImport() {
        if (!rows) return;
        const pending = rows.filter((row) => row.result.ok);
        setImporting(true);
        setOutcomes(Object.fromEntries(pending.map((row) => [row.index, { status: 'pending' as const }])));

        for (const row of pending) {
            if (!row.result.ok) continue;
            const { product, images = [] } = row.result.payload;
            try {
                const created = await api<AdminProduct>('/products', {
                    method: 'POST',
                    body: JSON.stringify({ ...product, isPublished: false }),
                });
                setOutcomes((current) => ({
                    ...current,
                    [row.index]: {
                        status: 'success',
                        productId: created.id,
                        imagesTotal: images.length,
                        imagesImported: 0,
                    },
                }));

                let imagesImported = 0;
                for (const [sortOrder, url] of images.entries()) {
                    try {
                        await api(`/products/${created.id}/media/from-url`, {
                            method: 'POST',
                            body: JSON.stringify({ url, sortOrder }),
                        });
                        imagesImported += 1;
                    } catch {
                        // Uma foto com URL quebrada não derruba o produto — ele já
                        // foi criado; o admin sobe a foto manualmente depois.
                    }
                    setOutcomes((current) => ({ ...current, [row.index]: { ...current[row.index], imagesImported } }));
                }
            } catch (err) {
                setOutcomes((current) => ({
                    ...current,
                    [row.index]: {
                        status: 'error',
                        message: err instanceof ApiError ? err.message : t('common.errors.generic'),
                    },
                }));
            }
        }

        setImporting(false);
    }

    const validCount = rows?.filter((row) => row.result.ok).length ?? 0;
    const summary = useMemo(() => {
        const values = Object.values(outcomes);
        if (values.length === 0) return undefined;
        const success = values.filter((item) => item.status === 'success').length;
        const failed = values.filter((item) => item.status === 'error').length;
        if (success + failed < values.length) return undefined;
        return { success, failed, total: rows?.length ?? values.length };
    }, [outcomes, rows]);

    function downloadFailedItems() {
        if (!rows) return;
        const failedRaw = rows
            .filter((row) => !row.result.ok || outcomes[row.index]?.status === 'error')
            .map((row) => row.raw);
        downloadJson('produtos-com-falha.json', failedRaw);
    }

    const columns: DataTableColumn<BulkImportRow>[] = [
        {
            key: 'item',
            header: t('products.bulkImport.columns.item'),
            cell: (row) => <span className="font-semibold text-ink dark:text-night-text">{row.label}</span>,
        },
        {
            key: 'marketplace',
            header: t('products.bulkImport.columns.marketplace'),
            hideBelow: 'md',
            cell: (row) => (row.result.ok ? row.result.payload.product.marketplace : t('common.dash')),
        },
        {
            key: 'price',
            header: t('products.bulkImport.columns.price'),
            numeric: true,
            hideBelow: 'md',
            cell: (row) =>
                row.result.ok ? money(row.result.payload.product.sourceAmountMinor, 'CNY') : t('common.dash'),
        },
        {
            key: 'stock',
            header: t('products.bulkImport.columns.stock'),
            numeric: true,
            hideBelow: 'lg',
            cell: (row) => (row.result.ok ? row.result.payload.product.stock : t('common.dash')),
        },
        {
            key: 'status',
            header: t('products.bulkImport.columns.status'),
            cell: (row) => {
                const outcome = outcomes[row.index];
                if (!row.result.ok)
                    return (
                        <span className="grid gap-1">
                            <StatusPill tone="danger">{t('products.bulkImport.failedStatus')}</StatusPill>
                            <span className="text-xs text-muted dark:text-night-muted">{row.result.error}</span>
                        </span>
                    );
                if (!outcome) return <StatusPill tone="neutral">{t('products.bulkImport.validRow')}</StatusPill>;
                if (outcome.status === 'pending')
                    return <StatusPill tone="info">{t('products.bulkImport.pendingStatus')}</StatusPill>;
                if (outcome.status === 'success')
                    return (
                        <span className="grid gap-1">
                            <StatusPill tone="success">{t('products.bulkImport.importedStatus')}</StatusPill>
                            {outcome.imagesTotal > 0 && (
                                <span className="text-xs text-muted dark:text-night-muted">
                                    {t('products.bulkImport.imagesStatus', {
                                        imported: outcome.imagesImported,
                                        total: outcome.imagesTotal,
                                    })}
                                </span>
                            )}
                            <Link
                                className="text-xs font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                                href={`/admin/produtos/${outcome.productId}`}
                            >
                                {t('products.bulkImport.viewProductLink')}
                            </Link>
                        </span>
                    );
                return (
                    <span className="grid gap-1">
                        <StatusPill tone="danger">{t('products.bulkImport.failedStatus')}</StatusPill>
                        <span className="text-xs text-muted dark:text-night-muted">{outcome.message}</span>
                    </span>
                );
            },
        },
    ];

    const hasFailures =
        Object.values(outcomes).some((item) => item.status === 'error') ||
        (rows?.some((row) => !row.result.ok) ?? false);

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/produtos"
                backLabel={t('products.bulkImport.backLink')}
                description={t('products.bulkImport.description')}
                kicker={t('products.bulkImport.kicker')}
                title={t('products.bulkImport.title')}
            />

            <Alert title={t('products.bulkImport.schemaHelp.title')}>
                <p>{t('products.bulkImport.schemaHelp.description')}</p>
            </Alert>

            <SectionCard
                title={t('products.bulkImport.textareaLabel')}
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
                            {t('products.bulkImport.uploadButton')}
                        </Button>
                        <Button
                            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => downloadJson('modelo-importacao-produtos.json', TEMPLATE)}
                            size="small"
                            type="button"
                            variant="ghost"
                        >
                            {t('products.bulkImport.downloadTemplateButton')}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4">
                    <Textarea
                        className="min-h-64 font-mono text-xs"
                        hideLabel
                        label={t('products.bulkImport.textareaLabel')}
                        onChange={(event) => setJsonText(event.target.value)}
                        placeholder={t('products.bulkImport.textareaPlaceholder')}
                        rows={14}
                        value={jsonText}
                    />

                    {categoriesState === 'error' && (
                        <Alert tone="danger">
                            <p>{t('products.bulkImport.categoriesLoadError')}</p>
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
                            {t('products.bulkImport.parseButton')}
                        </Button>
                    </div>
                </div>
            </SectionCard>

            {rows && (
                <SectionCard
                    flush
                    title={t('products.bulkImport.previewTitle')}
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
                                    {t('products.bulkImport.downloadFailedButton')}
                                </Button>
                            )}
                            <Button
                                disabled={validCount === 0}
                                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                loading={importing}
                                onClick={handleImport}
                                size="small"
                                type="button"
                            >
                                {importing
                                    ? t('products.bulkImport.importingButton')
                                    : t('products.bulkImport.importButton', { count: validCount })}
                            </Button>
                        </>
                    }
                >
                    {summary && (
                        <div className="border-b border-line p-4 dark:border-night-line">
                            <Alert tone={summary.failed > 0 ? 'warning' : 'success'}>
                                <p>
                                    {t('products.bulkImport.summary', {
                                        success: summary.success,
                                        failed: summary.failed,
                                        total: summary.total,
                                    })}
                                </p>
                            </Alert>
                        </div>
                    )}
                    <DataTable
                        caption={t('products.bulkImport.previewCaption')}
                        columns={columns}
                        loadingLabel=""
                        minWidth="48rem"
                        rowKey={(row) => String(row.index)}
                        rows={rows}
                        empty={
                            <Alert tone="warning">
                                <p>{t('products.bulkImport.noValidRows')}</p>
                            </Alert>
                        }
                    />
                </SectionCard>
            )}
        </div>
    );
}
