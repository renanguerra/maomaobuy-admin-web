'use client';

import { useCallback, useState } from 'react';
import type { AdminProduct, ProductKind } from '@/types/api';
import { slugify } from '../categorias/slugify';

/** Prazo sugerido ao marcar "sob demanda" — o mesmo padrão do backend. */
export const DEFAULT_ON_DEMAND_LEAD_DAYS = 4;

export interface ProductFormValues {
    /** Fixo: vem da tela (criação) ou do produto (edição). */
    kind: ProductKind;
    name: string;
    slug: string;
    description: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor: string;
    /** Custo unitário em fen; "0" = ainda não cadastrado. */
    costAmountMinor: string;
    stock: string;
    isPublished: boolean;
    isChinaExclusive: boolean;
    isPreSale: boolean;
    /** `YYYY-MM-DD`, como o `<input type="date">` entrega e o backend espera. */
    releaseDate: string;
    isOnDemand: boolean;
    /** Dias até o armazém; string porque vem de um `<input type="number">`. */
    onDemandLeadDays: string;
    /** Coin Shop. Strings porque vêm de inputs; vazio = sem valor. */
    coinPrice: string;
    coinRedeemLimitPerUser: string;
    /** `YYYY-MM-DDTHH:mm`, como o `<input type="datetime-local">` entrega. */
    coinAvailableFrom: string;
    coinAvailableUntil: string;
    /** Peso embalado em gramas — obrigatório no "Leve junto". */
    weightGrams: string;
    categoryIds: string[];
    subcategoryIds: string[];
}

const EMPTY: ProductFormValues = {
    kind: 'STORE',
    name: '',
    slug: '',
    description: '',
    sourceAmountMinor: '0',
    estimatedShippingAmountMinor: '0',
    costAmountMinor: '0',
    stock: '0',
    isPublished: false,
    isChinaExclusive: false,
    isPreSale: false,
    releaseDate: '',
    isOnDemand: false,
    onDemandLeadDays: String(DEFAULT_ON_DEMAND_LEAD_DAYS),
    coinPrice: '',
    coinRedeemLimitPerUser: '',
    coinAvailableFrom: '',
    coinAvailableUntil: '',
    weightGrams: '',
    categoryIds: [],
    subcategoryIds: [],
};

function fromProduct(product: AdminProduct): ProductFormValues {
    return {
        kind: product.kind,
        name: product.name,
        slug: product.slug,
        description: product.description,
        sourceAmountMinor: product.sourceAmountMinor,
        estimatedShippingAmountMinor: product.estimatedShippingAmountMinor ?? '0',
        costAmountMinor: product.costAmountMinor ?? '0',
        stock: String(product.stock),
        isPublished: product.isPublished,
        isChinaExclusive: product.isChinaExclusive ?? false,
        isPreSale: product.isPreSale,
        releaseDate: product.releaseDate ?? '',
        isOnDemand: product.isOnDemand,
        onDemandLeadDays: String(product.onDemandLeadDays ?? DEFAULT_ON_DEMAND_LEAD_DAYS),
        coinPrice: product.coinPrice ? String(product.coinPrice) : '',
        coinRedeemLimitPerUser: product.coinRedeemLimitPerUser ? String(product.coinRedeemLimitPerUser) : '',
        coinAvailableFrom: toLocalInput(product.coinAvailableFrom),
        coinAvailableUntil: toLocalInput(product.coinAvailableUntil),
        weightGrams: product.weightGrams ? String(product.weightGrams) : '',
        categoryIds: product.categories.map((category) => category.id),
        subcategoryIds: product.subcategories.map((subcategory) => subcategory.id),
    };
}

/**
 * Estado compartilhado entre criar e editar produto — os dois formulários têm
 * exatamente os mesmos campos, e duplicá-los já custou divergência entre as
 * duas telas no passado.
 */
