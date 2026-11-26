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
      }
    | {
          /** Sem tabela: o preço sai dos fretes informados nos pacotes. */
          kind: 'ON_REQUEST';
          minSamples: number;
          windowDays: number;
      };

/** O que os fretes informados ensinaram (linha sob consulta). */
export interface LearnedRatePricing {
    method: 'LINEAR' | 'PER_KG';
    fixedMinor: string;
    perKgMinor: string;
    minGrams: number;
    maxGrams: number;
    samples: number;
    outliers: number;
    windowDays: number;
    computedAt: string;
}

/** Um frete informado na linha (`GET /shipping-table/lines/:id/learned`). */
export interface LearnedRateSample {
    packageId: string;
    packageCode: string;
    quotedAt: string;
    weightGrams: number;
    lengthMillimeters: number | null;
    widthMillimeters: number | null;
    heightMillimeters: number | null;
    chargeableWeightGrams: number;
    costAmountMinor: string;
    excluded: boolean;
    outlier: boolean;
}

export interface LearnedRate {
    lineId: string;
    onRequest: boolean;
    minSamples: number | null;
    windowDays: number | null;
    learnedPricing: LearnedRatePricing | null;
    samples: LearnedRateSample[];
}

export type RatePricingKind = RatePricing['kind'];
export type TaxMode = 'DDP' | 'DDU' | 'RECIPIENT';
export type TrackingLevel = 'LIMITED' | 'TRACKED' | 'SIGNED';

export const PRICING_KINDS: RatePricingKind[] = ['WEIGHT_BANDS', 'PER_KG', 'FIRST_PLUS_STEP', 'ON_REQUEST'];
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
    learnedPricing: LearnedRatePricing | null;
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
            estimatedFromSamples: number | null;
        } | null;
        rejection: string | null;
        onRequest: boolean;
    }[];
    modalities: {
        modalityId: string;
        modalityName: string;
        lineId: string | null;
        lineCode: string | null;
        costAmountMinor: string | null;
        freightAmountMinor: string | null;
        estimatedFromSamples: number | null;
        onRequest: boolean;
        estimatedDays: { min: number; max: number } | null;
        rejection: string | null;
    }[];
}

/** Modalidades para o despacho escolher (`GET /shipping-table/dispatch-options`). */
export interface DispatchOptions {
    modalities: Pick<ShippingModality, 'id' | 'name' | 'isActive'>[];
    /** Código da linha da Westlink (BR025) → modalidade. */
    westlinkModalities: Record<string, string>;
    /** Linhas para a cotação dizer qual foi consultada. */
    quoteLines: {
        id: string;
        integration: 'WESTLINK' | null;
        code: string;
        name: string;
        modalityId: string | null;
        destinationCountry: string;
        isActive: boolean;
        onRequest: boolean;
    }[];
}

/** Valor do seletor de linha na cotação quando nenhuma cadastrada serviu. */
export const OTHER_RATE_LINE = 'other';

/** Prazo real e imposto do histórico (`GET /shipping-table/performance`). */
export interface ShippingPerformanceEntry {
    /** `null` = envios sem modalidade cadastrada (ou o total geral). */
    modalityId: string | null;
    modalityName: string | null;
    deliveries: number;
    averageDays: number | null;
    medianDays: number | null;
    minDays: number | null;
    maxDays: number | null;
    /** Envios com imposto informado, inclusive os não taxados. */
    taxReported: number;
    taxCharged: number;
    /** Média só dos taxados, em centavos de real. */
    averageTaxAmountMinor: string | null;
}

export interface ShippingPerformance {
    modalities: ShippingPerformanceEntry[];
    overall: ShippingPerformanceEntry;
}

/** Transportadoras que usamos; o campo aceita outra, mas sugere estas. */
export const SHIPPING_CARRIERS = ['China Post', 'EMS', 'DHL', 'FedEx', 'UPS', 'Correios'] as const;

/** Quem pode mexer na tabela (o backend é a fonte da verdade). */
export function canWriteShippingTable(role: string | undefined): boolean {
    return role === 'SUPERADMIN' || role === 'WAREHOUSE' || role === 'FINANCE';
}

/** ¥ em centavos de yuan. */
export function yuan(minor: string | number | null | undefined): string {
    if (minor === null || minor === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'CNY' }).format(Number(minor) / 100);
}
