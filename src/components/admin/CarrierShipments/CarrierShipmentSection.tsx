'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Ban, FileDown, FileText, ReceiptText, RefreshCw, Send, Truck } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { SummaryList, type SummaryRow } from '@/components/admin/SummaryList';
import { Timeline } from '@/components/admin/Timeline';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { useDispatchFields } from '@/services/admin/shipping-modalities';
import { api, ApiError } from '@/services/api';
import { cny, formatDate, packageStatusLabel, type AdminPackage } from '@/types/api';
import { carrierMoney, kilograms, usd, type CarrierRefresh, type CarrierShipment } from '@/types/carrier';
import { CreateCarrierShipmentDialog } from './CreateCarrierShipmentDialog';

interface CarrierShipmentSectionProps {
    pkg: AdminPackage;
    /** Linhas de sempre, de qualquer envio; a Westlink só acrescenta as dela. */
    transportRows: SummaryRow[];
    volumeRows: SummaryRow[];
    chargeRows: SummaryRow[];
    /** Declaração do lojista (modo e texto), quando houver. */
    declaration?: ReactNode;
    /** Ações de sempre; as da Westlink entram depois, no mesmo padrão. */
    actions?: ReactNode[];
    /** Só a partir do despacho há envio na Westlink para buscar. */
    carrierEnabled: boolean;
    /** Linha escolhida na cotação, para abrir a criação nela. */
    preferredChannelCode?: string;
    /** O despacho e o rastreio mexem no pacote; a página recarrega. */
    onPackageChanged: (updated?: AdminPackage) => void;
    /** Avisa a página se há envio vivo — o despacho manual perde o destaque. */
    onActiveChange?: (hasActive: boolean) => void;
}

type Dialog = 'create' | 'dispatch' | 'cancel' | null;

/**
 * O cartão "Envio" do pacote, igual para todo envio: Transporte e Volume à
 * esquerda, Cobrança e Custo à direita, Declaração e Rastreio embaixo. Um
 * provedor pela API (hoje a Westlink) só acrescenta: linhas nos mesmos
 * blocos, documentos, a tabela da declaração, os eventos e as ações dele no
 * mesmo cabeçalho. Nada aparece duas vezes: número igual ao rastreio, custo
 * zerado e medida igual à faturada ficam de fora.
 */
