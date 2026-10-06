'use client';

import { useCallback, useState } from 'react';
import { MARKETPLACE_NAMES, type AdminProduct } from '@/types/api';
import { slugify } from '../categorias/slugify';

/** Prazo sugerido ao marcar "sob demanda" — o mesmo padrão do backend. */
export const DEFAULT_ON_DEMAND_LEAD_DAYS = 4;

export type ProductSourceType = 'MARKETPLACE' | 'MAOMAOBUY';

export interface ProductFormValues {
    sourceType: ProductSourceType;
    name: string;
    slug: string;
    description: string;
    marketplace: string;
    marketplaceUrl: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor: string;
    /** Custo unitário em fen; "0" = ainda não cadastrado. */
    costAmountMinor: string;
    stock: string;
    isPublished: boolean;
    isPreSale: boolean;
    /** `YYYY-MM-DD`, como o `<input type="date">` entrega e o backend espera. */
    releaseDate: string;
    isOnDemand: boolean;
    /** Dias até o armazém; string porque vem de um `<input type="number">`. */
    onDemandLeadDays: string;
    /** Coin Shop. Strings porque vêm de inputs; vazio = sem valor. */
    coinPrice: string;
    isCoinExclusive: boolean;
    coinRedeemLimitPerUser: string;
    /** `YYYY-MM-DDTHH:mm`, como o `<input type="datetime-local">` entrega. */
    coinAvailableFrom: string;
    coinAvailableUntil: string;
    isCheckoutAddon: boolean;
    /** Peso embalado em gramas — obrigatório para o produto adicional. */
    weightGrams: string;
    categoryIds: string[];
    subcategoryIds: string[];
}

const EMPTY: ProductFormValues = {
    sourceType: 'MARKETPLACE',
    name: '',
    slug: '',
    description: '',
    marketplace: MARKETPLACE_NAMES[0],
    marketplaceUrl: '',
    sourceAmountMinor: '0',
    estimatedShippingAmountMinor: '0',
    costAmountMinor: '0',
    stock: '0',
    isPublished: false,
    isPreSale: false,
    releaseDate: '',
    isOnDemand: false,
    onDemandLeadDays: String(DEFAULT_ON_DEMAND_LEAD_DAYS),
    coinPrice: '',
    isCoinExclusive: false,
    coinRedeemLimitPerUser: '',
    coinAvailableFrom: '',
    coinAvailableUntil: '',
    isCheckoutAddon: false,
    weightGrams: '',
    categoryIds: [],
    subcategoryIds: [],
};

function fromProduct(product: AdminProduct): ProductFormValues {
    const isOwnStock = product.marketplace === 'MAOMAOBUY';
    return {
        sourceType: isOwnStock ? 'MAOMAOBUY' : 'MARKETPLACE',
        name: product.name,
        slug: product.slug,
        description: product.description,
        marketplace: MARKETPLACE_NAMES.includes(product.marketplace as (typeof MARKETPLACE_NAMES)[number])
            ? product.marketplace
            : MARKETPLACE_NAMES[0],
        marketplaceUrl: product.marketplaceUrl ?? '',
        sourceAmountMinor: product.sourceAmountMinor,
        estimatedShippingAmountMinor: product.estimatedShippingAmountMinor ?? '0',
        costAmountMinor: product.costAmountMinor ?? '0',
        stock: String(product.stock),
        isPublished: product.isPublished,
        isPreSale: product.isPreSale,
        releaseDate: product.releaseDate ?? '',
        isOnDemand: product.isOnDemand,
        onDemandLeadDays: String(product.onDemandLeadDays ?? DEFAULT_ON_DEMAND_LEAD_DAYS),
        coinPrice: product.coinPrice ? String(product.coinPrice) : '',
        isCoinExclusive: product.isCoinExclusive ?? false,
        coinRedeemLimitPerUser: product.coinRedeemLimitPerUser ? String(product.coinRedeemLimitPerUser) : '',
        coinAvailableFrom: toLocalInput(product.coinAvailableFrom),
        coinAvailableUntil: toLocalInput(product.coinAvailableUntil),
        isCheckoutAddon: product.isCheckoutAddon ?? false,
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
export function useProductForm(product?: AdminProduct) {
    const [values, setValues] = useState<ProductFormValues>(product ? fromProduct(product) : EMPTY);
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

/** Corpo aceito pelo backend em `POST /products` e `PATCH /products/:id`. */
export function toProductPayload(values: ProductFormValues) {
    const isOwnStock = values.sourceType === 'MAOMAOBUY';
    return {
        name: values.name,
        slug: values.slug,
        description: values.description,
        marketplace: isOwnStock ? 'MAOMAOBUY' : values.marketplace,
        marketplaceUrl: isOwnStock ? undefined : values.marketplaceUrl,
        sourceAmountMinor: values.sourceAmountMinor,
        estimatedShippingAmountMinor: values.estimatedShippingAmountMinor,
        // O campo de valor não fica vazio; zero quer dizer "ainda não sei" e
        // vai como `null`, para o relatório de lucro avisar em vez de somar zero.
        costAmountMinor: values.costAmountMinor !== '0' ? values.costAmountMinor : null,
        stock: Number(values.stock),
        isPublished: values.isPublished,
        isPreSale: values.isPreSale,
        // Fora da pré-venda a data não é enviada em branco: o backend recusa
        // string vazia e apaga a data sozinho quando a pré-venda cai.
        releaseDate: values.isPreSale ? values.releaseDate : undefined,
        isOnDemand: values.isOnDemand,
        onDemandLeadDays: values.isOnDemand ? Number(values.onDemandLeadDays) : undefined,
        // Coin Shop só vale para estoque próprio; `null` limpa o que havia.
        coinPrice: isOwnStock && values.coinPrice ? Number(values.coinPrice) : null,
        isCoinExclusive: isOwnStock && values.coinPrice !== '' && values.isCoinExclusive,
        coinRedeemLimitPerUser:
            isOwnStock && values.coinPrice && values.coinRedeemLimitPerUser
                ? Number(values.coinRedeemLimitPerUser)
                : null,
        coinAvailableFrom: isOwnStock && values.coinPrice ? fromLocalInput(values.coinAvailableFrom) : null,
        coinAvailableUntil: isOwnStock && values.coinPrice ? fromLocalInput(values.coinAvailableUntil) : null,
        isCheckoutAddon: isOwnStock && values.isCheckoutAddon,
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
