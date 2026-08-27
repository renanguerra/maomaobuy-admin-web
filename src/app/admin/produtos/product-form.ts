'use client';

import { useCallback, useState } from 'react';
import { MARKETPLACE_NAMES, type AdminProduct } from '@/types/api';
import { slugify } from '../categorias/slugify';

export type ProductSourceType = 'MARKETPLACE' | 'MAOMAOBUY';

export interface ProductFormValues {
    sourceType: ProductSourceType;
    name: string;
    slug: string;
    description: string;
    marketplace: string;
    marketplaceUrl: string;
    sourceCurrency: string;
    sourceAmountMinor: string;
    estimatedShippingAmountMinor: string;
    stock: string;
    isPublished: boolean;
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
    sourceCurrency: 'CNY',
    sourceAmountMinor: '0',
    estimatedShippingAmountMinor: '0',
    stock: '0',
    isPublished: false,
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
        sourceCurrency: product.sourceCurrency,
        sourceAmountMinor: product.sourceAmountMinor,
        estimatedShippingAmountMinor: product.estimatedShippingAmountMinor ?? '0',
        stock: String(product.stock),
        isPublished: product.isPublished,
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
        sourceCurrency: isOwnStock ? 'BRL' : values.sourceCurrency,
        sourceAmountMinor: values.sourceAmountMinor,
        estimatedShippingAmountMinor: values.estimatedShippingAmountMinor,
        stock: Number(values.stock),
        isPublished: values.isPublished,
        categoryIds: values.categoryIds,
        subcategoryIds: values.subcategoryIds,
    };
}
