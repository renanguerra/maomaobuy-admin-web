/**
 * Tabela de frete (modalidades e linhas de fornecedor). Espelha
 * `apps/admin/src/shipping-table/types/admin-shipping-table.response.ts`.
 */
import type { CarrierCargoType } from './carrier';

export type RatePricing =
    | {
          kind: 'WEIGHT_BANDS';
          bands: { uptoGrams: number; amountMinor: string }[];
          beyond: { stepGrams: number; stepAmountMinor: string } | null;
      }
    | {
          kind: 'PER_KG';
          ratePerKgMinor: string;
          fixedFeeMinor: string;
          feeBands: { uptoGrams: number; feeMinor: string }[];
          beyondFee: { stepGrams: number; stepFeeMinor: string } | null;
      }
    | {
          kind: 'FIRST_PLUS_STEP';
          firstGrams: number;
          firstAmountMinor: string;
          stepGrams: number;
          stepAmountMinor: string;
      };

export type RatePricingKind = RatePricing['kind'];
export type TaxMode = 'DDP' | 'DDU' | 'RECIPIENT';
export type TrackingLevel = 'LIMITED' | 'TRACKED' | 'SIGNED';

export const PRICING_KINDS: RatePricingKind[] = ['WEIGHT_BANDS', 'PER_KG', 'FIRST_PLUS_STEP'];
export const TAX_MODES: TaxMode[] = ['RECIPIENT', 'DDU', 'DDP'];
export const TRACKING_LEVELS: TrackingLevel[] = ['TRACKED', 'SIGNED', 'LIMITED'];

export interface ShippingModality {
    id: string;
    code: string;
    name: string;
    description: string | null;
    position: number;
    isActive: boolean;
    lineCount: number;
    activeLineCount: number;
    updatedAt: string;
}

export interface RateLineApiSample {
    weightGrams: number;
    tableAmountMinor: string | null;
    apiAmountMinor: string | null;
    apiCurrency: string | null;
    apiChargeableWeight: number | null;
    apiFees: { name: string; amount: number; currency: string }[];
    error: string | null;
}

export interface RateLineApiCheck {
    checkedAt: string;
    enabledForAccount: boolean | null;
    accountName: string | null;
    lengthMillimeters: number;
    widthMillimeters: number;
    heightMillimeters: number;
    samples: RateLineApiSample[];
}

export interface ShippingRateLine {
    id: string;
    modalityId: string | null;
    modalityName: string | null;
    supplierId: string | null;
    supplierName: string | null;
    integration: 'WESTLINK' | null;
    code: string;
    name: string;
    originalName: string | null;
    destinationCountry: string;
    cargoTypes: CarrierCargoType[];
    taxMode: TaxMode;
    trackingLevel: TrackingLevel;
    minWeightGrams: number;
    maxWeightGrams: number;
    roundingGrams: number | null;
    volumetricDivisor: number | null;
    volumetricFromGrams: number | null;
    maxSumMillimeters: number | null;
    maxSideMillimeters: number | null;
    minLengthMillimeters: number | null;
    minWidthMillimeters: number | null;
    daysMin: number;
    daysMax: number;
    daysNote: string | null;
    pricing: RatePricing;
    summary: string | null;
    acceptedGoods: string | null;
    advantages: string[];
    disadvantages: string[];
    requirements: string[];
    taxDisclaimer: string | null;
    notes: string | null;
    isActive: boolean;
    isPreferred: boolean;
    ratesUpdatedAt: string | null;
    apiCheck: RateLineApiCheck | null;
    updatedAt: string;
}

export interface ShippingTable {
    markupBasisPoints: number;
    westlinkConfigured: boolean;
    modalities: ShippingModality[];
    lines: ShippingRateLine[];
    suppliers: { id: string; name: string }[];
}

export interface ShippingSimulation {
    lines: {
        lineId: string;
        lineCode: string;
        lineName: string;
        integration: string | null;
        modalityId: string | null;
        isActive: boolean;
        quote: {
            chargeableWeightGrams: number;
            volumetricWeightGrams: number;
            amountMinor: string;
            freightAmountMinor: string;
            breakdown: { label: string; amountMinor: string }[];
        } | null;
        rejection: string | null;
    }[];
    modalities: {
        modalityId: string;
        modalityName: string;
        lineId: string | null;
        lineCode: string | null;
        costAmountMinor: string | null;
        freightAmountMinor: string | null;
        estimatedDays: { min: number; max: number } | null;
        rejection: string | null;
    }[];
}

/** Quem pode mexer na tabela (o backend é a fonte da verdade). */
export function canWriteShippingTable(role: string | undefined): boolean {
    return role === 'SUPERADMIN' || role === 'WAREHOUSE' || role === 'FINANCE';
}

/** ¥ em centavos de yuan. */
export function yuan(minor: string | number | null | undefined): string {
    if (minor === null || minor === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'CNY' }).format(Number(minor) / 100);
}
