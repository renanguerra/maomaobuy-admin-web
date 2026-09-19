import type { Coupon, CouponStatus } from '@/types/api';
import { cny } from '@/types/api';
import type { StatusTone } from '@/components/admin/StatusPill';

/** "10%" ou "¥5,00" — a etiqueta curta do desconto. */
export function couponDiscountLabel(coupon: Pick<Coupon, 'discountType' | 'discountValue'>): string {
    if (coupon.discountType === 'PERCENTAGE') return `${percentFromBasisPoints(coupon.discountValue)}%`;
    return cny(coupon.discountValue);
}

/** 1250 pontos-base → "12,5"; nunca mostra ",00". */
export function percentFromBasisPoints(basisPoints: string | number): string {
    const value = Number(basisPoints) / 100;
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** "12,5" → 1250 pontos-base. Vírgula ou ponto, tanto faz. */
export function basisPointsFromPercent(percent: string): number {
    const normalized = percent.replace(',', '.').trim();
    const value = Number(normalized);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
}

const COUPON_STATUS_TONES: Record<CouponStatus, StatusTone> = {
    ACTIVE: 'success',
    SCHEDULED: 'info',
    INACTIVE: 'neutral',
    EXPIRED: 'neutral',
    EXHAUSTED: 'warning',
};

export function couponStatusTone(status: CouponStatus): StatusTone {
    return COUPON_STATUS_TONES[status];
}

/** ISO → valor de `<input type="datetime-local">` no fuso do navegador. */
export function toDateTimeLocal(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor de `<input type="datetime-local">` → ISO; vazio vira `null`. */
export function fromDateTimeLocal(value: string): string | null {
    if (!value) return null;
    return new Date(value).toISOString();
}