export function CarrierShipmentSection({
    pkg,
    transportRows,
    volumeRows,
    chargeRows,
    declaration,
    actions = [],
    carrierEnabled,
    preferredChannelCode,
    onPackageChanged,
    onActiveChange,
}: CarrierShipmentSectionProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [loadedShipments, setShipments] = useState<CarrierShipment[]>();
    // Antes do despacho não há envio na Westlink: nem se busca.
    const shipments = carrierEnabled ? loadedShipments : [];
    const [loadError, setLoadError] = useState<string>();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState<string>();

    const load = useCallback(() => {
        if (!carrierEnabled) return;
        api<CarrierShipment[]>(`/packages/${pkg.id}/carrier-shipments`)
            .then((loaded) => {
                setShipments(loaded);
                setLoadError(undefined);
            })
            .catch(() => setLoadError(t('carrier.section.loadError')));
    }, [pkg.id, carrierEnabled, t]);

    useEffect(() => {
        load();
    }, [load, pkg.status]);

    const active = shipments?.find((shipment) => shipment.status === 'CREATED');
    const hasActive = Boolean(active);
    const { modalityField } = useDispatchFields(dialog === 'dispatch');

    useEffect(() => {
        onActiveChange?.(hasActive);
    }, [hasActive, onActiveChange]);
    const cancelled = shipments?.filter((shipment) => shipment.status === 'CANCELLED') ?? [];
    const canCreate = Boolean(shipments) && !active && pkg.status === 'READY_FOR_DISPATCH';

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

    const billed = active?.billed ?? null;
    const freightCost =
        pkg.freightCostAmountMinor && BigInt(pkg.freightCostAmountMinor) > BigInt(0)
            ? pkg.freightCostAmountMinor
            : null;

    // O que só a Westlink tem, encaixado nos blocos de sempre.
    const providerTransport: SummaryRow[] = active
        ? [
              {
                  label: t('packages.detail.fields.carrier'),
                  value: `Westlink · ${active.channelCode} ${active.channelName}`,
              },
              ...(active.waybillNo ? [{ label: t('carrier.section.waybill'), value: active.waybillNo }] : []),
              // O ITS repete números: só aparece o que é diferente do rastreio do pacote.
              ...(active.trackingNumber && active.trackingNumber !== pkg.trackingCode
                  ? [{ label: t('carrier.section.trackingNumber'), value: active.trackingNumber }]
                  : []),
              ...(active.deliveryNo && active.deliveryNo !== (pkg.trackingCode ?? active.trackingNumber)
                  ? [{ label: t('carrier.section.delivery'), value: active.deliveryNo }]
                  : []),
              ...(active.postalTrackingNo && active.postalTrackingNo !== (pkg.trackingCode ?? active.trackingNumber)
                  ? [{ label: t('carrier.section.postal'), value: active.postalTrackingNo }]
                  : []),
              ...(active.customerOrderNo !== pkg.packageCode
                  ? [{ label: t('carrier.section.ourNumber'), value: active.customerOrderNo }]
                  : []),
              ...(active.lastMileCarrier
                  ? [{ label: t('carrier.section.lastMile'), value: active.lastMileCarrier }]
                  : []),
          ]
        : [];
    const measuredKg = active?.warehouseMeasurement?.weightKg ?? null;
    const providerVolume: SummaryRow[] = [
        ...(billed?.weightGrams
            ? [{ label: t('carrier.section.billedWeight'), value: kilograms(billed.weightGrams) }]
            : []),
        ...(measuredKg && Math.round(measuredKg * 1000) !== billed?.weightGrams
            ? [{ label: t('carrier.section.measured'), value: kilograms(Math.round(measuredKg * 1000)) }]
            : []),
    ];
    const costRows: SummaryRow[] = [
        ...(freightCost ? [{ label: t('carrier.section.quotedCost'), value: cny(freightCost) }] : []),
        ...(active
            ? [
                  {
                      label: t('carrier.section.billed'),
                      value: billed
                          ? carrierMoney(billed.amountMinor, billed.currency)
                          : t('carrier.section.notBilled'),
                  },
              ]
            : []),
        ...(billed && billed.currency === 'CNY' && freightCost
            ? [
                  {
                      label: t('carrier.section.difference'),
                      value: cny((BigInt(freightCost) - BigInt(billed.amountMinor)).toString()),
                      emphasis: true,
                  },
              ]
            : []),
    ];

    const canDispatchShipment = Boolean(active) && pkg.status === 'READY_FOR_DISPATCH';
    const headerActions: ReactNode[] = [
        ...actions,
        active && (
            <Button
                key="carrier-refresh"
                leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                loading={busy === 'refresh'}
                onClick={() => refresh(active)}
                size="small"
                variant="secondary"
            >
                {t('carrier.section.refresh')}
            </Button>
        ),
        active && pkg.shippedAt === null && (
            <Button
                key="carrier-cancel"
                leadingIcon={<Ban className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('cancel')}
                size="small"
                variant="dangerGhost"
            >
                {t('carrier.section.cancel')}
            </Button>
        ),
        canCreate && (
            <Button
                key="carrier-create"
                leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('create')}
                size="small"
            >
                {t('carrier.section.create')}
            </Button>
        ),
        canDispatchShipment && (
            <Button
                disabled={!active?.trackingNumber}
                key="carrier-dispatch"
                leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('dispatch')}
                size="small"
            >
                {t('carrier.section.dispatch')}
            </Button>
        ),
    ].filter(Boolean);

    const documents: ReactNode[] = active
        ? [
              <DocumentButton
                  icon={FileText}
                  key="label"
                  label={t('carrier.section.label')}
                  loading={busy === 'label'}
                  onClick={() => openLabel(active)}
              />,
              pkg.shippedAt && (
                  <DocumentButton
                      icon={FileDown}
                      key="proof-shipping"
                      label={t('carrier.section.proofShipping')}
                      loading={busy === 'proof-SHIPPING'}
                      onClick={() => downloadProof(active, 'SHIPPING')}
                  />
              ),
              pkg.status === 'DELIVERED' && (
                  <DocumentButton
                      icon={FileDown}
                      key="proof-delivery"
                      label={t('carrier.section.proofDelivery')}
                      loading={busy === 'proof-DELIVERY'}
                      onClick={() => downloadProof(active, 'DELIVERY')}
                  />
              ),
              billed && (
                  <ButtonLink
                      href={`/impressao/frete?pacote=${pkg.id}`}
                      key="freight-receipt"
                      leadingIcon={<ReceiptText className="h-4 w-4" aria-hidden="true" />}
                      rel="noopener"
                      size="small"
                      target="_blank"
                      variant="ghost"
                  >
                      {t('carrier.section.freightReceipt')}
                  </ButtonLink>
              ),
          ].filter(Boolean)
        : [];

    const status = active
        ? [
              t('carrier.section.provider'),
              active.trackingStatusLabel ?? active.trackingStatus ?? t('carrier.section.created'),
              active.trackingSyncedAt
                  ? t('carrier.section.syncedAt', { date: formatDate(active.trackingSyncedAt) })
                  : t('carrier.section.createdAt', { date: formatDate(active.createdAt) }),
          ].join(' · ')
        : undefined;

    return (
        <>
            <SectionCard
                action={headerActions.length > 0 ? headerActions : undefined}
                bodyClassName="grid gap-6"
                description={status}
                icon={<Truck aria-hidden="true" />}
                title={t('packages.detail.shippingSection')}
            >
                {loadError && (
                    <Alert tone="danger">
                        <p>{loadError}</p>
                    </Alert>
                )}
                {canDispatchShipment && !active?.trackingNumber && (
                    <p className="m-0 text-xs text-muted dark:text-night-muted">{t('carrier.section.waitingNumber')}</p>
                )}

                {documents.length > 0 && (
                    <div className="-mt-1 flex flex-wrap items-center gap-x-1 gap-y-2">
                        <BlockTitle className="mr-2 mb-0">{t('carrier.section.documents')}</BlockTitle>
                        {documents}
                    </div>
                )}

                <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
                    <div className="grid min-w-0 content-start gap-6">
                        <Block
                            rows={[...providerTransport, ...transportRows]}
                            title={t('packages.detail.transportBlock')}
                        />
                        <Block rows={[...volumeRows, ...providerVolume]} title={t('carrier.section.volumeBlock')} />
                    </div>
                    <div className="grid min-w-0 content-start gap-6">
                        <Block rows={chargeRows} title={t('packages.detail.chargeBlock')} />
                        <Block rows={costRows} title={t('carrier.section.costBlock')} />
                    </div>
                </div>

                {(declaration || active) && (
                    <div className="grid gap-3">
                        <BlockTitle>{t('carrier.section.declarationBlock')}</BlockTitle>
                        {declaration}
                        {active && <DeclaredItems declared={active.declared} />}
                    </div>
                )}

                {active && <TrackingEvents shipment={active} />}

                {cancelled.length > 0 && (
                    <details>
                        <summary className="cursor-pointer text-xs font-semibold text-muted dark:text-night-muted">
                            {t('carrier.section.cancelled', { count: cancelled.length })}
                        </summary>
                        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs text-muted dark:text-night-muted">
                            {cancelled.map((shipment) => (
                                <li key={shipment.id}>
                                    <span className="mm-data">{shipment.customerOrderNo}</span> · {shipment.channelCode}{' '}
                                    · {t('carrier.section.cancelledAt', { date: formatDate(shipment.cancelledAt) })}
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </SectionCard>

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
                        body: JSON.stringify({
                            totpCode: values.totpCode,
                            shippingModalityId: values.shippingModalityId,
                        }),
                    });
                    setDialog(null);
                    notify({ tone: 'success', title: t('carrier.section.dispatchedToast') });
                    onPackageChanged(updated);
                }}
                fields={[modalityField(pkg, { westlinkCode: active?.channelCode })]}
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
        </>
    );
}

