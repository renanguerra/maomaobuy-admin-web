import type { StatusTone } from '@/components/admin/StatusPill';
import type { WholesaleApplication, WholesaleApplicationStatus } from '@/types/api';

export function wholesaleStatusTone(status: WholesaleApplicationStatus): StatusTone {
    if (status === 'PENDING') return 'warning';
    if (status === 'NEEDS_INFO') return 'info';
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED' || status === 'REVOKED') return 'danger';
    return 'neutral';
}

export function cnpjLookupTone(status: WholesaleApplication['cnpjLookupStatus']): StatusTone {
    if (status === 'OK') return 'success';
    if (status === 'ALERT') return 'danger';
    return 'neutral';
}

/** Influencer pendente ou aprovado: a aprovação é recusada pelo backend (D14). */
export function blocksApproval(application: WholesaleApplication) {
    return application.influencerStatus === 'PENDING' || application.influencerStatus === 'APPROVED';
}
