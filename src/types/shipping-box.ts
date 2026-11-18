/** Espelha `AdminShippingBoxResponse` do backend. */
export interface ShippingBox {
    id: string;
    label: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    emptyWeightGrams: number;
    maxGrossWeightGrams: number;
    /** Custo interno em fen. */
    costAmountMinor: string | null;
    isActive: boolean;
    notes: string | null;
    updatedAt: string;
}