/** Título de bloco: o mesmo em Transporte, Volume, Cobrança, Custo, Declaração e Rastreio. */
function BlockTitle({ children, className = 'mb-1' }: { children: ReactNode; className?: string }) {
    return (
        <h3
            className={`m-0 text-xs font-semibold tracking-wide text-muted uppercase dark:text-night-muted ${className}`}
        >
            {children}
        </h3>
    );
}

/** Bloco sem linhas some: envio comum não mostra "Custo" vazio. */
function Block({ title, rows }: { title: string; rows: SummaryRow[] }) {
    if (rows.length === 0) return null;
    return (
        <div className="min-w-0">
            <BlockTitle>{title}</BlockTitle>
            <SummaryList rows={rows} />
        </div>
    );
}

function DocumentButton({
    icon: Icon,
    label,
    loading,
    onClick,
}: {
    icon: typeof FileText;
    label: string;
    loading: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            leadingIcon={<Icon className="h-4 w-4" aria-hidden="true" />}
            loading={loading}
            onClick={onClick}
            size="small"
            variant="ghost"
        >
            {label}
        </Button>
    );
}

/** Recolhido de início: a lista cresce a cada consulta e empurra o resto da página. */
function TrackingEvents({ shipment }: { shipment: CarrierShipment }) {
    const { t } = useTranslation();
    return (
        <details>
            <summary className="cursor-pointer">
                <BlockTitle className="inline">{t('carrier.section.events')}</BlockTitle>
                <span className="ml-2 text-xs text-muted dark:text-night-muted">
                    {t('carrier.section.eventsCount', { count: shipment.trackingEvents.length })}
                </span>
            </summary>
            <div className="mt-3">
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
        </details>
    );
}

