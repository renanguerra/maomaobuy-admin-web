import type { AdminCategory, ProductSalesChannel } from '@/types/api';
import { slugify } from '../../categorias/slugify';
import {
    resolveCategories,
    resolveChinaExclusive,
    toAmountMinor,
    toInt,
    toNonEmptyString,
    toOptionalAmountMinor,
    toNullableAmountMinor,
    toOptionalInt,
} from '../product-bulk-shared';

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
    sourceAmountMinor: string;
    estimatedShippingAmountMinor?: string;
    /** Custo unitário em fen, só no painel. */
    costAmountMinor?: string | null;
    stock: number;
    /** Selo "Exclusivo da China" no card da loja. */
    isChinaExclusive: boolean;
    weightGrams?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    /** Varejo (padrão), só atacado (caixa master, só lojista vê) ou os dois. */
    salesChannel?: ProductSalesChannel;
    /** Em fen: da caixa no só atacado, da unidade nos dois canais. */
    wholesaleAmountMinor?: string | null;
    wholesaleMinQuantity?: number | null;
    unitsPerPackage?: number | null;
    categoryIds?: string[];
    subcategoryIds?: string[];
    variants?: BulkImportVariantInput[];
}

export interface BulkImportPayload {
    product: BulkImportProductBody;
    /** Publicar depois de criado e de as fotos subirem. Ausente = rascunho. */
    publish: boolean;
    /** URLs https de imagem — baixadas e enviadas ao storage depois que o produto é criado (`POST /products/:id/media/from-url`). */
    images?: string[];
}

export type BulkImportRowResult = { ok: true; payload: BulkImportPayload } | { ok: false; error: string };

export interface BulkImportRow {
    index: number;
    /** Item original do arquivo, sem transformação — usado para reexportar os itens com falha para correção. */
    raw: unknown;
    label: string;
    result: BulkImportRowResult;
}

function resolveVariants(raw: unknown): BulkImportVariantInput[] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) throw new Error('Campo "variants" precisa ser uma lista.');

    const externalIds = new Set<string>();
    const variants = raw.map((item, index): BulkImportVariantInput => {
        if (typeof item !== 'object' || item === null) throw new Error(`Variação #${index + 1} inválida.`);
        const record = item as Record<string, unknown>;
        const externalId = toNonEmptyString(record.externalId, `variants[${index}].externalId`, 160);
        if (externalIds.has(externalId)) throw new Error(`Identificador de variação duplicado: "${externalId}".`);
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

const SALES_CHANNELS: readonly ProductSalesChannel[] = ['RETAIL_ONLY', 'WHOLESALE_ONLY', 'BOTH'];

/**
 * Canal e termos de atacado, com as mesmas regras do backend: só varejo não
 * leva preço de atacado; só atacado é a caixa (sem mínimo); os dois canais
 * exigem o mínimo. Ausente = varejo.
 */
function resolveSalesChannel(
    record: Record<string, unknown>,
): Pick<BulkImportProductBody, 'salesChannel' | 'wholesaleAmountMinor' | 'wholesaleMinQuantity' | 'unitsPerPackage'> {
    const raw = record.salesChannel ?? 'RETAIL_ONLY';
    if (typeof raw !== 'string' || !SALES_CHANNELS.includes(raw as ProductSalesChannel))
        throw new Error('Campo "salesChannel" precisa ser RETAIL_ONLY, WHOLESALE_ONLY ou BOTH.');
    const salesChannel = raw as ProductSalesChannel;
    const unitsPerPackage = toOptionalInt(record.unitsPerPackage, 'unitsPerPackage', 1) ?? null;

    if (salesChannel === 'RETAIL_ONLY')
        return { salesChannel, wholesaleAmountMinor: null, wholesaleMinQuantity: null, unitsPerPackage };

    const wholesaleAmountMinor = toOptionalAmountMinor(record.wholesaleAmountMinor, 'wholesaleAmountMinor');
    if (!wholesaleAmountMinor || wholesaleAmountMinor === '0')
        throw new Error('Produto vendido no atacado precisa de "wholesaleAmountMinor" maior que zero.');

    if (salesChannel === 'WHOLESALE_ONLY')
        return { salesChannel, wholesaleAmountMinor, wholesaleMinQuantity: null, unitsPerPackage };

    const wholesaleMinQuantity = toOptionalInt(record.wholesaleMinQuantity, 'wholesaleMinQuantity', 1);
    if (wholesaleMinQuantity === undefined)
        throw new Error('Produto nos dois canais precisa de "wholesaleMinQuantity".');
    return { salesChannel, wholesaleAmountMinor, wholesaleMinQuantity, unitsPerPackage };
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

    const { name, isChinaExclusive } = resolveChinaExclusive(
        toNonEmptyString(record.name, 'name', 300),
        record.isChinaExclusive,
    );
    if (!name) throw new Error('Campo "name" ficou vazio depois de tirar o prefixo "EXCLUSIVO".');
    const slugSource = typeof record.slug === 'string' && record.slug.trim() ? record.slug : name;
    const slug = slugify(slugSource);
    if (!slug) throw new Error('Não foi possível gerar um slug válido — informe "slug" ou "name".');

    const description = toNonEmptyString(record.description, 'description', 20_000);
    if (record.isPublished !== undefined && typeof record.isPublished !== 'boolean')
        throw new Error('Campo "isPublished" precisa ser true ou false.');

    return {
        product: {
            name,
            slug,
            description,
            sourceAmountMinor: toAmountMinor(record.sourceAmountMinor, 'sourceAmountMinor'),
            estimatedShippingAmountMinor: toOptionalAmountMinor(
                record.estimatedShippingAmountMinor,
                'estimatedShippingAmountMinor',
            ),
            costAmountMinor: toNullableAmountMinor(record.costAmountMinor, 'costAmountMinor'),
            stock: toInt(record.stock, 'stock', 0),
            isChinaExclusive: isChinaExclusive ?? false,
            weightGrams: toOptionalInt(record.weightGrams, 'weightGrams', 1),
            lengthMm: toOptionalInt(record.lengthMm, 'lengthMm', 1),
            widthMm: toOptionalInt(record.widthMm, 'widthMm', 1),
            heightMm: toOptionalInt(record.heightMm, 'heightMm', 1),
            ...resolveSalesChannel(record),
            ...resolveCategories(record.categories, categories),
            variants: resolveVariants(record.variants),
        },
        images: resolveImages(record.images),
        publish: record.isPublished === true,
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
