'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { formatDate, money, type AdminOrder, type OrderOptionalService } from '@/types/api';

type PendingAction = { id: string; kind: 'complete' | 'cancel' };

const STATUS_TONE = {
    REQUESTED: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
} as const;

/**
 * Execução dos adicionais contratados. Fica no detalhe do pedido porque é onde
 * a equipe do armazém já está quando manuseia o item — separar numa fila
 * própria obrigaria a abrir duas telas para o mesmo pacote de trabalho.
 *
 * Marcar como concluído não mexe em dinheiro (o valor já foi cobrado no
 * pagamento), então não pede TOTP; fica registrado no histórico com o admin.
 */
export function OrderOptionalServicesSection({ order, onChanged }: { order: AdminOrder; onChanged: () => void }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [pending, setPending] = useState<PendingAction>();
    const [error, setError] = useState<string>();

    const services = order.optionalServices ?? [];
    if (services.length === 0)
        return (
            <SectionCard
                description={t('orders.detail.optionalServicesSection.description')}
                title={t('orders.detail.optionalServicesSection.title')}
            >
                <EmptyState icon={Sparkles} title={t('orders.detail.optionalServicesSection.empty')} />
            </SectionCard>
        );

    async function confirm(values: { reason: string } & Record<string, string>) {
        if (!pending) return;
        const note = values.note?.trim();
        await api(`/order-optional-services/${pending.id}/${pending.kind}`, {
            method: 'POST',
            body: JSON.stringify(note ? { note } : {}),
        });
        notify({
            tone: 'success',
            title: t(
                pending.kind === 'complete'
                    ? 'orders.detail.optionalServicesSection.completedToast'
                    : 'orders.detail.optionalServicesSection.cancelledToast',
            ),
        });
        setPending(undefined);
        onChanged();
    }

    return (
        <>
            <SectionCard
                description={t('orders.detail.optionalServicesSection.description')}
                flush
                title={t('orders.detail.optionalServicesSection.title')}
            >
                {!order.paidAt && (
                    <div className="px-4 pt-4">
                        <Alert tone="info">
                            <p>{t('orders.detail.optionalServicesSection.unpaid')}</p>
                        </Alert>
                    </div>
                )}
                {error && (
                    <div className="px-4 pt-4">
                        <Alert tone="danger">
                            <p>{error}</p>
                        </Alert>
                    </div>
                )}
                <ListRows>
                    {services.map((service) => (
                        <li key={service.id}>
                            <ListRow
                                leading={
                                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-warm-200 text-muted dark:bg-night-raised dark:text-night-muted">
                                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                }
                                title={service.name}
                                meta={<ServiceMeta service={service} />}
                                pill={<StatusPill tone={STATUS_TONE[service.status]}>{service.status}</StatusPill>}
                                value={money(service.totalAmountMinor, service.currency)}
                                actions={
                                    service.status === 'REQUESTED' && order.paidAt ? (
                                        <>
                                            <Button
                                                onClick={() => {
                                                    setError(undefined);
                                                    setPending({ id: service.id, kind: 'complete' });
                                                }}
                                                size="small"
                                            >
                                                {t('orders.detail.optionalServicesSection.complete')}
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    setError(undefined);
                                                    setPending({ id: service.id, kind: 'cancel' });
                                                }}
                                                size="small"
                                                variant="ghost"
                                            >
                                                {t('orders.detail.optionalServicesSection.cancel')}
                                            </Button>
                                        </>
                                    ) : undefined
                                }
                            />
                        </li>
                    ))}
                </ListRows>
            </SectionCard>

            <ActionDialog
                confirmLabel={t(
                    pending?.kind === 'cancel'
                        ? 'orders.detail.optionalServicesSection.cancel'
                        : 'orders.detail.optionalServicesSection.complete',
                )}
                description={t(
                    pending?.kind === 'cancel'
                        ? 'orders.detail.optionalServicesSection.cancelDescription'
                        : 'orders.detail.optionalServicesSection.completeDescription',
                )}
                fields={[
                    {
                        name: 'note',
                        kind: 'textarea',
                        label: t('orders.detail.optionalServicesSection.noteLabel'),
                        optional: true,
                        maxLength: 500,
                        wide: true,
                    },
                ]}
                onCancel={() => setPending(undefined)}
                onConfirm={async (values) => {
                    try {
                        await confirm(values);
                    } catch (err) {
                        setError(err instanceof ApiError ? err.message : t('orders.detail.optionalServicesSection.actionError'));
                        throw err;
                    }
                }}
                open={Boolean(pending)}
                requireTotp={false}
                title={t(
                    pending?.kind === 'cancel'
                        ? 'orders.detail.optionalServicesSection.cancelTitle'
                        : 'orders.detail.optionalServicesSection.completeTitle',
                )}
                variant={pending?.kind === 'cancel' ? 'danger' : 'primary'}
            />
        </>
    );
}

function ServiceMeta({ service }: { service: OrderOptionalService }) {
    const { t } = useTranslation();
    return (
        <>
            {t('orders.detail.optionalServicesSection.quantity', { count: service.quantity })} ·{' '}
            {money(service.unitAmountMinor, service.currency)}
            {service.completedAt && (
                <span className="mt-0.5 block">
                    {t('orders.detail.optionalServicesSection.completedAt', {
                        date: formatDate(service.completedAt),
                    })}
                </span>
            )}
            {service.customerNote && (
                <span className="mt-0.5 block">
                    {t('orders.detail.optionalServicesSection.customerNote', { note: service.customerNote })}
                </span>
            )}
            {service.adminNote && (
                <span className="mt-0.5 block">
                    {t('orders.detail.optionalServicesSection.adminNote', { note: service.adminNote })}
                </span>
            )}
        </>
    );
}
