'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    CheckCircle2,
    History,
    MessageSquare,
    PackageCheck,
    Pencil,
    Send,
    Truck,
    Wallet,
    XCircle,
} from 'lucide-react';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { ActionBar } from '@/components/admin/ActionBar';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { MessageThread } from '@/components/admin/MessageThread';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { orderStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { SummaryList } from '@/components/admin/SummaryList';
import { Timeline } from '@/components/admin/Timeline';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/translations';
import { api, ApiError } from '@/services/api';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import {
    formatDate,
    lineTotalMinor,
    money,
    orderChangeLogTypeLabel,
    orderStatusLabel,
    totalUnits,
    type AdminOrder,
} from '@/types/api';
import { QuantityBadge } from '@/components/admin/QuantityBadge';
import { InspectionCard } from '@/components/admin/InspectionCard';
import { OrderMediaManager } from './OrderMediaManager';
import { OrderOptionalServicesSection } from './OrderOptionalServices';
import { OrderAmountDialog, type OrderAmountDialogValues } from './OrderAmountDialog';

type ApprovalDialogKind = 'approve' | 'reject' | 'request-customer-approval' | 'confirm-refund' | 'fail-sourcing';
type AmountDialogKind = 'change-price' | 'change-shipping-estimate';
type DialogKind = ApprovalDialogKind | AmountDialogKind | 'edit-description' | null;

const APPROVAL_FEEDBACK_KEY: Record<ApprovalDialogKind, MessageKey> = {
    approve: 'orders.detail.feedback.approve',
    reject: 'orders.detail.feedback.reject',
    'request-customer-approval': 'orders.detail.feedback.request-customer-approval',
    'confirm-refund': 'orders.detail.feedback.confirm-refund',
    'fail-sourcing': 'orders.detail.feedback.fail-sourcing',
};

/**
 * Etapas de aquisição, na ordem. O botão mostrado é sempre o próximo passo do
 * pedido — a operação nunca escolhe para onde pular.
 */
/** Fases pagas em que o backend ainda aceita cancelar (`REJECTABLE_STATUSES`). */
const PAID_CANCELLABLE_STATUSES = [
    'SUBMITTED',
    'PURCHASED',
    'SELLER_SHIPPED',
    'IN_WAREHOUSE',
    'INSPECTION_PENDING',
    'READY_TO_SHIP',
];

const SOURCING_NEXT_STEP: Record<string, { status: string; labelKey: MessageKey }> = {
    SUBMITTED: { status: 'PURCHASED', labelKey: 'orders.detail.actions.markPurchased' },
    PURCHASED: { status: 'SELLER_SHIPPED', labelKey: 'orders.detail.actions.markSellerShipped' },
    SELLER_SHIPPED: { status: 'IN_WAREHOUSE', labelKey: 'orders.detail.actions.markInWarehouse' },
};

export function OrderDetailPage() {
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const { notify } = useToast();
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [order, setOrder] = useState<AdminOrder>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [busy, setBusy] = useState<string>();

    const load = useCallback(() => {
        api<AdminOrder>(`/orders/${params.id}`)
            .then((loaded) => {
                setOrder(loaded);
                setError(undefined);
            })
            .catch(() => setError(t('orders.detail.error')));
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    /** Toda transição de estado muda uma fila — os selos da lateral precisam acompanhar. */
    function applyUpdate(updated: AdminOrder, message: string) {
        setOrder(updated);
        setDialog(null);
        notify({ tone: 'success', title: message });
        void refreshPendingCounts();
    }

    async function handleApprovalConfirm(values: { totpCode: string; reason: string }) {
        const action = dialog as ApprovalDialogKind;
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            applyUpdate(updated, t(APPROVAL_FEEDBACK_KEY[action]));
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    async function handleDescriptionConfirm(values: { reason: string; adminDescription: string }) {
        const updated = await api<AdminOrder>(`/orders/${params.id}/description`, {
            method: 'PATCH',
            body: JSON.stringify({ reason: values.reason, adminDescription: values.adminDescription }),
        });
        applyUpdate(updated, t('orders.detail.feedback.descriptionUpdated'));
    }

    async function handlePriceConfirm(values: OrderAmountDialogValues) {
        const updated = await api<AdminOrder>(`/orders/${params.id}/price`, {
            method: 'POST',
            body: JSON.stringify({
                totpCode: values.totpCode,
                reason: values.reason,
                newTotalAmountMinor: values.newAmountMinor,
            }),
        });
        applyUpdate(updated, t('orders.detail.feedback.priceChanged'));
    }

    async function handleShippingEstimateConfirm(values: OrderAmountDialogValues) {
        const updated = await api<AdminOrder>(`/orders/${params.id}/shipping-estimate`, {
            method: 'POST',
            body: JSON.stringify({
                totpCode: values.totpCode,
                reason: values.reason,
                newShippingEstimateAmountMinor: values.newAmountMinor,
            }),
        });
        applyUpdate(updated, t('orders.detail.feedback.shippingEstimateChanged'));
    }

    async function advanceSourcing(status: string) {
        setBusy('sourcing');
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/sourcing`, {
                method: 'POST',
                body: JSON.stringify({ status }),
            });
            applyUpdate(updated, t('orders.detail.feedback.sourcingAdvanced'));
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setBusy(undefined);
        }
    }

    /** Abre o laudo de um item que chegou ao armazém. */
    async function openInspection(orderItemId: string) {
        setBusy('inspection');
        try {
            await api(`/inspections`, {
                method: 'POST',
                body: JSON.stringify({ orderItemId }),
            });
            load();
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setBusy(undefined);
        }
    }

    async function publishInspection(inspectionId: string) {
        setBusy('inspection');
        try {
            await api(`/inspections/${inspectionId}/publish`, { method: 'POST' });
            notify({ tone: 'success', title: t('inspections.feedback.published') });
            void refreshPendingCounts();
            load();
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setBusy(undefined);
        }
    }

    async function markReadyToShip() {
        setBusy('mark-ready-to-ship');
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/mark-ready-to-ship`, {
                method: 'POST',
                body: JSON.stringify({ reason: t('orders.detail.actions.markReadyToShipReason') }),
            });
            applyUpdate(updated, t('orders.detail.feedback.markedReadyToShip'));
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setBusy(undefined);
        }
    }

    if (error) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/pedidos"
                    backLabel={t('orders.detail.backLink')}
                    title={t('orders.list.title')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/pedidos"
                    backLabel={t('orders.detail.backLink')}
                    title={t('orders.detail.loading')}
                />
                <SkeletonCards label={t('orders.detail.loading')} />
            </div>
        );
    }

    const canDraft = order.status === 'AWAITING_REVIEW';
    const awaitingPayment = order.status === 'UNPAID';
    // Mídia e descrição ficam abertas até o pagamento ser confirmado: é o que
    // o cliente olha para decidir se paga.
    const canEditDescriptionAndMedia = canDraft || awaitingPayment || order.status === 'AWAITING_CUSTOMER_APPROVAL';
    // Valor e frete podem mudar enquanto ninguém foi cobrado. Em UNPAID,
    // subir o valor devolve o pedido à aprovação do cliente.
    const canReprice = canDraft || awaitingPayment || order.status === 'AWAITING_CUSTOMER_APPROVAL';
    const priceAuthorized =
        order.customerApprovedTotalMinor !== null &&
        BigInt(order.totalAmountMinor) <= BigInt(order.customerApprovedTotalMinor);
    const sourcingStep = order.fulfillmentMode === 'SOURCED' ? SOURCING_NEXT_STEP[order.status] : undefined;
    // Só o admin master devolve dinheiro (`@Roles(SUPERADMIN)` em confirm-refund).
    const canConfirmRefund = admin?.role === 'SUPERADMIN';
    // Itens que chegaram ao armazém e ainda não têm laudo aberto.
    const inspectedItemIds = new Set(order.inspections.map((inspection) => inspection.orderItemId));
    const itemsWithoutInspection =
        order.status === 'IN_WAREHOUSE' ? order.items.filter((item) => !inspectedItemIds.has(item.id)) : [];
    // Espelha `REJECTABLE_STATUSES` do backend: pedido pago que ainda não
    // viajou pode ser cancelado e o pagamento volta ao saldo na hora.
    const canCancelPaid = PAID_CANCELLABLE_STATUSES.includes(order.status);
    const hasActions =
        canEditDescriptionAndMedia ||
        canReprice ||
        Boolean(sourcingStep) ||
        canCancelPaid ||
        order.status === 'INSPECTION_PENDING' ||
        order.status === 'REFUND_REQUESTED';

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/pedidos"
                backLabel={t('orders.detail.backLink')}
                badge={<StatusPill tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusPill>}
                title={`#${order.id.slice(0, 8)}`}
                kicker={
                    order.origin === 'EXTERNAL_LINK'
                        ? t('orders.detail.kickerExternalLink')
                        : t('orders.detail.kickerCatalog')
                }
                meta={
                    <>
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={`/admin/usuarios/${order.userId}`}
                        >
                            {order.userName}
                        </Link>{' '}
                        · {order.userEmail}
                    </>
                }
            />

            {order.rejectionReason && (
                <Alert tone="danger" title={t('orders.detail.fields.rejectionReason')}>
                    <p>{order.rejectionReason}</p>
                </Alert>
            )}

            {hasActions && (
                <ActionBar
                    description={t('orders.detail.actionBar.description')}
                    title={t('orders.detail.actionBar.title', { status: orderStatusLabel(order.status) })}
                >
                    {canEditDescriptionAndMedia && (
                        <Button
                            leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('edit-description')}
                            size="small"
                            variant="ghost"
                        >
                            {t('orders.detail.actions.editDescription')}
                        </Button>
                    )}
                    {canReprice && (
                        <>
                            <Button
                                leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('change-price')}
                                size="small"
                                variant="ghost"
                            >
                                {t('orders.detail.actions.changePrice')}
                            </Button>
                            <Button
                                leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('change-shipping-estimate')}
                                size="small"
                                variant="ghost"
                            >
                                {t('orders.detail.actions.changeShippingEstimate')}
                            </Button>
                        </>
                    )}
                    {(canDraft || awaitingPayment) && !priceAuthorized && (
                        <Button
                            leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('request-customer-approval')}
                            size="small"
                            variant="secondary"
                        >
                            {t('orders.detail.actions.requestCustomerApproval')}
                        </Button>
                    )}
                    {canDraft && (
                        <>
                            <Button
                                disabled={!priceAuthorized}
                                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('approve')}
                                size="small"
                                title={priceAuthorized ? undefined : t('orders.detail.actions.needsCustomerApproval')}
                            >
                                {t('orders.detail.actions.approve')}
                            </Button>
                            <Button
                                leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('reject')}
                                size="small"
                                variant="danger"
                            >
                                {t('orders.detail.actions.reject')}
                            </Button>
                        </>
                    )}
                    {order.status === 'AWAITING_CUSTOMER_APPROVAL' && (
                        <Button
                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('reject')}
                            size="small"
                            variant="danger"
                        >
                            {t('orders.detail.actions.cancelOrder')}
                        </Button>
                    )}
                    {awaitingPayment && (
                        <Button
                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('reject')}
                            size="small"
                            variant="danger"
                        >
                            {t('orders.detail.actions.cancelOrderRestock')}
                        </Button>
                    )}
                    {sourcingStep && (
                        <Button
                            leadingIcon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}
                            loading={busy === 'sourcing'}
                            onClick={() => advanceSourcing(sourcingStep.status)}
                            size="small"
                        >
                            {t(sourcingStep.labelKey)}
                        </Button>
                    )}
                    {order.status === 'IN_WAREHOUSE' && (
                        <Button
                            leadingIcon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => router.push(`/admin/inspecoes?orderId=${order.id}`)}
                            size="small"
                        >
                            {t('orders.detail.actions.openInspection')}
                        </Button>
                    )}
                    {order.status === 'INSPECTION_PENDING' && (
                        <Button
                            leadingIcon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}
                            loading={busy === 'mark-ready-to-ship'}
                            onClick={markReadyToShip}
                            size="small"
                            variant="ghost"
                        >
                            {t('orders.detail.actions.markReadyToShip')}
                        </Button>
                    )}
                    {sourcingStep && (
                        <Button
                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('fail-sourcing')}
                            size="small"
                            variant="danger"
                        >
                            {t('orders.detail.actions.failSourcing')}
                        </Button>
                    )}
                    {canCancelPaid && (
                        <Button
                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('reject')}
                            size="small"
                            variant="danger"
                        >
                            {t('orders.detail.actions.cancelOrderRefund')}
                        </Button>
                    )}
                    {order.status === 'REFUND_REQUESTED' &&
                        (canConfirmRefund ? (
                            <Button
                                leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('confirm-refund')}
                                size="small"
                            >
                                {t('orders.detail.actions.confirmRefund')}
                            </Button>
                        ) : (
                            <p className="m-0 text-sm text-muted">
                                {t('orders.detail.actions.confirmRefundSuperadminOnly')}
                            </p>
                        ))}
                </ActionBar>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div className="grid min-w-0 gap-5">
                    <SectionCard
                        flush
                        title={t('orders.detail.itemsSection.title')}
                        description={t('orders.detail.itemsSection.summary', {
                            products: order.items.length,
                            units: totalUnits(order.items),
                        })}
                    >
                        <ListRows>
                            {order.items.map((item) => (
                                <li key={item.id}>
                                    <ListRow
                                        leading={<QuantityBadge quantity={item.quantity} />}
                                        title={
                                            <>
                                                <span className="sr-only">{item.quantity} × </span>
                                                {item.productName}
                                            </>
                                        }
                                        value={money(lineTotalMinor(item.unitAmountMinor, item.quantity), item.currency)}
                                        meta={
                                            <>
                                                {item.storeProductId
                                                    ? t('orders.detail.itemsSection.ownCatalog')
                                                    : item.marketplace}{' '}
                                                ·{' '}
                                                {t('orders.detail.itemsSection.unitPrice', {
                                                    count: item.quantity,
                                                    amount: money(item.unitAmountMinor, item.currency),
                                                })}
                                                {item.size
                                                    ? t('orders.detail.itemsSection.size', { size: item.size })
                                                    : ''}
                                                {item.category ? ` · ${item.category.name}` : ''}
                                                {item.referencePriceCnyMinor
                                                    ? ` · ${t('orders.detail.itemsSection.declaredPrice', {
                                                          amount: money(item.referencePriceCnyMinor, 'CNY'),
                                                      })}`
                                                    : ''}
                                                {item.marketplaceUrl && (
                                                    <a
                                                        className="mt-1 block truncate text-primary dark:text-night-accent"
                                                        href={item.marketplaceUrl}
                                                        rel="noreferrer"
                                                        target="_blank"
                                                    >
                                                        {item.marketplaceUrl}
                                                    </a>
                                                )}
                                            </>
                                        }
                                    />
                                </li>
                            ))}
                        </ListRows>
                    </SectionCard>

                    <OrderOptionalServicesSection order={order} onChanged={load} />

                    {order.adminDescription && (
                        <SectionCard title={t('orders.detail.fields.adminDescription')}>
                            <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-ink dark:text-night-text">
                                {order.adminDescription}
                            </p>
                        </SectionCard>
                    )}

                    {itemsWithoutInspection.length > 0 && (
                        <SectionCard
                            description={t('orders.detail.inspectionSection.description')}
                            title={t('orders.detail.inspectionSection.title')}
                        >
                            <ul className="m-0 grid list-none gap-2 p-0">
                                {itemsWithoutInspection.map((item) => (
                                    <li
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 dark:border-night-line"
                                        key={item.id}
                                    >
                                        <span className="min-w-0 truncate text-sm font-semibold text-ink dark:text-night-text">
                                            {item.productName}
                                        </span>
                                        <Button
                                            loading={busy === 'inspection'}
                                            onClick={() => openInspection(item.id)}
                                            size="small"
                                        >
                                            {t('inspections.queue.open')}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}

                    {order.inspections.map((inspection) => (
                        <InspectionCard
                            busy={busy === 'inspection'}
                            inspection={inspection}
                            key={inspection.id}
                            onChanged={async () => load()}
                            onFail={(err) =>
                                notify({
                                    tone: 'danger',
                                    title: t('common.errors.actionTitle'),
                                    description: err instanceof ApiError ? err.message : t('common.errors.generic'),
                                })
                            }
                            onPublish={() => publishInspection(inspection.id)}
                        />
                    ))}

                    {canEditDescriptionAndMedia ? (
                        <OrderMediaManager media={order.media} onChanged={load} orderId={order.id} />
                    ) : (
                        <SectionCard title={t('orders.detail.mediaSection.title')}>
                            {order.media.length === 0 ? (
                                <EmptyState title={t('orders.detail.mediaSection.empty')} />
                            ) : (
                                <MediaGrid>
                                    {order.media.map((item) => (
                                        <MediaTile
                                            alt={item.altText ?? ''}
                                            key={item.id}
                                            kind={item.type}
                                            openLabel={t('common.actions.open')}
                                            url={item.url}
                                        />
                                    ))}
                                </MediaGrid>
                            )}
                        </SectionCard>
                    )}

                    <SectionCard
                        description={t('orders.detail.history.description')}
                        icon={<History aria-hidden="true" />}
                        title={t('orders.detail.history.title')}
                    >
                        {order.changeLogs.length === 0 ? (
                            <EmptyState icon={History} title={t('orders.detail.history.empty')} />
                        ) : (
                            <Timeline
                                entries={order.changeLogs.map((log) => ({
                                    id: log.id,
                                    title: orderChangeLogTypeLabel(log.type),
                                    meta: `${formatDate(log.createdAt)} · ${log.createdByAdminId ?? t('orders.detail.history.customerFallback')}`,
                                    body: log.reason,
                                    change:
                                        log.type === 'PRICE_CHANGED' && log.previousValue && log.newValue
                                            ? `${money(String(log.previousValue.totalAmountMinor))} → ${money(String(log.newValue.totalAmountMinor))}`
                                            : log.type === 'SHIPPING_ESTIMATE_CHANGED' &&
                                                log.previousValue &&
                                                log.newValue
                                              ? `${money(String(log.previousValue.shippingEstimateAmountMinor ?? '0'))} → ${money(String(log.newValue.shippingEstimateAmountMinor))}`
                                              : log.type === 'DESCRIPTION_UPDATED' && log.newValue
                                                ? `“${String(log.newValue.adminDescription) || t('orders.detail.history.emptyValue')}”`
                                                : undefined,
                                }))}
                            />
                        )}
                    </SectionCard>

                    <SectionCard
                        description={t('messages.description')}
                        icon={<MessageSquare aria-hidden="true" />}
                        title={t('messages.title')}
                    >
                        <MessageThread endpoint={`/orders/${params.id}/messages`} />
                    </SectionCard>
                </div>

                <div className="grid min-w-0 gap-5">
                    <SectionCard dense title={t('orders.detail.summarySection')}>
                        <SummaryList
                            rows={[
                                {
                                    label: t('orders.detail.fields.shippingEstimate'),
                                    value: order.shippingEstimateAmountMinor
                                        ? money(order.shippingEstimateAmountMinor, order.currency)
                                        : t('common.dash'),
                                },
                                {
                                    label: t('orders.detail.fields.total'),
                                    value: money(order.totalAmountMinor, order.currency),
                                },
                                // Pedido do carrinho: a taxa vem separada dos
                                // itens, e o admin precisa vê-la para reprecificar
                                // sem apagá-la por engano.
                                ...(order.serviceFeeMinor !== '0'
                                    ? [
                                          {
                                              label: t('orders.detail.fields.serviceFee'),
                                              value: money(order.serviceFeeMinor, order.currency),
                                          },
                                      ]
                                    : []),
                                {
                                    label: t('orders.detail.fields.optionalServices'),
                                    value: money(order.optionalServicesAmountMinor, order.currency),
                                },
                                ...(order.couponCode
                                    ? [
                                          {
                                              label: t('orders.detail.fields.coupon', { code: order.couponCode }),
                                              value: `−${money(order.discountAmountMinor, order.currency)}`,
                                          },
                                      ]
                                    : []),
                                {
                                    label: t('orders.detail.fields.chargeableTotal'),
                                    value: money(order.chargeableTotalAmountMinor, order.currency),
                                    emphasis: true,
                                },
                                {
                                    label: t('orders.detail.fields.warehouseArrivedAt'),
                                    value: formatDate(order.warehouseArrivedAt),
                                },
                                {
                                    label: t('orders.detail.fields.storageFeeCharged'),
                                    value: money(order.storageFeeChargedMinor, order.currency),
                                },
                                { label: t('orders.detail.fields.createdAt'), value: formatDate(order.createdAt) },
                                { label: t('orders.detail.fields.paidAt'), value: formatDate(order.paidAt) },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>

            <ActionDialog
                confirmLabel={t('orders.detail.dialogs.approve.confirmLabel')}
                description={t('orders.detail.dialogs.approve.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
                open={dialog === 'approve'}
                title={t('orders.detail.dialogs.approve.title')}
            />
            <ActionDialog
                confirmLabel={
                    canCancelPaid
                        ? t('orders.detail.dialogs.cancelRefund.confirmLabel')
                        : t('orders.detail.dialogs.reject.confirmLabel')
                }
                description={
                    canCancelPaid
                        ? t('orders.detail.dialogs.cancelRefund.description', {
                              amount: money(order.chargeableTotalAmountMinor, order.currency),
                          })
                        : t('orders.detail.dialogs.reject.description')
                }
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
                open={dialog === 'reject'}
                requireReason
                title={
                    canCancelPaid
                        ? t('orders.detail.dialogs.cancelRefund.title')
                        : t('orders.detail.dialogs.reject.title')
                }
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('orders.detail.dialogs.requestCustomerApproval.confirmLabel')}
                description={t('orders.detail.dialogs.requestCustomerApproval.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
                open={dialog === 'request-customer-approval'}
                title={t('orders.detail.dialogs.requestCustomerApproval.title')}
            />
            <ActionDialog
                confirmLabel={t('orders.detail.dialogs.failSourcing.confirmLabel')}
                description={t('orders.detail.dialogs.failSourcing.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
                open={dialog === 'fail-sourcing'}
                requireReason
                title={t('orders.detail.dialogs.failSourcing.title')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('orders.detail.dialogs.confirmRefund.confirmLabel')}
                description={t('orders.detail.dialogs.confirmRefund.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
                open={dialog === 'confirm-refund'}
                requireReason
                title={t('orders.detail.dialogs.confirmRefund.title')}
            />
            <ActionDialog
                confirmLabel={t('orders.detail.dialogs.editDescription.confirmLabel')}
                description={t('orders.detail.dialogs.editDescription.description')}
                onCancel={() => setDialog(null)}
                open={dialog === 'edit-description'}
                title={t('orders.detail.dialogs.editDescription.title')}
                fields={[
                    {
                        name: 'adminDescription',
                        kind: 'textarea',
                        label: t('orders.detail.dialogs.editDescription.fieldLabel'),
                        placeholder: t('orders.detail.dialogs.editDescription.fieldPlaceholder'),
                        defaultValue: order.adminDescription ?? '',
                        maxLength: 4000,
                    },
                ]}
                onConfirm={(values) =>
                    handleDescriptionConfirm({ reason: values.reason, adminDescription: values.adminDescription ?? '' })
                }
            />
            <OrderAmountDialog
                confirmLabel={t('orders.detail.dialogs.changePrice.confirmLabel')}
                currentAmountMinor={order.totalAmountMinor}
                description={t('orders.detail.dialogs.changePrice.description')}
                fieldLabel={t('orders.detail.dialogs.changePrice.fieldLabel')}
                fieldName="newTotalAmountMinor"
                onCancel={() => setDialog(null)}
                onConfirm={handlePriceConfirm}
                open={dialog === 'change-price'}
                title={t('orders.detail.dialogs.changePrice.title')}
            />
            <OrderAmountDialog
                confirmLabel={t('orders.detail.dialogs.changeShippingEstimate.confirmLabel')}
                currentAmountMinor={order.shippingEstimateAmountMinor ?? '0'}
                description={t('orders.detail.dialogs.changeShippingEstimate.description')}
                fieldLabel={t('orders.detail.dialogs.changeShippingEstimate.fieldLabel')}
                fieldName="newShippingEstimateAmountMinor"
                onCancel={() => setDialog(null)}
                onConfirm={handleShippingEstimateConfirm}
                open={dialog === 'change-shipping-estimate'}
                title={t('orders.detail.dialogs.changeShippingEstimate.title')}
            />
        </div>
    );
}
