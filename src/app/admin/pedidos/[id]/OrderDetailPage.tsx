'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, PackageCheck, Pencil, Send, Truck, Wallet, XCircle } from 'lucide-react';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';
import { PaymentAttachmentsManager } from '@/components/admin/PaymentAttachmentsManager';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/translations';
import { api, ApiError } from '@/services/api';
import { formatDate, money, orderChangeLogTypeLabel, orderStatusLabel, type AdminOrder } from '@/types/api';
import { OrderMediaManager } from './OrderMediaManager';
import { OrderAmountDialog, type OrderAmountDialogValues } from './OrderAmountDialog';

type ApprovalDialogKind =
    | 'approve'
    | 'reject'
    | 'confirm-payment-manually'
    | 'request-customer-approval'
    | 'send-for-payment';
type AmountDialogKind = 'change-price' | 'change-shipping-estimate';
type DialogKind = ApprovalDialogKind | AmountDialogKind | 'edit-description' | null;

const APPROVAL_FEEDBACK_KEY: Record<ApprovalDialogKind, MessageKey> = {
    approve: 'orders.detail.feedback.approve',
    reject: 'orders.detail.feedback.reject',
    'confirm-payment-manually': 'orders.detail.feedback.confirm-payment-manually',
    'request-customer-approval': 'orders.detail.feedback.request-customer-approval',
    'send-for-payment': 'orders.detail.feedback.send-for-payment',
};

