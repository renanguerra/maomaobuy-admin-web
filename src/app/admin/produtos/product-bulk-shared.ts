import type { AdminCategory } from '@/types/api';
import { slugify } from '../categorias/slugify';

export const AMOUNT_PATTERN = /^(0|[1-9]\d{0,17})$/;
export const MARKETPLACE_VALUES = ['TAOBAO', 'XIANYU', 'ALIBABA', 'MAOMAOBUY'] as const;
export type MarketplaceValue = (typeof MARKETPLACE_VALUES)[number];

/**
 * Validações e resolução de categoria compartilhadas entre a importação em
 * lote (`produtos/importar`, sempre cria) e a edição em lote
 * (`produtos/editar-em-lote`, sempre atualiza um `id` existente) — os dois
 * aceitam o mesmo corpo de produto, só muda o que fazem com ele.
 */
export function toAmountMinor(value: unknown, field: string): string {
    const normalized =
        typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(Math.trunc(value)) : value;
    if (typeof normalized !== 'string' || !AMOUNT_PATTERN.test(normalized))
        throw new Error(`Campo "${field}" precisa ser um valor inteiro em centavos, ex.: "12990".`);
    return normalized;
}

export function toOptionalAmountMinor(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return toAmountMinor(value, field);
}

/**
 * Custo do produto nos arquivos em lote: ausente não mexe, `null` apaga,
 * valor em fen grava.
 */
export function toNullableAmountMinor(value: unknown, field: string): string | null | undefined {
    if (value === undefined || value === '') return undefined;
    if (value === null) return null;
    return toAmountMinor(value, field);
}

export function toInt(value: unknown, field: string, min: number): number {
    const num = typeof value === 'string' ? Number(value) : value;
    if (typeof num !== 'number' || !Number.isInteger(num) || num < min)
        throw new Error(`Campo "${field}" precisa ser um número inteiro${min > 0 ? ` maior ou igual a ${min}` : ''}.`);
    return num;
}

export function toOptionalInt(value: unknown, field: string, min: number): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return toInt(value, field, min);
}

export function toNonEmptyString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Campo "${field}" é obrigatório.`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw new Error(`Campo "${field}" excede ${maxLength} caracteres.`);
    return trimmed;
}

const CHINA_PREFIX = /^\s*EXCLUSIVO(?:\s+CHINA)?\s*[-–—:]\s*/i;
const JAPAN_PREFIX = /^\s*EXCLUSIVO\s+JAP[ÃA]O\s*[-–—:]\s*/i;

/**
 * "Exclusivo da China" é campo do produto, não prefixo do nome. Arquivos
 * antigos ainda trazem "EXCLUSIVO - …" / "EXCLUSIVO CHINA - …": o prefixo sai
 * do nome e marca o campo. "EXCLUSIVO JAPÃO - …" só perde o prefixo. Sem
 * prefixo, vale o `isChinaExclusive` do arquivo (`undefined` = não informado).
 */
export function resolveChinaExclusive(
    name: string,
    raw: unknown,
): { name: string; isChinaExclusive: boolean | undefined } {
    if (raw !== undefined && raw !== null && typeof raw !== 'boolean')
        throw new Error('Campo "isChinaExclusive" precisa ser true ou false.');
    const explicit = typeof raw === 'boolean' ? raw : undefined;
    if (CHINA_PREFIX.test(name))
        return { name: name.replace(CHINA_PREFIX, ''), isChinaExclusive: explicit ?? true };
    if (JAPAN_PREFIX.test(name)) return { name: name.replace(JAPAN_PREFIX, ''), isChinaExclusive: explicit };
    return { name, isChinaExclusive: explicit };
}

export function resolveCategories(
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
