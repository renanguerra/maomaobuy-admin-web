import type { ProductKind } from '@/types/api';

/**
 * Cada produto é de um tipo só (27/10/2026): loja, Coin Shop ou "Leve
 * junto", cada um com listagem, cadastro e endereço próprios no painel. As
 * telas são as mesmas; o tipo decide os textos, os campos e o caminho.
 */
export const PRODUCT_KIND_BASE_PATH: Record<ProductKind, string> = {
    STORE: '/admin/produtos',
    COIN_SHOP: '/admin/coin-shop',
    CHECKOUT_ADDON: '/admin/leve-junto',
};

export function productPath(kind: ProductKind, id?: string) {
    return id ? `${PRODUCT_KIND_BASE_PATH[kind]}/${id}` : PRODUCT_KIND_BASE_PATH[kind];
}
