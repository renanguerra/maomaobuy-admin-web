import type { AdminCategory } from '@/types/api';
import { slugify } from '../../categorias/slugify';
import {
    MARKETPLACE_VALUES,
    resolveCategories,
    toAmountMinor,
    toInt,
    toNonEmptyString,
    toOptionalAmountMinor,
    toOptionalInt,
    type MarketplaceValue,
} from '../product-bulk-shared';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BulkEditVariantInput {
    externalId: string;
    /** `true` remove a variação existente — os demais campos são ignorados. */
    remove?: boolean;
    label?: string;
    amountAdjustmentMinor?: string;
    isAvailable?: boolean;
}

/** Corpo aceito por `PATCH /products/:id` — mesmo formato de `toProductPayload`, mais o `id` do produto a editar. */
export interface BulkEditProductBody {
    id: string;
    name: string;
    slug: string;
    description: string;
    marketplace: MarketplaceValue;
    marketplaceUrl?: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor?: string;
    stock: number;
    weightGrams?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    isPublished: boolean;
    isPreSale: boolean;
    releaseDate?: string;
    categoryIds?: string[];
    subcategoryIds?: string[];
    /** `undefined` = arquivo não trouxe o campo, variações existentes não são tocadas. */
    variants?: BulkEditVariantInput[];
}

export type BulkEditRowResult = { ok: true; edit: BulkEditProductBody } | { ok: false; error: string };

export interface BulkEditRow {
    index: number;
    /** Item original do arquivo — reexportado para os itens com falha corrigirem e reenviarem. */
    raw: unknown;
    label: string;
    result: BulkEditRowResult;
}

function resolveEditVariants(raw: unknown): BulkEditVariantInput[] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) throw new Error('Campo "variants" precisa ser uma lista.');

    const externalIds = new Set<string>();
    const variants = raw.map((item, index): BulkEditVariantInput => {
        if (typeof item !== 'object' || item === null) throw new Error(`Variação #${index + 1} inválida.`);
        const record = item as Record<string, unknown>;
        const externalId = toNonEmptyString(record.externalId, `variants[${index}].externalId`, 160);
        if (externalIds.has(externalId)) throw new Error(`Identificador de variação duplicado: "${externalId}".`);
        externalIds.add(externalId);

        if (record.remove === true) return { externalId, remove: true };

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

function parseEditItem(raw: unknown, categories: readonly AdminCategory[]): BulkEditProductBody {
    if (typeof raw !== 'object' || raw === null) throw new Error('Cada produto precisa ser um objeto JSON.');
    const record = raw as Record<string, unknown>;

    if (typeof record.id !== 'string' || !UUID_PATTERN.test(record.id.trim()))
        throw new Error('Campo "id" precisa ser o UUID do produto (veja o arquivo exportado).');
    const id = record.id.trim();

    const name = toNonEmptyString(record.name, 'name', 300);
    const slugSource = typeof record.slug === 'string' && record.slug.trim() ? record.slug : name;
    const slug = slugify(slugSource);
    if (!slug) throw new Error('Não foi possível gerar um slug válido — informe "slug" ou "name".');

    const description = toNonEmptyString(record.description, 'description', 20_000);

    if (typeof record.marketplace !== 'string' || !MARKETPLACE_VALUES.includes(record.marketplace as never))
        throw new Error('Campo "marketplace" precisa ser TAOBAO, XIANYU, ALIBABA ou MAOMAOBUY.');
    const marketplace = record.marketplace as MarketplaceValue;
    const isOwnStock = marketplace === 'MAOMAOBUY';

    let marketplaceUrl: string | undefined;
    if (!isOwnStock) {
        marketplaceUrl = toNonEmptyString(record.marketplaceUrl, 'marketplaceUrl', 2048);
        if (!/^https:\/\//.test(marketplaceUrl))
            throw new Error('Campo "marketplaceUrl" precisa começar com https:// (obrigatório fora de MAOMAOBUY).');
    }

    const isPreSale = Boolean(record.isPreSale);
    let releaseDate: string | undefined;
    if (isPreSale) {
        if (typeof record.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.releaseDate))
            throw new Error('Campo "releaseDate" (formato YYYY-MM-DD) é obrigatório quando "isPreSale" é true.');
        releaseDate = record.releaseDate;
    }

    return {
        id,
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
        isPublished: Boolean(record.isPublished),
        isPreSale,
        releaseDate,
        ...resolveCategories(record.categories, categories),
        variants: resolveEditVariants(record.variants),
    };
}

/**
 * Lê o JSON exportado (e editado à mão) pelo admin. Cada produto precisa
 * trazer o `id` do arquivo exportado — o resto dos campos é o mesmo corpo que
 * `PATCH /products/:id` já aceita. Variações omitidas do arquivo não são
 * tocadas; para remover uma existente, o item precisa vir com
 * `{ "externalId": "...", "remove": true }`. Erros ficam por item, igual à
 * importação: um produto inválido não impede os demais.
 */
export function parseBulkEditDocument(text: string, categories: readonly AdminCategory[]): BulkEditRow[] {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('invalidJson');
    }
    if (!Array.isArray(data)) throw new Error('notArray');

    const seenIds = new Set<string>();

    return data.map((raw, index) => {
        const fallbackLabel = `Item ${index + 1}`;
        const rawName =
            typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).name === 'string'
                ? ((raw as Record<string, unknown>).name as string)
                : undefined;
        try {
            const edit = parseEditItem(raw, categories);
            if (seenIds.has(edit.id)) throw new Error(`Produto "${edit.id}" repetido dentro do próprio arquivo.`);
            seenIds.add(edit.id);
            return { index, raw, label: edit.name || fallbackLabel, result: { ok: true, edit } };
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
