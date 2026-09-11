import type { AdminCategory } from '@/types/api';
import { slugify } from '../../categorias/slugify';

const AMOUNT_PATTERN = /^(0|[1-9]\d{0,17})$/;
const MARKETPLACE_VALUES = ['TAOBAO', 'XIANYU', 'ALIBABA', 'MAOMAOBUY'] as const;

export interface BulkImportVariantInput {
    externalId: string;
    label: string;
    amountAdjustmentMinor: string;
    isAvailable: boolean;
}

/** Corpo aceito por `POST /products` — mesmo formato de `toProductPayload`. */
export interface BulkImportProductBody {
    name: string;
    slug: string;
    description: string;
    marketplace: (typeof MARKETPLACE_VALUES)[number];
    marketplaceUrl?: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor?: string;
    stock: number;
    weightGrams?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    categoryIds?: string[];
    subcategoryIds?: string[];
    variants?: BulkImportVariantInput[];
}

export interface BulkImportPayload {
    product: BulkImportProductBody;
    /** URLs https de imagem — baixadas e enviadas ao storage depois que o produto é criado (`POST /products/:id/media/from-url`). */
    images?: string[];
}

export type BulkImportRowResult =
    | { ok: true; payload: BulkImportPayload }
    | { ok: false; error: string };

export interface BulkImportRow {
    index: number;
    /** Item original do arquivo, sem transformação — usado para reexportar os itens com falha para correção. */
    raw: unknown;
    label: string;
    result: BulkImportRowResult;
}

function toAmountMinor(value: unknown, field: string): string {
    const normalized =
        typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(Math.trunc(value)) : value;
    if (typeof normalized !== 'string' || !AMOUNT_PATTERN.test(normalized))
        throw new Error(`Campo "${field}" precisa ser um valor inteiro em centavos, ex.: "12990".`);
    return normalized;
}

function toOptionalAmountMinor(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return toAmountMinor(value, field);
}

function toInt(value: unknown, field: string, min: number): number {
    const num = typeof value === 'string' ? Number(value) : value;
    if (typeof num !== 'number' || !Number.isInteger(num) || num < min)
        throw new Error(`Campo "${field}" precisa ser um número inteiro${min > 0 ? ` maior ou igual a ${min}` : ''}.`);
    return num;
}

function toOptionalInt(value: unknown, field: string, min: number): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return toInt(value, field, min);
}

function toNonEmptyString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0)
        throw new Error(`Campo "${field}" é obrigatório.`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw new Error(`Campo "${field}" excede ${maxLength} caracteres.`);
    return trimmed;
}

function resolveCategories(
    raw: unknown,
    categories: readonly AdminCategory[],
): { categoryIds?: string[]; subcategoryIds?: string[] } {
    if (raw === undefined || raw === null) return {};
    if (!Array.isArray(raw)) throw new Error('Campo "categories" precisa ser uma lista.');
    if (raw.length > 0 && categories.length === 0)
        throw new Error('A lista de categorias não foi carregada — recarregue a página antes de analisar.');

    const categoryIds: string[] = [];
    const subcategoryIds: string[] = [];

    for (const entry of raw) {
        const entrySlug = typeof entry === 'string' ? entry : (entry as { slug?: unknown })?.slug;
        if (typeof entrySlug !== 'string')
            throw new Error('Cada item de "categories" precisa ser um slug ou { slug, subcategories }.');
        const normalized = slugify(entrySlug);
        const category = categories.find((item) => item.slug === normalized);
        if (!category) throw new Error(`Categoria "${entrySlug}" não encontrada.`);
        categoryIds.push(category.id);

        const subs = typeof entry === 'string' ? undefined : (entry as { subcategories?: unknown }).subcategories;
        if (subs === undefined) continue;
        if (!Array.isArray(subs))
            throw new Error(`Campo "categories[].subcategories" de "${entrySlug}" precisa ser uma lista.`);
        for (const subSlug of subs) {
            if (typeof subSlug !== 'string') throw new Error(`Subcategoria inválida em "${entrySlug}".`);
            const subcategory = category.subcategories.find((item) => item.slug === slugify(subSlug));
            if (!subcategory) throw new Error(`Subcategoria "${subSlug}" não encontrada em "${entrySlug}".`);
            subcategoryIds.push(subcategory.id);
        }
    }

    return {
        categoryIds: categoryIds.length > 0 ? Array.from(new Set(categoryIds)) : undefined,
        subcategoryIds: subcategoryIds.length > 0 ? Array.from(new Set(subcategoryIds)) : undefined,
    };
}

