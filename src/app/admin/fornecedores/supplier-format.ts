import type { StatusTone } from '@/components/admin/StatusPill';
import type { SupplierContact, SupplierKind, SupplierStatus } from '@/types/api';

export const SUPPLIER_KINDS: readonly SupplierKind[] = ['PRODUCT', 'SHIPPING'];
export const SUPPLIER_STATUSES: readonly SupplierStatus[] = ['EVALUATING', 'ACTIVE', 'PAUSED', 'DISCARDED'];

export const SUPPLIER_STATUS_TONES: Record<SupplierStatus, StatusTone> = {
    ACTIVE: 'success',
    EVALUATING: 'info',
    PAUSED: 'warning',
    DISCARDED: 'neutral',
};

/**
 * Ponto de partida das modalidades. O formulário soma a estas as que já foram
 * usadas no banco, para a mesma coisa não virar "Fedex", "FedEx" e "fedex".
 */
export const MODALITY_PRESETS: Record<SupplierKind, readonly string[]> = {
    PRODUCT: [
        'TCG japonês',
        'TCG chinês',
        'TCG inglês',
        'Booster box',
        'Cartas avulsas',
        'Pelúcias',
        'Figures',
        'Consoles',
        'Acessórios',
        'Embalagens',
        'Dropshipping',
        'Atacado',
    ],
    SHIPPING: [
        'Aéreo',
        'Marítimo',
        'Expresso',
        'FedEx',
        'DHL',
        'UPS',
        'Correios',
        'Linha Brasil',
        'Caixa Master',
        'Pacote pequeno',
        'Despacho aduaneiro',
    ],
};

export const SUPPLIER_CURRENCIES = ['CNY', 'USD', 'BRL', 'HKD', 'JPY', 'EUR'] as const;

/** Só dígitos com DDI: o formato que o link do WhatsApp aceita. */
export function whatsappHref(phone: string | null): string | undefined {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length >= 10 ? `https://wa.me/${digits}` : undefined;
}

export function contactChannels(contact: SupplierContact): string {
    return [contact.phone, contact.wechat ? `WeChat ${contact.wechat}` : null, contact.email]
        .filter(Boolean)
        .join(' · ');
}

export function locationLabel(city: string | null, country: string | null): string {
    return [city, country].filter(Boolean).join(', ');
}
