export interface VariantDraft {
    key: string;
    externalId: string;
    label: string;
    /** Ajuste de preço em unidades mínimas (centavos), ex.: "0", "12990". */
    amountAdjustmentMinor: string;
    isAvailable: boolean;
}