function resolveVariants(raw: unknown): BulkImportVariantInput[] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) throw new Error('Campo "variants" precisa ser uma lista.');

    const externalIds = new Set<string>();
    const variants = raw.map((item, index): BulkImportVariantInput => {
        if (typeof item !== 'object' || item === null) throw new Error(`Variação #${index + 1} inválida.`);
        const record = item as Record<string, unknown>;
        const externalId = toNonEmptyString(record.externalId, `variants[${index}].externalId`, 160);
        if (externalIds.has(externalId))
            throw new Error(`Identificador de variação duplicado: "${externalId}".`);
        externalIds.add(externalId);
        return {
            externalId,
            label: toNonEmptyString(record.label, `variants[${index}].label`, 200),
            amountAdjustmentMinor: toAmountMinor(
                record.amountAdjustmentMinor ?? '0',
                `variants[${index}].amountAdjustmentMinor`,
            ),
            isAvailable: record.isAvailable === undefined ? true : Boolean(record.isAvailable),
        };
    });
    return variants.length > 0 ? variants : undefined;
}

function resolveImages(raw: unknown): string[] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) throw new Error('Campo "images" precisa ser uma lista de URLs.');
    if (raw.length > 10) throw new Error('No máximo 10 imagens por produto.');

    const urls = raw.map((item, index) => {
        if (typeof item !== 'string' || item.trim().length === 0)
            throw new Error(`Campo "images[${index}]" precisa ser uma URL.`);
        const url = item.trim();
        if (!/^https:\/\//.test(url)) throw new Error(`Campo "images[${index}]" precisa começar com https://.`);
        if (url.length > 2048) throw new Error(`Campo "images[${index}]" excede 2048 caracteres.`);
        return url;
    });
    return urls.length > 0 ? urls : undefined;
}

function parseItem(raw: unknown, categories: readonly AdminCategory[]): BulkImportPayload {
    if (typeof raw !== 'object' || raw === null) throw new Error('Cada produto precisa ser um objeto JSON.');
    const record = raw as Record<string, unknown>;

    const name = toNonEmptyString(record.name, 'name', 300);
    const slugSource = typeof record.slug === 'string' && record.slug.trim() ? record.slug : name;
    const slug = slugify(slugSource);
    if (!slug) throw new Error('Não foi possível gerar um slug válido — informe "slug" ou "name".');

    const description = toNonEmptyString(record.description, 'description', 20_000);

    if (typeof record.marketplace !== 'string' || !MARKETPLACE_VALUES.includes(record.marketplace as never))
        throw new Error('Campo "marketplace" precisa ser TAOBAO, XIANYU, ALIBABA ou MAOMAOBUY.');
    const marketplace = record.marketplace as (typeof MARKETPLACE_VALUES)[number];
    const isOwnStock = marketplace === 'MAOMAOBUY';

    let marketplaceUrl: string | undefined;
    if (!isOwnStock) {
        marketplaceUrl = toNonEmptyString(record.marketplaceUrl, 'marketplaceUrl', 2048);
        if (!/^https:\/\//.test(marketplaceUrl))
            throw new Error('Campo "marketplaceUrl" precisa começar com https:// (obrigatório fora de MAOMAOBUY).');
    }

    return {
        product: {
            name,
            slug,
            description,
            marketplace,
            marketplaceUrl,
            sourceAmountMinor: toAmountMinor(record.sourceAmountMinor, 'sourceAmountMinor'),
            estimatedShippingAmountMinor: toOptionalAmountMinor(
                record.estimatedShippingAmountMinor,
                'estimatedShippingAmountMinor',
            ),
            stock: toInt(record.stock, 'stock', 0),
            weightGrams: toOptionalInt(record.weightGrams, 'weightGrams', 1),
            lengthMm: toOptionalInt(record.lengthMm, 'lengthMm', 1),
            widthMm: toOptionalInt(record.widthMm, 'widthMm', 1),
            heightMm: toOptionalInt(record.heightMm, 'heightMm', 1),
            ...resolveCategories(record.categories, categories),
            variants: resolveVariants(record.variants),
        },
        images: resolveImages(record.images),
    };
}

/**
 * Lê o JSON colado/enviado pelo admin e valida cada item contra as mesmas
 * regras do backend, resolvendo slugs de categoria/subcategoria para os IDs
 * que `POST /products` espera. Erros ficam por item — um produto inválido não
 * impede a importação dos demais.
 */
export function parseBulkImportDocument(text: string, categories: readonly AdminCategory[]): BulkImportRow[] {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('invalidJson');
    }
    if (!Array.isArray(data)) throw new Error('notArray');

    const seenSlugs = new Set<string>();

    return data.map((raw, index) => {
        const fallbackLabel = `Item ${index + 1}`;
        const rawName =
            typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).name === 'string'
                ? ((raw as Record<string, unknown>).name as string)
                : undefined;
        try {
            const payload = parseItem(raw, categories);
            if (seenSlugs.has(payload.product.slug))
                throw new Error(`Slug "${payload.product.slug}" repetido dentro do próprio arquivo.`);
            seenSlugs.add(payload.product.slug);
            return { index, raw, label: payload.product.name || fallbackLabel, result: { ok: true, payload } };
        } catch (err) {
            return {
                index,
                raw,
                label: rawName ?? fallbackLabel,
                result: { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido.' },
            };
        }
    });
}