/**
 * O que foi declarado à Westlink na criação do envio, como ficou gravado nele
 * (não o cadastro atual do produto): é o que a alfândega recebeu.
 */
function DeclaredItems({ declared }: { declared: CarrierShipment['declared'] }) {
    const { t } = useTranslation();
    const parcel = declared.parcel;
    const cell = 'border-t border-line px-2 py-1.5 align-top dark:border-night-line';

    return (
        <div>
            <p className="m-0 mb-2 text-xs text-muted dark:text-night-muted">
                {t('carrier.section.declaredHint', { currency: declared.currency })}
            </p>
            <div className="mm-scroll-x">
                <table className="w-full min-w-[34rem] border-collapse text-sm text-ink dark:text-night-text">
                    <thead>
                        <tr className="text-left text-xs text-muted dark:text-night-muted">
                            <th className="px-2 py-1.5 font-semibold">{t('carrier.section.declaredItem')}</th>
                            <th className="px-2 py-1.5 font-semibold">HS</th>
                            <th className="px-2 py-1.5 text-right font-semibold">
                                {t('carrier.section.declaredQuantity')}
                            </th>
                            <th className="px-2 py-1.5 text-right font-semibold">
                                {t('carrier.section.declaredUnit')}
                            </th>
                            <th className="px-2 py-1.5 text-right font-semibold">
                                {t('carrier.section.declaredSubtotal')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {declared.items.map((item, index) => (
                            <tr key={`${item.englishName}-${index}`}>
                                <td className={cell}>
                                    <span className="block">{item.englishName}</span>
                                    <span className="block text-xs text-muted dark:text-night-muted">
                                        {item.chineseName}
                                    </span>
                                </td>
                                <td className={`${cell} mm-data`}>{item.hsCode ?? t('common.dash')}</td>
                                <td className={`${cell} mm-data text-right`}>{item.quantity}</td>
                                <td className={`${cell} mm-data text-right whitespace-nowrap`}>
                                    {usd(item.unitDeclaredUsdCents)}
                                </td>
                                <td className={`${cell} mm-data text-right whitespace-nowrap`}>
                                    {usd(item.unitDeclaredUsdCents * item.quantity)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-semibold">
                            <td className={cell} colSpan={4}>
                                {t('carrier.section.declaredTotalLabel')}
                            </td>
                            <td className={`${cell} mm-data text-right whitespace-nowrap`}>
                                {usd(declared.totalUsdCents)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {parcel && (
                <p className="m-0 mt-2 text-xs text-muted dark:text-night-muted">
                    {t('carrier.section.declaredParcel', {
                        weight: kilograms(parcel.weightGrams),
                        size: `${parcel.lengthMillimeters / 10} × ${parcel.widthMillimeters / 10} × ${parcel.heightMillimeters / 10} cm`,
                    })}
                </p>
            )}
        </div>
    );
}
