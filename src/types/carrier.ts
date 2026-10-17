/**
 * Envio pela transportadora (Westlink, API ITS). Espelha
 * `libs/types/src/shipping/carrier-shipment.response.ts` do backend.
 */

export type CarrierCargoType = 'GENERAL' | 'BATTERY_INTERNAL' | 'BATTERY_STANDALONE';

export interface CarrierChannel {
    code: string;
    name: string;
    originalName: string;
    family: 'CORREIOS' | 'EUB';
    preferred: boolean;
    summary: string;
    acceptedGoods: string;
    cargoTypes: CarrierCargoType[];
    minWeightGrams: number;
    maxWeightGrams: number;
    volumetricDivisor: number | null;
    maxSideMillimeters: number | null;
    maxSumMillimeters: number | null;
    minimumSize: { lengthMillimeters: number; widthMillimeters: number } | null;
    estimatedDays: { min: number; max: number; note: string | null };
    advantages: string[];
    disadvantages: string[];
    requirements: string[];
    taxDisclaimer: string | null;
    enabledForAccount: boolean | null;
}

export interface CarrierChannels {
    provider: string;
    configured: boolean;
    channels: CarrierChannel[];
    otherAccountChannels: { code: string; name: string }[];
    accountError: string | null;
}

export interface CarrierFee {
    name: string;
    amount: number;
    currency: string;
}

export interface CarrierQuoteLine {
    channelCode: string;
    channelName: string;
    preferred: boolean;
    table: {
        amountMinor: string;
        chargeableWeightGrams: number;
        volumetricWeightGrams: number;
        breakdown: { label: string; amountMinor: string }[];
    } | null;
    tableRejection: string | null;
    api: {
        amountMinor: string;
        currency: string;
        chargeableWeight: number | null;
        weightUnit: string | null;
        fees: CarrierFee[];
    } | null;
    apiError: string | null;
    suggestedCostAmountMinor: string | null;
}

export interface CarrierQuote {
    configured: boolean;
    lines: CarrierQuoteLine[];
}

export interface CarrierParcel {
    weightGrams: number;
    lengthMillimeters: number;
    widthMillimeters: number;
    heightMillimeters: number;
}

export interface CarrierConsignee {
    name: string;
    phone: string;
    email: string;
    taxId: string | null;
    countryCode: string;
    state: string;
    city: string;
    district: string | null;
    address: string;
    address2: string | null;
    postalCode: string;
}

export interface CarrierDraftItem {
    orderItemId: string;
    productId: string | null;
    productName: string;
    quantity: number;
    englishName: string;
    chineseName: string;
    hsCode: string;
    unitNetWeightGrams: number;
    unitDeclaredUsdCents: number;
    unitPaidAmountMinor: string;
}

export interface CarrierDraft {
    packageId: string;
    packageCode: string;
    packageStatus: string;
    readyToCreate: boolean;
    blockingReason: string | null;
    defaultChannelCode: string;
    parcel: {
        weightGrams: number | null;
        lengthMillimeters: number | null;
        widthMillimeters: number | null;
        heightMillimeters: number | null;
    };
    consignee: CarrierConsignee;
    usdToCnyRate: number;
    items: CarrierDraftItem[];
}

export interface CarrierTrackingEvent {
    time: string;
    timeZone: string | null;
    status: string | null;
    statusLabel: string | null;
    content: string;
    location: string | null;
    fromLastMile: boolean;
}

export interface CarrierShipment {
    id: string;
    packageId: string;
    provider: string;
    channelCode: string;
    channelName: string;
    status: 'CREATED' | 'CANCELLED';
    customerOrderNo: string;
    waybillNo: string | null;
    deliveryNo: string | null;
    postalTrackingNo: string | null;
    lastMileCarrier: string | null;
    trackingNumber: string | null;
    hasLabel: boolean;
    labelFetchedAt: string | null;
    trackingStatus: string | null;
    trackingStatusLabel: string | null;
    trackingEvents: CarrierTrackingEvent[];
    trackingSyncedAt: string | null;
    billed: {
        amountMinor: string;
        currency: string;
        weightGrams: number | null;
        fees: CarrierFee[];
        billedAt: string | null;
    } | null;
    warehouseMeasurement: {
        weightKg: number | null;
        lengthCm: number | null;
        widthCm: number | null;
        heightCm: number | null;
        volumetricWeightKg: number | null;
        chargeableWeightKg: number | null;
        fetchedAt: string;
    } | null;
    declared: {
        currency: string;
        totalUsdCents: number;
        items: {
            englishName: string;
            chineseName: string;
            quantity: number;
            unitDeclaredUsdCents: number;
            hsCode: string | null;
        }[];
        parcel: CarrierParcel | null;
    };
    createdAt: string;
    createdByAdminId: string;
    cancelledAt: string | null;
}

export interface CarrierRefresh {
    shipment: CarrierShipment;
    warnings: string[];
    packageStatus: string | null;
}

/** Centavos de dólar em US$ 12,50. */
export function usd(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Valor da transportadora em centésimos, na moeda que ela informou. */
export function carrierMoney(minor: string | number, currency: string) {
    try {
        return new Intl.NumberFormat(currency === 'CNY' ? 'zh-CN' : 'pt-BR', { style: 'currency', currency }).format(
            Number(minor) / 100,
        );
    } catch {
        return `${(Number(minor) / 100).toFixed(2)} ${currency}`;
    }
}

export function kilograms(grams: number) {
    return `${(grams / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
}
