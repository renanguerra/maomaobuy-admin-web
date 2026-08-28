'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { inspectionStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { inspectionStatusLabel, type AdminInspection, type AdminPendingInspectionItem } from '@/types/api';

/**
 * Fila de trabalho do armazém, não um cadastro: o laudo em si é editado dentro
 * do pedido, que é onde ele vive. Aqui o admin só descobre o que precisa da
 * atenção dele e vai para o pedido certo.
 */
export function AdminInspectionsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [pendingItems, setPendingItems] = useState<AdminPendingInspectionItem[]>();
    const [awaitingAdmin, setAwaitingAdmin] = useState<AdminInspection[]>([]);
    const [error, setError] = useState<string>();

    // O `setState` fica no `.then` de propósito: chamado direto no corpo do
    // efeito, o lint (com razão) acusa render em cascata.
    const load = useCallback(
        () =>
            Promise.all([
                api<AdminPendingInspectionItem[]>('/inspections/pending-items'),
                api<AdminInspection[]>('/inspections?status=AWAITING_ADMIN'),
            ])
                .then(([items, inspections]) => {
                    setPendingItems(items);
                    setAwaitingAdmin(inspections);
                    setError(undefined);
                })
                .catch(() => setError(t('inspections.error'))),
        [t],
    );

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="grid gap-5">
            <PageHeader
                description={t('inspections.description')}
                kicker={t('inspections.kicker')}
                title={t('inspections.title')}
            />

            {error && <EmptyState description={error} icon={ClipboardCheck} title={t('inspections.error')} />}

            {!pendingItems && !error && <SkeletonCards label={t('inspections.loading')} />}

            {pendingItems && (
                <SectionCard
                    description={t('inspections.queue.description')}
                    icon={<ClipboardCheck aria-hidden="true" />}
                    title={t('inspections.queue.title')}
                >
                    {pendingItems.length === 0 ? (
                        <EmptyState
                            description={t('inspections.queue.emptyDescription')}
                            icon={ClipboardCheck}
                            title={t('inspections.queue.empty')}
                        />
                    ) : (
                        <ul className="m-0 grid list-none gap-2 p-0">
                            {pendingItems.map((item) => (
                                <li
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 dark:border-night-line"
                                    key={item.orderItemId}
                                >
                                    <span className="min-w-0 text-sm">
                                        <strong className="block truncate text-ink dark:text-night-text">
                                            {item.productName}
                                        </strong>
                                        <span className="mm-data text-xs text-muted dark:text-night-subtle">
                                            {item.orderId.slice(0, 8).toUpperCase()}
                                        </span>
                                    </span>
                                    <Button onClick={() => router.push(`/admin/pedidos/${item.orderId}`)} size="small">
                                        {t('inspections.queue.goToOrder')}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>
            )}

            {awaitingAdmin.length > 0 && (
                <SectionCard
                    description={t('inspections.awaitingAdmin.description')}
                    icon={<ClipboardCheck aria-hidden="true" />}
                    title={t('inspections.awaitingAdmin.title')}
                >
                    <ul className="m-0 grid list-none gap-2 p-0">
                        {awaitingAdmin.map((inspection) => (
                            <li
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 dark:border-night-line"
                                key={inspection.id}
                            >
                                <span className="min-w-0 text-sm">
                                    <strong className="block truncate text-ink dark:text-night-text">
                                        {inspection.productName ?? t('inspections.unnamedItem')}
                                    </strong>
                                    <span className="block truncate text-xs text-muted dark:text-night-subtle">
                                        {inspection.decisionNote}
                                    </span>
                                </span>
                                <span className="flex items-center gap-2">
                                    <StatusPill tone={inspectionStatusTone(inspection.status)}>
                                        {inspectionStatusLabel(inspection.status)}
                                    </StatusPill>
                                    {inspection.orderId && (
                                        <Button
                                            onClick={() => router.push(`/admin/pedidos/${inspection.orderId}`)}
                                            size="small"
                                            variant="secondary"
                                        >
                                            {t('inspections.queue.goToOrder')}
                                        </Button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}
        </div>
    );
}
