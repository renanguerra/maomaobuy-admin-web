'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, FileDown, FileText, RefreshCw, Send, Truck } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { SummaryList, type SummaryRow } from '@/components/admin/SummaryList';
import { Timeline } from '@/components/admin/Timeline';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, formatDate, packageStatusLabel, type AdminPackage } from '@/types/api';
import { carrierMoney, kilograms, usd, type CarrierRefresh, type CarrierShipment } from '@/types/carrier';
import { CreateCarrierShipmentDialog } from './CreateCarrierShipmentDialog';

interface CarrierShipmentSectionProps {
    pkg: AdminPackage;
    /** Linha escolhida na cotação, para abrir a criação nela. */
    preferredChannelCode?: string;
    /** O despacho e o rastreio mexem no pacote; a página recarrega. */
    onPackageChanged: (updated?: AdminPackage) => void;
}

type Dialog = 'create' | 'dispatch' | 'cancel' | null;

/**
 * O envio do pacote pela Westlink: criar o pré-aviso, abrir a etiqueta,
 * despachar com o número dela, atualizar rastreio/fatura e cancelar. O
 * despacho manual da página continua valendo para quem não usa a
 * transportadora.
 */
export function CarrierShipmentSection({ pkg, preferredChannelCode, onPackageChanged }: CarrierShipmentSectionProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [shipments, setShipments] = useState<CarrierShipment[]>();
    const [loadError, setLoadError] = useState<string>();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState<string>();

    const load = useCallback(() => {
        api<CarrierShipment[]>(`/packages/${pkg.id}/carrier-shipments`)
            .then((loaded) => {
                setShipments(loaded);
                setLoadError(undefined);
            })
            .catch(() => setLoadError(t('carrier.section.loadError')));
    }, [pkg.id, t]);

    useEffect(() => {
        load();
    }, [load, pkg.status]);

    const active = shipments?.find((shipment) => shipment.status === 'CREATED');
    const cancelled = shipments?.filter((shipment) => shipment.status === 'CANCELLED') ?? [];
    const canCreate = !active && pkg.status === 'READY_FOR_DISPATCH';

    function reportError(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof ApiError ? err.message : t('common.errors.generic'),
        });
    }

    function replace(shipment: CarrierShipment) {
        setShipments((current) => [shipment, ...(current ?? []).filter((entry) => entry.id !== shipment.id)]);
    }

    function announce(result: CarrierRefresh, title: string) {
        replace(result.shipment);
        notify({
            tone: result.warnings.length > 0 ? 'warning' : 'success',
            title: result.warnings.length > 0 ? t('carrier.section.warnings') : title,
            description:
                [
                    ...result.warnings,
                    result.packageStatus
                        ? t('carrier.section.packageMoved', { status: packageStatusLabel(result.packageStatus) })
                        : '',
                ]
                    .filter(Boolean)
                    .join(' ') || undefined,
        });
        if (result.packageStatus) onPackageChanged();
    }

    async function refresh(shipment: CarrierShipment) {
        setBusy('refresh');
        try {
            announce(
                await api<CarrierRefresh>(`/carrier-shipments/${shipment.id}/refresh`, { method: 'POST' }),
                t('carrier.section.refreshed'),
            );
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function openLabel(shipment: CarrierShipment) {
        // A aba nasce no clique: aberta depois do `await`, o navegador a
        // trataria como pop-up e bloquearia.
        const tab = window.open('', '_blank');
        setBusy('label');
        try {
            const { url } = await api<{ url: string }>(`/carrier-shipments/${shipment.id}/label`);
            if (tab) tab.location.href = url;
            else window.location.href = url;
            if (!shipment.hasLabel) load();
        } catch (err) {
            tab?.close();
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function downloadProof(shipment: CarrierShipment, type: 'SHIPPING' | 'DELIVERY') {
        setBusy(`proof-${type}`);
        try {
            const proof = await api<{ fileName: string; contentBase64: string }>(
                `/carrier-shipments/${shipment.id}/proof?type=${type}`,
            );
            const bytes = Uint8Array.from(atob(proof.contentBase64), (char) => char.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = proof.fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    return (
        <SectionCard
            description={t('carrier.section.description')}
            icon={<Truck aria-hidden="true" />}
            title={t('carrier.section.title')}
            action={
                canCreate ? (
                    <Button
                        leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setDialog('create')}
                        size="small"
                    >
                        {t('carrier.section.create')}
                    </Button>
                ) : undefined
            }
        >
            {loadError && (
                <Alert tone="danger">
                    <p>{loadError}</p>
                </Alert>
            )}

            {shipments && !active && (
                <EmptyState
                    icon={Truck}
                    title={
                        pkg.status === 'READY_FOR_DISPATCH' || pkg.shippedAt
                            ? t('carrier.section.empty')
                            : t('carrier.section.notReady')
                    }
                />
            )}

            {active && (
                <ActiveShipment
                    busy={busy}
                    canCancel={pkg.shippedAt === null}
                    canDispatch={pkg.status === 'READY_FOR_DISPATCH'}
                    onCancel={() => setDialog('cancel')}
                    onDispatch={() => setDialog('dispatch')}
                    onLabel={() => openLabel(active)}
                    onProof={(type) => downloadProof(active, type)}
                    onRefresh={() => refresh(active)}
                    pkg={pkg}
                    shipment={active}
                />
            )}

            {cancelled.length > 0 && (
                <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-muted dark:text-night-muted">
                        {t('carrier.section.cancelled', { count: cancelled.length })}
                    </summary>
                    <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs text-muted dark:text-night-muted">
                        {cancelled.map((shipment) => (
                            <li key={shipment.id}>
                                <span className="mm-data">{shipment.customerOrderNo}</span> · {shipment.channelCode} ·{' '}
                                {t('carrier.section.cancelledAt', { date: formatDate(shipment.cancelledAt) })}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {dialog === 'create' && (
                <CreateCarrierShipmentDialog
                    initialChannelCode={preferredChannelCode}
                    onClose={() => setDialog(null)}
                    onCreated={(result) => {
                        setDialog(null);
                        announce(result, t('carrier.section.createdToast'));
                    }}
                    packageId={pkg.id}
                />
            )}

            <ActionDialog
                confirmLabel={t('carrier.dialogs.dispatch.confirm')}
                description={t('carrier.dialogs.dispatch.description', {
                    code: active?.trackingNumber ?? t('common.dash'),
                })}
                onCancel={() => setDialog(null)}
                onConfirm={async (values) => {
                    if (!active) return;
                    const updated = await api<AdminPackage>(`/carrier-shipments/${active.id}/dispatch`, {
                        method: 'POST',
                        body: JSON.stringify({ totpCode: values.totpCode }),
                    });
                    setDialog(null);
                    notify({ tone: 'success', title: t('carrier.section.dispatchedToast') });
                    onPackageChanged(updated);
                }}
                open={dialog === 'dispatch'}
                title={t('carrier.dialogs.dispatch.title')}
            />
            <ActionDialog
                confirmLabel={t('carrier.dialogs.cancel.confirm')}
                description={t('carrier.dialogs.cancel.description')}
                onCancel={() => setDialog(null)}
                onConfirm={async (values) => {
                    if (!active) return;
                    const updated = await api<CarrierShipment>(`/carrier-shipments/${active.id}/cancel`, {
                        method: 'POST',
                        body: JSON.stringify({ totpCode: values.totpCode }),
                    });
                    setDialog(null);
                    replace(updated);
                    notify({ tone: 'success', title: t('carrier.section.cancelledToast') });
                }}
                open={dialog === 'cancel'}
                title={t('carrier.dialogs.cancel.title')}
                variant="danger"
            />
        </SectionCard>
    );
}

function ActiveShipment({
    shipment,
    pkg,
    busy,
    canDispatch,
    canCancel,
    onRefresh,
    onLabel,
    onDispatch,
    onCancel,
    onProof,
}: {
    shipment: CarrierShipment;
    pkg: AdminPackage;
    busy: string | undefined;
    canDispatch: boolean;
    canCancel: boolean;
    onRefresh: () => void;
    onLabel: () => void;
    onDispatch: () => void;
    onCancel: () => void;
    onProof: (type: 'SHIPPING' | 'DELIVERY') => void;
}) {
    const { t } = useTranslation();
    const dash = t('common.dash');

    const numbers: SummaryRow[] = [
        { label: t('carrier.section.line'), value: `${shipment.channelCode} · ${shipment.channelName}` },
        { label: t('carrier.section.ourNumber'), value: shipment.customerOrderNo },
        { label: t('carrier.section.waybill'), value: shipment.waybillNo ?? dash },
        { label: t('carrier.section.delivery'), value: shipment.deliveryNo ?? dash },
        ...(shipment.postalTrackingNo
            ? [{ label: t('carrier.section.postal'), value: shipment.postalTrackingNo }]
            : []),
        ...(shipment.lastMileCarrier
            ? [{ label: t('carrier.section.lastMile'), value: shipment.lastMileCarrier }]
            : []),
        { label: t('carrier.section.trackingNumber'), value: shipment.trackingNumber ?? dash, emphasis: true },
    ];

    const costs: SummaryRow[] = [
        {
            label: t('carrier.section.quotedCost'),
            value: pkg.freightCostAmountMinor ? cny(pkg.freightCostAmountMinor) : dash,
        },
        {
            label: t('carrier.section.billed'),
            value: shipment.billed
                ? carrierMoney(shipment.billed.amountMinor, shipment.billed.currency)
                : t('carrier.section.notBilled'),
        },
        ...(shipment.billed?.weightGrams
            ? [{ label: t('carrier.section.billedWeight'), value: kilograms(shipment.billed.weightGrams) }]
            : []),
        ...(shipment.billed && shipment.billed.currency === 'CNY' && pkg.freightCostAmountMinor
            ? [
                  {
                      label: t('carrier.section.difference'),
                      value: cny((BigInt(pkg.freightCostAmountMinor) - BigInt(shipment.billed.amountMinor)).toString()),
                      emphasis: true,
                  },
              ]
            : []),
        ...(shipment.warehouseMeasurement?.weightKg
            ? [
                  {
                      label: t('carrier.section.measured'),
                      value: [
                          `${shipment.warehouseMeasurement.weightKg} kg`,
                          shipment.warehouseMeasurement.lengthCm
                              ? `${shipment.warehouseMeasurement.lengthCm} × ${shipment.warehouseMeasurement.widthCm} × ${shipment.warehouseMeasurement.heightCm} cm`
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' · '),
                  },
              ]
            : []),
        {
            label: t('carrier.section.declared'),
            value: t('carrier.section.declaredTotal', {
                amount: usd(shipment.declared.totalUsdCents),
                count: shipment.declared.items.length,
            }),
        },
    ];

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="info">{shipment.trackingStatusLabel ?? t('carrier.section.created')}</StatusPill>
                <span className="text-xs text-muted dark:text-night-muted">
                    {shipment.trackingSyncedAt
                        ? t('carrier.section.syncedAt', { date: formatDate(shipment.trackingSyncedAt) })
                        : t('carrier.section.createdAt', { date: formatDate(shipment.createdAt) })}
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    leadingIcon={<FileText className="h-4 w-4" aria-hidden="true" />}
                    loading={busy === 'label'}
                    onClick={onLabel}
                    size="small"
                >
                    {t('carrier.section.label')}
                </Button>
                {canDispatch && (
                    <Button
                        disabled={!shipment.trackingNumber}
                        leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                        onClick={onDispatch}
                        size="small"
                        variant="secondary"
                    >
                        {t('carrier.section.dispatch')}
                    </Button>
                )}
                <Button
                    leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    loading={busy === 'refresh'}
                    onClick={onRefresh}
                    size="small"
                    variant="secondary"
                >
                    {t('carrier.section.refresh')}
                </Button>
                {pkg.shippedAt && (
                    <Button
                        leadingIcon={<FileDown className="h-4 w-4" aria-hidden="true" />}
                        loading={busy === 'proof-SHIPPING'}
                        onClick={() => onProof('SHIPPING')}
                        size="small"
                        variant="ghost"
                    >
                        {t('carrier.section.proofShipping')}
                    </Button>
                )}
                {pkg.status === 'DELIVERED' && (
                    <Button
                        leadingIcon={<FileDown className="h-4 w-4" aria-hidden="true" />}
                        loading={busy === 'proof-DELIVERY'}
                        onClick={() => onProof('DELIVERY')}
                        size="small"
                        variant="ghost"
                    >
                        {t('carrier.section.proofDelivery')}
                    </Button>
                )}
                {canCancel && (
                    <Button
                        leadingIcon={<Ban className="h-4 w-4" aria-hidden="true" />}
                        onClick={onCancel}
                        size="small"
                        variant="dangerGhost"
                    >
                        {t('carrier.section.cancel')}
                    </Button>
                )}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <SummaryList rows={numbers} />
                <SummaryList rows={costs} />
            </div>

            <div>
                <h3 className="m-0 mb-3 text-sm font-semibold text-ink dark:text-night-text">
                    {t('carrier.section.events')}
                </h3>
                {shipment.trackingEvents.length === 0 ? (
                    <p className="m-0 text-sm text-muted dark:text-night-muted">{t('carrier.section.noEvents')}</p>
                ) : (
                    <Timeline
                        entries={shipment.trackingEvents.map((event, index) => ({
                            id: `${event.time}-${index}`,
                            title: event.statusLabel ?? event.status ?? event.content,
                            meta: [
                                event.time,
                                event.timeZone,
                                event.fromLastMile ? t('carrier.section.lastMileEvent') : '',
                            ]
                                .filter(Boolean)
                                .join(' · '),
                            body: [event.content, event.location].filter(Boolean).join(' — '),
                        }))}
                    />
                )}
            </div>
        </div>
    );
}