export function useProductForm(product?: AdminProduct, kind: ProductKind = 'STORE') {
    const [values, setValues] = useState<ProductFormValues>(product ? fromProduct(product) : { ...EMPTY, kind });
    // Enquanto o admin não editar o slug, ele acompanha o nome. Em produto já
    // existente o slug nunca é derivado sozinho: mudá-lo quebra links publicados.
    const [slugTouched, setSlugTouched] = useState(Boolean(product));

    const patch = useCallback((next: Partial<ProductFormValues>) => {
        setValues((current) => ({ ...current, ...next }));
    }, []);

    const setName = useCallback(
        (name: string) => {
            setValues((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
        },
        [slugTouched],
    );

    const setSlug = useCallback((slug: string) => {
        setSlugTouched(true);
        setValues((current) => ({ ...current, slug: slugify(slug) }));
    }, []);

    const toggleCategory = useCallback((id: string) => {
        setValues((current) => ({
            ...current,
            categoryIds: current.categoryIds.includes(id)
                ? current.categoryIds.filter((value) => value !== id)
                : [...current.categoryIds, id],
        }));
    }, []);

    const toggleSubcategory = useCallback((id: string) => {
        setValues((current) => ({
            ...current,
            subcategoryIds: current.subcategoryIds.includes(id)
                ? current.subcategoryIds.filter((value) => value !== id)
                : [...current.subcategoryIds, id],
        }));
    }, []);

    const reset = useCallback((next: AdminProduct) => {
        setValues(fromProduct(next));
        setSlugTouched(true);
    }, []);

    return { values, patch, setName, setSlug, toggleCategory, toggleSubcategory, reset };
}

export type ProductForm = ReturnType<typeof useProductForm>;

/**
 * Corpo aceito pelo backend em `POST /products` e `PATCH /products/:id`. O
 * tipo não vai aqui: só a criação o manda, e ele não muda depois.
 */
export function toProductPayload(values: ProductFormValues) {
    const isStore = values.kind === 'STORE';
    const isCoinShop = values.kind === 'COIN_SHOP';
    return {
        name: values.name,
        slug: values.slug,
        description: values.description,
        sourceAmountMinor: values.sourceAmountMinor,
        estimatedShippingAmountMinor: values.estimatedShippingAmountMinor,
        // O campo de valor não fica vazio; zero quer dizer "ainda não sei" e
        // vai como `null`, para o relatório de lucro avisar em vez de somar zero.
        costAmountMinor: values.costAmountMinor !== '0' ? values.costAmountMinor : null,
        stock: Number(values.stock),
        isPublished: values.isPublished,
        isChinaExclusive: values.isChinaExclusive,
        // Pré-venda e sob demanda são só da loja: Coin Shop e "Leve junto"
        // precisam do item pronto no armazém.
        isPreSale: isStore && values.isPreSale,
        // Fora da pré-venda a data não é enviada em branco: o backend recusa
        // string vazia e apaga a data sozinho quando a pré-venda cai.
        releaseDate: isStore && values.isPreSale ? values.releaseDate : undefined,
        isOnDemand: isStore && values.isOnDemand,
        onDemandLeadDays: isStore && values.isOnDemand ? Number(values.onDemandLeadDays) : undefined,
        // Moedas só na Coin Shop; nos outros tipos `null` (o backend recusa valor).
        coinPrice: isCoinShop && values.coinPrice ? Number(values.coinPrice) : null,
        coinRedeemLimitPerUser:
            isCoinShop && values.coinRedeemLimitPerUser ? Number(values.coinRedeemLimitPerUser) : null,
        coinAvailableFrom: isCoinShop ? fromLocalInput(values.coinAvailableFrom) : null,
        coinAvailableUntil: isCoinShop ? fromLocalInput(values.coinAvailableUntil) : null,
        // Vazio não apaga um peso que veio da importação em lote.
        weightGrams: values.weightGrams ? Number(values.weightGrams) : undefined,
        categoryIds: values.categoryIds,
        subcategoryIds: values.subcategoryIds,
    };
}

/** ISO do backend → valor de `<input type="datetime-local">`, no fuso do navegador. */
function toLocalInput(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

/** Valor do `datetime-local` (hora local) → ISO com fuso; vazio vira `null`. */
function fromLocalInput(value: string): string | null {
    return value ? new Date(value).toISOString() : null;
}
