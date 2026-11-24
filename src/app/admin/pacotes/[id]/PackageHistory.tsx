'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Skeleton } from '@/components/admin/Skeleton';
import { Timeline } from '@/components/admin/Timeline';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/translations';
import { api, ApiError } from '@/services/api';
import { formatDate, packageStatusLabel, type AdminPackage, type AdminPackageHistoryEntry } from '@/types/api';

const ACTION_LABELS: Record<string, MessageKey> = {
    APPROVE_PACKAGE: 'packages.detail.history.approved',
    REJECT_PACKAGE: 'packages.detail.history.rejected',
    CANCEL_PACKAGE: 'packages.detail.history.cancelled',
    SET_PACKAGE_SHIPMENT_DETAILS: 'packages.detail.history.freightSet',
    SET_PACKAGE_MEASUREMENTS: 'packages.detail.history.measurements',
    DISPATCH_PACKAGE: 'packages.detail.history.dispatched',
    CORRECT_PACKAGE_SHIPMENT: 'packages.detail.history.trackingCorrected',
    FAIL_PACKAGE_SHIPMENT: 'packages.detail.history.shippingFailure',
    OVERRIDE_PACKAGE_STATUS: 'packages.detail.history.statusOverridden',
    CREATE_CARRIER_SHIPMENT: 'packages.detail.history.carrierCreated',
    CANCEL_CARRIER_SHIPMENT: 'packages.detail.history.carrierCancelled',
};

/** Ajuste manual grava "ORIGEM → DESTINO: motivo" com os códigos de status. */
const OVERRIDE_REASON = /^([A-Z_]+) → ([A-Z_]+): ([\s\S]*)$/;

interface HistoryItem {
    id: string;
    at: string;
    title: string;
    author?: string;
    body?: string | null;
    change?: string;
}

/**
 * Histórico do pacote: as ações da equipe (auditoria) e os marcos que o próprio
 * pacote guarda. Um marco só entra quando nenhuma ação já conta a mesma coisa.
 */
export function PackageHistory({ pkg }: { pkg: AdminPackage }) {
    const { t } = useTranslation();
    const [audits, setAudits] = useState<AdminPackageHistoryEntry[]>();
    const [error, setError] = useState(false);

    // `updatedAt` muda a cada ação na tela: o histórico aberto acompanha.
    useEffect(() => {
        let current = true;
        api<AdminPackageHistoryEntry[]>(`/packages/${pkg.id}/history`)
            .then((loaded) => {
                if (!current) return;
                setAudits(loaded);
                setError(false);
            })
            .catch((err) => {
                if (!current) return;
                setAudits([]);
                // 404 = backend ainda sem a rota: ficam só os marcos.
                setError(!(err instanceof ApiError && err.status === 404));
            });
        return () => {
            current = false;
        };
    }, [pkg.id, pkg.updatedAt]);

    if (!audits) {
        return (
            <div className="grid gap-3">
                <Skeleton className="h-8 w-2/3 rounded-lg" />
                <Skeleton className="h-8 w-1/2 rounded-lg" />
            </div>
        );
    }

    const recorded = new Set(audits.map((audit) => audit.action));
    const items: HistoryItem[] = audits.map((audit) => {
        const override = audit.action === 'OVERRIDE_PACKAGE_STATUS' ? OVERRIDE_REASON.exec(audit.reason ?? '') : null;
        const labelKey = ACTION_LABELS[audit.action];
        return {
            id: audit.id,
            at: audit.createdAt,
            title: labelKey ? t(labelKey) : t('packages.detail.history.other'),
            author: audit.adminName ?? t('packages.detail.history.team'),
            body: override ? override[3] : audit.reason,
            change: override ? `${packageStatusLabel(override[1])} → ${packageStatusLabel(override[2])}` : undefined,
        };
    });

    const milestones: { key: string; at: string | null; title: string; skip?: boolean }[] = [
        { key: 'created', at: pkg.createdAt, title: t('packages.detail.history.created') },
        {
            key: 'reviewed',
            at: pkg.reviewedAt,
            title: t('packages.detail.history.reviewed'),
            skip: recorded.has('APPROVE_PACKAGE') || recorded.has('REJECT_PACKAGE'),
        },
        { key: 'paid', at: pkg.paidAt, title: t('packages.detail.history.paid') },
        {
            key: 'shipped',
            at: pkg.shippedAt,
            title: t('packages.detail.history.dispatched'),
            skip: recorded.has('DISPATCH_PACKAGE'),
        },
        { key: 'delivered', at: pkg.deliveredAt, title: t('packages.detail.history.delivered') },
    ];
    for (const { key, at, title, skip } of milestones) {
        // O substituto herda datas do original, anteriores à criação dele.
        if (!at || skip || new Date(at) < new Date(pkg.createdAt)) continue;
        items.push({ id: key, at, title });
    }
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return (
        <div className="grid gap-4">
            {error && (
                <Alert tone="danger">
                    <p>{t('packages.detail.history.error')}</p>
                </Alert>
            )}
            <Timeline
                entries={items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    meta: item.author ? `${formatDate(item.at)} · ${item.author}` : formatDate(item.at),
                    change: item.change,
                    body: item.body,
                }))}
            />
        </div>
    );
}
