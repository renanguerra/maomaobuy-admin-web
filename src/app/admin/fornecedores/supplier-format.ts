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

/**
 * Link do WhatsApp só para número com DDI (`+86 …`, `+55 …`): sem ele, um
 * celular brasileiro "11 9…" viraria o código de outro país.
 */
export function whatsappHref(phone: string | null): string | undefined {
    const trimmed = (phone ?? '').trim();
    if (!trimmed.startsWith('+')) return undefined;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 10 ? `https://wa.me/${digits}` : undefined;
}

/** Espelho do `@Roles` de escrita em `AdminSuppliersController`. */
export function canWriteSuppliers(role: string | undefined): boolean {
    return role === 'SUPERADMIN' || role === 'CATALOG' || role === 'WAREHOUSE' || role === 'FINANCE';
}

export function contactChannels(contact: SupplierContact): string {
    return [contact.phone, contact.wechat ? `WeChat ${contact.wechat}` : null, contact.email]
        .filter(Boolean)
        .join(' · ');
}

export function locationLabel(city: string | null, country: string | null): string {
    return [city, country].filter(Boolean).join(', ');
}
