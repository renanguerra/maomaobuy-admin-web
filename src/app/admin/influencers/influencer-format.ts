import type { StatusTone } from '@/components/admin/StatusPill';
import type { InfluencerBenefitStatus, InfluencerCommissionStatus, InfluencerStatus } from '@/types/api';

export function influencerStatusTone(status: InfluencerStatus): StatusTone {
    if (status === 'PENDING') return 'warning';
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED') return 'danger';
    return 'neutral';
}

export function commissionStatusTone(status: InfluencerCommissionStatus): StatusTone {
    if (status === 'CREDITED') return 'success';
    if (status === 'PENDING') return 'info';
    if (status === 'REVERSED') return 'danger';
    return 'neutral';
}

export function benefitStatusTone(status: InfluencerBenefitStatus): StatusTone {
    if (status === 'GRANTED') return 'success';
    if (status === 'PENDING') return 'warning';
    return 'neutral';
}

/** "12,5" (o que o admin digita) → 1250 pontos-base. */
export function percentToBasisPoints(value: string): number {
    return Math.round(Number(value.replace(',', '.')) * 100);
}

/** 1250 → "12.5" para o `<input type="number">`. */
export function basisPointsToPercent(basisPoints: number): string {
    return String(basisPoints / 100);
}

/** Link do perfil quando a rede tem endereço conhecido. */
export function socialProfileUrl(network: string, handle: string): string | null {
    const clean = encodeURIComponent(handle);
    switch (network) {
        case 'INSTAGRAM':
            return `https://www.instagram.com/${clean}`;
        case 'TIKTOK':
            return `https://www.tiktok.com/@${clean}`;
        case 'YOUTUBE':
            return `https://www.youtube.com/@${clean}`;
        case 'KWAI':
            return `https://www.kwai.com/@${clean}`;
        case 'X':
            return `https://x.com/${clean}`;
        case 'FACEBOOK':
            return `https://www.facebook.com/${clean}`;
        default:
            return null;
    }
}