export function OrderDetailPage() {
    const { t } = useTranslation();
    const params = useParams<{ id: string }>();
    const [order, setOrder] = useState<AdminOrder>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [busy, setBusy] = useState<string>();

    function load() {
        api<AdminOrder>(`/orders/${params.id}`)
            .then(setOrder)
            .catch(() => setError(t('orders.detail.error')));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    async function handleApprovalConfirm(values: { totpCode: string; reason: string }) {
        const action = dialog as ApprovalDialogKind;
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setOrder(updated);
            setDialog(null);
            setFeedback(t(APPROVAL_FEEDBACK_KEY[action]));
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    async function handleDescriptionConfirm(values: { reason: string; adminDescription: string }) {
        const updated = await api<AdminOrder>(`/orders/${params.id}/description`, {
            method: 'PATCH',
            body: JSON.stringify({ reason: values.reason, adminDescription: values.adminDescription }),
        });
        setOrder(updated);
        setDialog(null);
        setFeedback(t('orders.detail.feedback.descriptionUpdated'));
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
        setOrder(updated);
        setDialog(null);
        setFeedback(t('orders.detail.feedback.priceChanged'));
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
        setOrder(updated);
        setDialog(null);
        setFeedback(t('orders.detail.feedback.shippingEstimateChanged'));
    }

    async function markReadyToShip() {
        setBusy('mark-ready-to-ship');
        setError(undefined);
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/mark-ready-to-ship`, { method: 'POST' });
            setOrder(updated);
            setFeedback(t('orders.detail.feedback.markedReadyToShip'));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setBusy(undefined);
        }
    }

    const canDraft = order?.status === 'AWAITING_REVIEW';
    const canManagePaymentData = order?.status === 'GENERATING_PAYMENT_DATA';
    const canEditDescriptionAndMedia = canDraft || canManagePaymentData;

    return (
        <main>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted dark:text-night-muted" href="/admin/pedidos">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('orders.detail.backLink')}
            </Link>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {!order && !error && <p className="mt-6 text-muted">{t('orders.detail.loading')}</p>}

            {order && (
                <>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="mm-kicker mb-3">
                                {order.origin === 'EXTERNAL_LINK' ? t('orders.detail.kickerExternalLink') : t('orders.detail.kickerCatalog')}
                            </p>
                            <h1 className="m-0 text-3xl tracking-[-.03em]">#{order.id.slice(0, 8)}</h1>
                            <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                <Link className="font-semibold text-primary hover:underline" href={`/admin/usuarios/${order.userId}`}>
                                    {order.userName}
                                </Link>{' '}
                                · {order.userEmail}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {canEditDescriptionAndMedia && (
                                <Button variant="ghost" onClick={() => setDialog('edit-description')} leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
                                    {t('orders.detail.actions.editDescription')}
                                </Button>
                            )}
                            {canDraft && (
                                <>
                                    <Button variant="ghost" onClick={() => setDialog('change-price')} leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.changePrice')}
                                    </Button>
                                    <Button variant="ghost" onClick={() => setDialog('change-shipping-estimate')} leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.changeShippingEstimate')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => setDialog('request-customer-approval')} leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.requestCustomerApproval')}
                                    </Button>
                                    <Button variant="primary" onClick={() => setDialog('approve')} leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.approve')}
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.reject')}
                                    </Button>
                                </>
                            )}
                            {canManagePaymentData && (
                                <>
                                    <Button variant="primary" onClick={() => setDialog('send-for-payment')} leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.sendForPayment')}
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.cancelOrder')}
                                    </Button>
                                </>
                            )}
                            {(order.status === 'UNPAID' || order.status === 'PENDING') && (
                                <>
                                    <Button variant="secondary" onClick={() => setDialog('confirm-payment-manually')} leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.confirmPaymentManually')}
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        {t('orders.detail.actions.cancelOrderRestock')}
                                    </Button>
                                </>
                            )}
                            {order.status === 'PURCHASED' && (
                                <Button variant="secondary" onClick={markReadyToShip} loading={busy === 'mark-ready-to-ship'} leadingIcon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}>
                                    {t('orders.detail.actions.markReadyToShip')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}

                    <section className="mm-panel mt-8 grid grid-cols-3 gap-6 p-6 max-[700px]:grid-cols-1">
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.client')}</p>
                            <p className="mt-1 font-semibold">
                                <Link className="text-primary hover:underline" href={`/admin/usuarios/${order.userId}`}>
                                    {order.userName}
                                </Link>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.status')}</p>
                            <p className="mt-1">
                                <span className="mm-kicker">{orderStatusLabel(order.status)}</span>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.total')}</p>
                            <p className="mm-data mt-1 font-semibold">{money(order.totalAmountMinor, order.currency)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.shippingEstimate')}</p>
                            <p className="mm-data mt-1 font-semibold">
                                {order.shippingEstimateAmountMinor ? money(order.shippingEstimateAmountMinor, order.currency) : t('common.dash')}
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.paymentProvider')}</p>
                            <p className="mt-1 font-semibold">{order.providerName ?? t('common.dash')}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.createdAt')}</p>
                            <p className="mt-1 font-semibold">{formatDate(order.createdAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.paidAt')}</p>
                            <p className="mt-1 font-semibold">{formatDate(order.paidAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.paymentExpiresAt')}</p>
                            <p className="mt-1 font-semibold">{formatDate(order.paymentExpiresAt)}</p>
                        </div>
                        {order.addressSnapshot && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.deliveryAddress')}</p>
                                <p className="mt-1">
                                    {order.addressSnapshot.recipientFullName} · {order.addressSnapshot.phoneE164}
                                    <br />
                                    {order.addressSnapshot.addressLine1}
                                    {order.addressSnapshot.addressLine2 ? `, ${order.addressSnapshot.addressLine2}` : ''}
                                    {order.addressSnapshot.district ? ` — ${order.addressSnapshot.district}` : ''}
                                    <br />
                                    {order.addressSnapshot.locality}/{order.addressSnapshot.administrativeArea} · {order.addressSnapshot.postalCode} ·{' '}
                                    {order.addressSnapshot.countryCode}
                                </p>
                            </div>
                        )}
                        {order.adminDescription && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.adminDescription')}</p>
                                <p className="mt-1 whitespace-pre-wrap">{order.adminDescription}</p>
                            </div>
                        )}
                        {order.rejectionReason && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.detail.fields.rejectionReason')}</p>
                                <p className="mt-1">{order.rejectionReason}</p>
                            </div>
                        )}
                    </section>

                    <section className="mt-10">
                        <h2 className="m-0 text-xl">{t('orders.detail.itemsSection.title')}</h2>
                        <div className="mt-4 grid gap-3">
                            {order.items.map((item) => (
                                <div className="mm-panel-soft flex flex-wrap items-center justify-between gap-4 p-4" key={item.id}>
                                    <div>
                                        <strong>{item.productName}</strong>
                                        <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                            {item.storeProductId ? t('orders.detail.itemsSection.ownCatalog') : item.marketplace} ·{' '}
                                            {t('orders.detail.itemsSection.quantity', { count: item.quantity })}
                                            {item.size ? t('orders.detail.itemsSection.size', { size: item.size }) : ''}
                                            {item.category ? ` · ${item.category.name}` : ''}
                                        </p>
                                        {item.referencePriceCnyMinor && (
                                            <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                                {t('orders.detail.itemsSection.declaredPrice', { amount: money(item.referencePriceCnyMinor, 'CNY') })}
                                            </p>
                                        )}
                                        {item.marketplaceUrl && (
                                            <a className="mt-1 block truncate text-xs text-primary" href={item.marketplaceUrl} target="_blank" rel="noreferrer">
                                                {item.marketplaceUrl}
                                            </a>
                                        )}
                                    </div>
                                    <div className="mm-data text-right font-semibold">{money(item.unitAmountMinor, item.currency)}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mt-10">
                        {canEditDescriptionAndMedia ? (
                            <OrderMediaManager orderId={order.id} media={order.media} onChanged={load} />
                        ) : (
                            <>
                                <h2 className="m-0 text-lg">{t('orders.detail.mediaSection.title')}</h2>
                                <div className="mt-4 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
                                    {order.media.map((item) => (
                                        <div className="mm-panel-soft overflow-hidden" key={item.id}>
                                            {item.type === 'IMAGE' && item.url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img className="aspect-square w-full object-cover" src={item.url} alt={item.altText ?? ''} />
                                            ) : item.type === 'VIDEO' && item.url ? (
                                                <video className="aspect-square w-full object-cover" src={item.url} controls />
                                            ) : (
                                                <div className="grid aspect-square w-full place-items-center bg-warm-200 text-xs text-muted dark:bg-night-raised dark:text-night-muted">
                                                    {item.type}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {order.media.length === 0 && <p className="text-sm text-muted dark:text-night-muted">{t('orders.detail.mediaSection.empty')}</p>}
                                </div>
                            </>
                        )}
                    </section>

                    <section className="mt-10">
                        <PaymentAttachmentsManager
                            resource="orders"
                            resourceId={order.id}
                            attachments={order.paymentAttachments}
                            onChanged={load}
                            canManage={!['COMPLETED', 'REFUND', 'INVALID', 'CANCELLED'].includes(order.status)}
                        />
                    </section>

                    <details className="group mt-10">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xl marker:hidden">
                            {t('orders.detail.history.title')}
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-100 text-xl leading-none font-medium text-primary transition group-open:rotate-45 dark:bg-night-brand dark:text-night-accent">
                                +
                            </span>
                        </summary>
                        <ol className="m-0 mt-4 grid list-none gap-0 p-0">
                            {order.changeLogs.map((log) => (
                                <li className="border-t border-line py-4 dark:border-night-line" key={log.id}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                                        <strong>{orderChangeLogTypeLabel(log.type)}</strong>
                                        <span className="text-xs text-muted dark:text-night-muted">
                                            {formatDate(log.createdAt)} · {log.createdByAdminId ?? t('orders.detail.history.customerFallback')}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm">{log.reason}</p>
                                    {log.type === 'PRICE_CHANGED' && log.previousValue && log.newValue && (
                                        <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                            {money(String(log.previousValue.totalAmountMinor))} → {money(String(log.newValue.totalAmountMinor))}
                                        </p>
                                    )}
                                    {log.type === 'SHIPPING_ESTIMATE_CHANGED' && log.previousValue && log.newValue && (
                                        <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                            {money(String(log.previousValue.shippingEstimateAmountMinor ?? '0'))} →{' '}
                                            {money(String(log.newValue.shippingEstimateAmountMinor))}
                                        </p>
                                    )}
                                    {log.type === 'DESCRIPTION_UPDATED' && log.newValue && (
                                        <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                            &ldquo;{String(log.newValue.adminDescription) || t('orders.detail.history.emptyValue')}&rdquo;
                                        </p>
                                    )}
                                </li>
                            ))}
                            {order.changeLogs.length === 0 && <p className="text-sm text-muted dark:text-night-muted">{t('orders.detail.history.empty')}</p>}
                        </ol>
                    </details>
                </>
            )}

            <ApprovalDialog
                open={dialog === 'approve'}
                title={t('orders.detail.dialogs.approve.title')}
                description={t('orders.detail.dialogs.approve.description')}
                confirmLabel={t('orders.detail.dialogs.approve.confirmLabel')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'reject'}
                title={t('orders.detail.dialogs.reject.title')}
                description={t('orders.detail.dialogs.reject.description')}
                confirmLabel={t('orders.detail.dialogs.reject.confirmLabel')}
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'request-customer-approval'}
                title={t('orders.detail.dialogs.requestCustomerApproval.title')}
                description={t('orders.detail.dialogs.requestCustomerApproval.description')}
                confirmLabel={t('orders.detail.dialogs.requestCustomerApproval.confirmLabel')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'send-for-payment'}
                title={t('orders.detail.dialogs.sendForPayment.title')}
                description={t('orders.detail.dialogs.sendForPayment.description')}
                confirmLabel={t('orders.detail.dialogs.sendForPayment.confirmLabel')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'confirm-payment-manually'}
                title={t('orders.detail.dialogs.confirmPaymentManually.title')}
                description={t('orders.detail.dialogs.confirmPaymentManually.description')}
                confirmLabel={t('orders.detail.dialogs.confirmPaymentManually.confirmLabel')}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'edit-description'}
                title={t('orders.detail.dialogs.editDescription.title')}
                description={t('orders.detail.dialogs.editDescription.description')}
                confirmLabel={t('orders.detail.dialogs.editDescription.confirmLabel')}
                requireTotp={false}
                fields={[
                    {
                        name: 'adminDescription',
                        label: t('orders.detail.dialogs.editDescription.fieldLabel'),
                        placeholder: t('orders.detail.dialogs.editDescription.fieldPlaceholder'),
                        multiline: true,
                        maxLength: 4000,
                    },
                ]}
                onCancel={() => setDialog(null)}
                onConfirm={(values) => handleDescriptionConfirm({ reason: values.reason, adminDescription: values.adminDescription ?? '' })}
            />
            {order && (
                <>
                    <OrderAmountDialog
                        open={dialog === 'change-price'}
                        title={t('orders.detail.dialogs.changePrice.title')}
                        description={t('orders.detail.dialogs.changePrice.description')}
                        fieldLabel={t('orders.detail.dialogs.changePrice.fieldLabel')}
                        fieldName="newTotalAmountMinor"
                        currentAmountMinor={order.totalAmountMinor}
                        confirmLabel={t('orders.detail.dialogs.changePrice.confirmLabel')}
                        onCancel={() => setDialog(null)}
                        onConfirm={handlePriceConfirm}
                    />
                    <OrderAmountDialog
                        open={dialog === 'change-shipping-estimate'}
                        title={t('orders.detail.dialogs.changeShippingEstimate.title')}
                        description={t('orders.detail.dialogs.changeShippingEstimate.description')}
                        fieldLabel={t('orders.detail.dialogs.changeShippingEstimate.fieldLabel')}
                        fieldName="newShippingEstimateAmountMinor"
                        currentAmountMinor={order.shippingEstimateAmountMinor ?? '0'}
                        confirmLabel={t('orders.detail.dialogs.changeShippingEstimate.confirmLabel')}
                        onCancel={() => setDialog(null)}
                        onConfirm={handleShippingEstimateConfirm}
                    />
                </>
            )}
        </main>
    );
}
