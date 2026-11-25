import type { AdminBoxItem, AdminProduct } from '@/types/api';

/** Uma linha do conteúdo em edição, ainda não salva. */
export type BoxDraftLine = Omit<AdminBoxItem, 'problem' | 'weightGrams'>;

export function lineKey(line: Pick<BoxDraftLine, 'productId' | 'variantExternalId'>) {
    return `${line.productId}:${line.variantExternalId}`;
}

/** Um produto da busca vira uma opção por variação disponível (ou uma só). */
export function draftOptions(product: AdminProduct): BoxDraftLine[] {
    const soldAlone = product.kind === 'STORE' && product.isPublished && product.salesChannel !== 'WHOLESALE_ONLY';
    const base = {
        productId: product.id,
        name: product.name,
        quantity: 1,
        isGift: product.kind !== 'STORE',
        unitCostAmountMinor: product.costAmountMinor,
        stock: product.stock,
        thumbnailUrl: product.media.find((media) => media.type === 'IMAGE')?.url ?? null,
    };
    if (product.variants.length === 0)
        return [
            {
                ...base,
                variantExternalId: '',
                variantLabel: null,
                unitAmountMinor: soldAlone ? product.sourceAmountMinor : null,
            },
        ];
    return product.variants
        .filter((variant) => variant.isAvailable)
        .map((variant) => ({
            ...base,
            variantExternalId: variant.externalId,
            variantLabel: variant.label,
            unitAmountMinor: soldAlone
                ? (BigInt(product.sourceAmountMinor) + BigInt(variant.amountAdjustmentMinor)).toString()
                : null,
        }));
}

/** Por que o produto não entra numa box; as mesmas regras do backend. */
export function cannotEnterBox(product: AdminProduct): boolean {
    return (
        product.kind === 'BOX' || product.isPreSale || product.isOnDemand || product.salesChannel === 'WHOLESALE_ONLY'
    );
}

/**
 * A mesma conta do backend (`boxPricing`, `boxCostMinor`, `buildableUnits`),
 * para o admin ver o desconto e o lucro enquanto monta.
 */
export function boxSummary(lines: readonly BoxDraftLine[], amountMinor: string) {
    const price = BigInt(amountMinor);
    let regular = BigInt(0);
    let cost: bigint | null = BigInt(0);
    const needed = new Map<string, { quantity: number; stock: number }>();
    for (const line of lines) {
        const quantity = BigInt(line.quantity);
        if (!line.isGift && line.unitAmountMinor !== null) regular += BigInt(line.unitAmountMinor) * quantity;
        if (line.unitCostAmountMinor === null) cost = null;
        else if (cost !== null) cost += BigInt(line.unitCostAmountMinor) * quantity;
        const entry = needed.get(line.productId) ?? { quantity: 0, stock: line.stock };
        needed.set(line.productId, { ...entry, quantity: entry.quantity + line.quantity });
    }
    const savings = regular - price;
    return {
        regularMinor: regular.toString(),
        savingsMinor: savings.toString(),
        savingsPercent: regular > BigInt(0) ? (Number(savings) / Number(regular)) * 100 : 0,
        costMinor: lines.length > 0 ? (cost?.toString() ?? null) : null,
        profitMinor: lines.length > 0 && cost !== null ? (price - cost).toString() : null,
        profitPercent:
            lines.length > 0 && cost !== null && price > BigInt(0) ? (Number(price - cost) / Number(price)) * 100 : 0,
        buildable:
            needed.size === 0
                ? 0
                : Math.min(...[...needed.values()].map((entry) => Math.floor(entry.stock / entry.quantity))),
    };
}
