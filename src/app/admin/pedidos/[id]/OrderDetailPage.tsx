'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, PackageCheck, Pencil, Send, Truck, Wallet, XCircle } from 'lucide-react';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';
import { Button } from '@/components/ui/Button';
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

const APPROVAL_FEEDBACK: Record<ApprovalDialogKind, string> = {
    approve: 'Pedido aprovado — pedido movido para preparo dos dados de pagamento.',
    reject: 'Pedido rejeitado.',
    'confirm-payment-manually': 'Pagamento confirmado manualmente.',
    'request-customer-approval': 'Pedido devolvido para o cliente aprovar as alterações.',
    'send-for-payment': 'Pedido enviado para pagamento.',
};

export function OrderDetailPage() {
    const params = useParams<{ id: string }>();
    const [order, setOrder] = useState<AdminOrder>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [busy, setBusy] = useState<string>();

    function load() {
        api<AdminOrder>(`/orders/${params.id}`)
            .then(setOrder)
            .catch(() => setError('Não foi possível carregar o pedido.'));
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
            setFeedback(APPROVAL_FEEDBACK[action]);
        } catch (err) {
            throw err instanceof ApiError ? err : new Error('Não foi possível concluir a ação.');
        }
    }

    async function handleDescriptionConfirm(values: { reason: string; adminDescription: string }) {
        const updated = await api<AdminOrder>(`/orders/${params.id}/description`, {
            method: 'PATCH',
            body: JSON.stringify({ reason: values.reason, adminDescription: values.adminDescription }),
        });
        setOrder(updated);
        setDialog(null);
        setFeedback('Descrição atualizada.');
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
        setFeedback('Valor do pedido alterado.');
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
        setFeedback('Frete estimado alterado.');
    }

    async function markReadyToShip() {
        setBusy('mark-ready-to-ship');
        setError(undefined);
        try {
            const updated = await api<AdminOrder>(`/orders/${params.id}/mark-ready-to-ship`, { method: 'POST' });
            setOrder(updated);
            setFeedback('Pedido marcado como pronto para envio.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.');
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
                Voltar para pedidos
            </Link>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {!order && !error && <p className="mt-6 text-muted">Carregando pedido…</p>}

            {order && (
                <>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="mm-kicker mb-3">Pedido {order.origin === 'EXTERNAL_LINK' ? 'por link' : 'de catálogo'}</p>
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
                                    Editar descrição
                                </Button>
                            )}
                            {canDraft && (
                                <>
                                    <Button variant="ghost" onClick={() => setDialog('change-price')} leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}>
                                        Alterar valor
                                    </Button>
                                    <Button variant="ghost" onClick={() => setDialog('change-shipping-estimate')} leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}>
                                        Alterar frete estimado
                                    </Button>
                                    <Button variant="secondary" onClick={() => setDialog('request-customer-approval')} leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
                                        Solicitar aprovação do cliente
                                    </Button>
                                    <Button variant="primary" onClick={() => setDialog('approve')} leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
                                        Aprovar
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        Rejeitar
                                    </Button>
                                </>
                            )}
                            {canManagePaymentData && (
                                <>
                                    <Button variant="primary" onClick={() => setDialog('send-for-payment')} leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
                                        Enviar para pagamento
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        Cancelar pedido
                                    </Button>
                                </>
                            )}
                            {(order.status === 'UNPAID' || order.status === 'PENDING') && (
                                <>
                                    <Button variant="secondary" onClick={() => setDialog('confirm-payment-manually')} leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}>
                                        Confirmar pagamento manualmente
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        Cancelar pedido (devolve estoque)
                                    </Button>
                                </>
                            )}
                            {order.status === 'PURCHASED' && (
                                <Button variant="secondary" onClick={markReadyToShip} loading={busy === 'mark-ready-to-ship'} leadingIcon={<PackageCheck className="h-4 w-4" aria-hidden="true" />}>
                                    Marcar pronto para envio
                                </Button>
                            )}
                        </div>
                    </div>

                    {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}

                    <section className="mm-panel mt-8 grid grid-cols-3 gap-6 p-6 max-[700px]:grid-cols-1">
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Cliente</p>
                            <p className="mt-1 font-semibold">
                                <Link className="text-primary hover:underline" href={`/admin/usuarios/${order.userId}`}>
                                    {order.userName}
                                </Link>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Status</p>
                            <p className="mt-1">
                                <span className="mm-kicker">{orderStatusLabel(order.status)}</span>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Total</p>
                            <p className="mm-data mt-1 font-semibold">{money(order.totalAmountMinor, order.currency)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Frete estimado</p>
                            <p className="mm-data mt-1 font-semibold">
                                {order.shippingEstimateAmountMinor ? money(order.shippingEstimateAmountMinor, order.currency) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Provedor de pagamento</p>
                            <p className="mt-1 font-semibold">{order.providerName ?? '—'}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Criado em</p>
                            <p className="mt-1 font-semibold">{formatDate(order.createdAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Pago em</p>
                            <p className="mt-1 font-semibold">{formatDate(order.paidAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Pagamento expira em</p>
                            <p className="mt-1 font-semibold">{formatDate(order.paymentExpiresAt)}</p>
                        </div>
                        {order.addressSnapshot && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Endereço de entrega</p>
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
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Descrição do admin</p>
                                <p className="mt-1 whitespace-pre-wrap">{order.adminDescription}</p>
                            </div>
                        )}
                        {order.rejectionReason && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Motivo da rejeição</p>
                                <p className="mt-1">{order.rejectionReason}</p>
                            </div>
                        )}
                    </section>

                    <section className="mt-10">
                        <h2 className="m-0 text-xl">Itens</h2>
                        <div className="mt-4 grid gap-3">
                            {order.items.map((item) => (
                                <div className="mm-panel-soft flex flex-wrap items-center justify-between gap-4 p-4" key={item.id}>
                                    <div>
                                        <strong>{item.productName}</strong>
                                        <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                            {item.storeProductId ? 'Catálogo próprio' : item.marketplace} · quantidade {item.quantity}
                                            {item.size ? ` · tamanho ${item.size}` : ''}
                                            {item.category ? ` · ${item.category.name}` : ''}
                                        </p>
                                        {item.referencePriceCnyMinor && (
                                            <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                                Preço declarado pelo cliente: {money(item.referencePriceCnyMinor, 'CNY')}
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
                                <h2 className="m-0 text-lg">Mídia</h2>
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
                                    {order.media.length === 0 && <p className="text-sm text-muted dark:text-night-muted">Nenhuma mídia enviada.</p>}
                                </div>
                            </>
                        )}
                    </section>

                    <details className="group mt-10">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xl marker:hidden">
                            Histórico
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
                                            {formatDate(log.createdAt)} · {log.createdByAdminId ?? 'cliente'}
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
                                            &ldquo;{String(log.newValue.adminDescription) || '(vazio)'}&rdquo;
                                        </p>
                                    )}
                                </li>
                            ))}
                            {order.changeLogs.length === 0 && <p className="text-sm text-muted dark:text-night-muted">Nenhuma alteração registrada ainda.</p>}
                        </ol>
                    </details>
                </>
            )}

            <ApprovalDialog
                open={dialog === 'approve'}
                title="Aprovar pedido"
                description="Sem alterações pendentes: o pedido segue direto para o preparo dos dados de pagamento."
                confirmLabel="Aprovar"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'reject'}
                title="Rejeitar pedido"
                description="Explique o motivo da rejeição — o cliente poderá visualizá-lo."
                confirmLabel="Rejeitar"
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'request-customer-approval'}
                title="Solicitar aprovação do cliente"
                description="Use depois de alterar o valor e/ou o frete estimado. O cliente vai ver o motivo e poderá aprovar ou rejeitar."
                confirmLabel="Enviar para o cliente"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'send-for-payment'}
                title="Enviar para pagamento"
                description="Confirme que os documentos e o QR code do Pix já foram anexados. O pedido ficará visível ao cliente como aguardando pagamento."
                confirmLabel="Enviar"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'confirm-payment-manually'}
                title="Confirmar pagamento manualmente"
                description="Use apenas quando o pagamento foi verificado fora do fluxo automático."
                confirmLabel="Confirmar pagamento"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'edit-description'}
                title="Editar descrição do pedido"
                description="Visível para o cliente na página do pedido dele."
                confirmLabel="Salvar descrição"
                requireTotp={false}
                fields={[
                    {
                        name: 'adminDescription',
                        label: 'Descrição',
                        placeholder: 'Ex.: vendedor confirmou cor azul, sem opção verde.',
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
                        title="Alterar valor do pedido"
                        description="Só é possível enquanto o pedido está aguardando análise. O cliente verá o motivo."
                        fieldLabel="Novo valor total"
                        fieldName="newTotalAmountMinor"
                        currentAmountMinor={order.totalAmountMinor}
                        confirmLabel="Alterar valor"
                        onCancel={() => setDialog(null)}
                        onConfirm={handlePriceConfirm}
                    />
                    <OrderAmountDialog
                        open={dialog === 'change-shipping-estimate'}
                        title="Alterar frete estimado"
                        description="Só informativo — não é cobrado com o pedido. Se mudar, considere solicitar aprovação do cliente em seguida."
                        fieldLabel="Novo frete estimado"
                        fieldName="newShippingEstimateAmountMinor"
                        currentAmountMinor={order.shippingEstimateAmountMinor ?? '0'}
                        confirmLabel="Alterar frete"
                        onCancel={() => setDialog(null)}
                        onConfirm={handleShippingEstimateConfirm}
                    />
                </>
            )}
        </main>
    );
}
