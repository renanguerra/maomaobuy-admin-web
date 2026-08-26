'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Plus, Ruler, Send, Trash2, Upload, Wallet, XCircle } from 'lucide-react';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';
import { PaymentAttachmentsManager } from '@/components/admin/PaymentAttachmentsManager';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/services/api';
import { formatDate, money, packageStatusLabel, type AdminPackage, type PresignedUpload } from '@/types/api';

type DialogKind = 'approve' | 'reject' | 'confirm-freight-payment-manually' | 'dispatch' | 'shipment' | null;

export function PackageDetailPage() {
    const params = useParams<{ id: string }>();
    const [pkg, setPkg] = useState<AdminPackage>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [busy, setBusy] = useState<string>();
    const [uploading, setUploading] = useState(false);
    const [addingItem, setAddingItem] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function load() {
        api<AdminPackage>(`/packages/${params.id}`)
            .then(setPkg)
            .catch(() => setError('Não foi possível carregar o pacote.'));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    function errorMessage(err: unknown) {
        return err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.';
    }

    async function handleApprovalConfirm(values: { totpCode: string; reason: string } & Record<string, string>) {
        const action = dialog;
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setPkg(updated);
            setDialog(null);
            setFeedback(
                action === 'approve'
                    ? 'Pacote aprovado.'
                    : action === 'reject'
                      ? 'Pacote rejeitado.'
                      : action === 'confirm-freight-payment-manually'
                        ? 'Pagamento do frete confirmado manualmente.'
                        : action === 'shipment'
                          ? 'Dados de frete atualizados.'
                          : 'Pacote despachado.',
            );
        } catch (err) {
            throw err instanceof ApiError ? err : new Error('Não foi possível concluir a ação.');
        }
    }

    async function submitPackage() {
        setBusy('submit');
        setError(undefined);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/submit`, { method: 'POST' });
            setPkg(updated);
            setFeedback('Pacote enviado para aprovação.');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function addItems(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const raw = String(data.get('orderItemIds') ?? '');
        const orderItemIds = raw
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean);
        if (orderItemIds.length === 0) return;
        setBusy('add-items');
        setError(undefined);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/items`, {
                method: 'POST',
                body: JSON.stringify({ orderItemIds }),
            });
            setPkg(updated);
            form.reset();
            setAddingItem(false);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function removeItem(packageItemId: string) {
        if (!confirm('Remover este item do pacote?')) return;
        setBusy(`remove-item:${packageItemId}`);
        setError(undefined);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/items/${packageItemId}`, { method: 'DELETE' });
            setPkg(updated);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function uploadPhoto(file: File) {
        setUploading(true);
        setError(undefined);
        try {
            const presigned = await api<PresignedUpload>(`/packages/${params.id}/photos/upload-url`, {
                method: 'POST',
                body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
            });
            const uploadResponse = await fetch(presigned.uploadUrl, {
                method: 'PUT',
                headers: presigned.headers,
                body: file,
            });
            if (!uploadResponse.ok) throw new Error('Falha ao enviar a foto para o armazenamento.');
            const updated = await api<AdminPackage>(`/packages/${params.id}/photos`, {
                method: 'POST',
                body: JSON.stringify({ keys: [presigned.key] }),
            });
            setPkg(updated);
            setFeedback('Foto enviada com sucesso.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    return (
        <main>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted dark:text-night-muted" href="/admin/pacotes">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para pacotes
            </Link>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {!pkg && !error && <p className="mt-6 text-muted">Carregando pacote…</p>}

            {pkg && (
                <>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="mm-kicker mb-3">Pacote</p>
                            <h1 className="m-0 text-3xl tracking-[-.03em]">{pkg.packageCode}</h1>
                            <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                <Link className="font-semibold text-primary hover:underline" href={`/admin/usuarios/${pkg.userId}`}>
                                    {pkg.userName}
                                </Link>{' '}
                                · {pkg.userEmail}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {(pkg.status === 'DRAFT' || pkg.status === 'AWAITING_APPROVAL') && (
                                <Button variant="secondary" onClick={() => setDialog('shipment')} leadingIcon={<Ruler className="h-4 w-4" aria-hidden="true" />}>
                                    Definir frete
                                </Button>
                            )}
                            {pkg.status === 'DRAFT' && (
                                <Button
                                    variant="primary"
                                    onClick={submitPackage}
                                    loading={busy === 'submit'}
                                    leadingIcon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                                >
                                    Enviar para aprovação
                                </Button>
                            )}
                            {pkg.status === 'AWAITING_APPROVAL' && (
                                <>
                                    <Button variant="primary" onClick={() => setDialog('approve')} leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
                                        Aprovar
                                    </Button>
                                    <Button variant="danger" onClick={() => setDialog('reject')} leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}>
                                        Rejeitar
                                    </Button>
                                </>
                            )}
                            {pkg.status === 'PREPARING' && (
                                <Button variant="secondary" onClick={() => setDialog('confirm-freight-payment-manually')} leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}>
                                    Confirmar pagamento do frete
                                </Button>
                            )}
                            {pkg.status === 'READY_FOR_DISPATCH' && (
                                <Button variant="primary" onClick={() => setDialog('dispatch')} leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}>
                                    Despachar
                                </Button>
                            )}
                        </div>
                    </div>

                    {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}

                    <section className="mm-panel mt-8 grid grid-cols-3 gap-6 p-6 max-[700px]:grid-cols-1">
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Cliente</p>
                            <p className="mt-1 font-semibold">
                                <Link className="text-primary hover:underline" href={`/admin/usuarios/${pkg.userId}`}>
                                    {pkg.userName}
                                </Link>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Status</p>
                            <p className="mt-1">
                                <span className="mm-kicker">{packageStatusLabel(pkg.status)}</span>
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Frete</p>
                            <p className="mm-data mt-1 font-semibold">
                                {pkg.shippingAmountMinor && pkg.shippingCurrency ? money(pkg.shippingAmountMinor, pkg.shippingCurrency) : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Transportadora</p>
                            <p className="mt-1 font-semibold">{pkg.carrier ?? '—'}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Código de rastreio</p>
                            <p className="mt-1 font-semibold">{pkg.trackingCode ?? '—'}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Peso</p>
                            <p className="mt-1 font-semibold">{pkg.weightGrams ? `${pkg.weightGrams} g` : '—'}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Dimensões (C×L×A)</p>
                            <p className="mt-1 font-semibold">
                                {pkg.lengthMillimeters && pkg.widthMillimeters && pkg.heightMillimeters
                                    ? `${pkg.lengthMillimeters} × ${pkg.widthMillimeters} × ${pkg.heightMillimeters} mm`
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Criado em</p>
                            <p className="mt-1 font-semibold">{formatDate(pkg.createdAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Enviado em</p>
                            <p className="mt-1 font-semibold">{formatDate(pkg.shippedAt)}</p>
                        </div>
                        <div>
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Entregue em</p>
                            <p className="mt-1 font-semibold">{formatDate(pkg.deliveredAt)}</p>
                        </div>
                        <div className="col-span-3">
                            <p className="m-0 text-sm text-muted dark:text-night-muted">Destino</p>
                            <p className="mt-1">
                                {pkg.destination.recipientFullName} · {pkg.destination.addressLine1}
                                {pkg.destination.addressLine2 ? `, ${pkg.destination.addressLine2}` : ''} ·{' '}
                                {pkg.destination.locality}/{pkg.destination.administrativeArea} · {pkg.destination.postalCode} ·{' '}
                                {pkg.destination.countryCode}
                            </p>
                        </div>
                        {pkg.rejectionReason && (
                            <div className="col-span-3">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Motivo da rejeição</p>
                                <p className="mt-1">{pkg.rejectionReason}</p>
                            </div>
                        )}
                    </section>

                    <section className="mt-10">
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 text-xl">Itens</h2>
                            {!addingItem && (
                                <Button size="small" variant="ghost" onClick={() => setAddingItem(true)} leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                                    Adicionar itens
                                </Button>
                            )}
                        </div>

                        {addingItem && (
                            <form className="mm-panel-soft mt-4 grid grid-cols-[1fr_auto_auto] items-end gap-3 p-4 max-[560px]:grid-cols-1" onSubmit={addItems}>
                                <label className="grid gap-1 text-xs font-semibold">
                                    IDs dos itens de pedido (separados por vírgula)
                                    <input
                                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                        name="orderItemIds"
                                        placeholder="uuid-1, uuid-2"
                                        required
                                    />
                                </label>
                                <Button size="small" type="submit" loading={busy === 'add-items'}>
                                    Adicionar
                                </Button>
                                <Button size="small" type="button" variant="ghost" onClick={() => setAddingItem(false)}>
                                    Cancelar
                                </Button>
                            </form>
                        )}

                        <div className="mt-4 grid gap-3">
                            {pkg.items.map((item) => (
                                <div className="mm-panel-soft flex flex-wrap items-center justify-between gap-4 p-4" key={item.id}>
                                    <div>
                                        <strong>{item.orderItem.productName}</strong>
                                        <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                            quantidade {item.quantity} · {money(item.orderItem.unitAmountMinor, item.orderItem.currency)}
                                        </p>
                                    </div>
                                    <Button
                                        size="small"
                                        variant="ghost"
                                        className="text-origin-700"
                                        onClick={() => removeItem(item.id)}
                                        loading={busy === `remove-item:${item.id}`}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            ))}
                            {pkg.items.length === 0 && <p className="text-sm text-muted dark:text-night-muted">Nenhum item neste pacote.</p>}
                        </div>
                    </section>

                    <section className="mt-10">
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 text-xl">Fotos</h2>
                            <label>
                                <input
                                    ref={fileInputRef}
                                    className="hidden"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void uploadPhoto(file);
                                    }}
                                />
                                <Button
                                    size="small"
                                    variant="ghost"
                                    type="button"
                                    loading={uploading}
                                    leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? 'Enviando…' : 'Enviar foto'}
                                </Button>
                            </label>
                        </div>

                        <div className="mt-4 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
                            {pkg.photoUrls.map((url) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className="mm-panel-soft aspect-square w-full object-cover" src={url} alt="Foto do pacote" key={url} />
                            ))}
                            {pkg.photoUrls.length === 0 && <p className="text-sm text-muted dark:text-night-muted">Nenhuma foto enviada.</p>}
                        </div>
                    </section>

                    <section className="mt-10">
                        <PaymentAttachmentsManager
                            resource="packages"
                            resourceId={pkg.id}
                            attachments={pkg.paymentAttachments}
                            onChanged={load}
                            canManage={!['DELIVERED', 'RETURNED', 'CANCELLED'].includes(pkg.status)}
                        />
                    </section>
                </>
            )}

            <ApprovalDialog
                open={dialog === 'approve'}
                title="Aprovar pacote"
                description="Confirma a consolidação e libera o pacote para cobrança de frete."
                confirmLabel="Aprovar"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'reject'}
                title="Rejeitar pacote"
                description="Explique o motivo da rejeição — o cliente poderá visualizá-lo."
                confirmLabel="Rejeitar"
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'shipment'}
                title="Definir frete do pacote"
                description="Peso, dimensões e valor do frete a ser cobrado do cliente."
                confirmLabel="Salvar"
                fields={[
                    { name: 'weightGrams', label: 'Peso (g)', pattern: '[1-9]\\d{0,5}', inputMode: 'numeric', placeholder: '1500' },
                    { name: 'lengthMillimeters', label: 'Comprimento (mm)', pattern: '[1-9]\\d{0,5}', inputMode: 'numeric', placeholder: '300' },
                    { name: 'widthMillimeters', label: 'Largura (mm)', pattern: '[1-9]\\d{0,5}', inputMode: 'numeric', placeholder: '200' },
                    { name: 'heightMillimeters', label: 'Altura (mm)', pattern: '[1-9]\\d{0,5}', inputMode: 'numeric', placeholder: '150' },
                    { name: 'shippingCurrency', label: 'Moeda (BRL ou CNY)', pattern: '(BRL|CNY)', placeholder: 'BRL' },
                    { name: 'shippingAmountMinor', label: 'Valor do frete (centavos)', pattern: '0|[1-9]\\d{0,17}', inputMode: 'numeric', placeholder: '4990' },
                ]}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'confirm-freight-payment-manually'}
                title="Confirmar pagamento do frete manualmente"
                description="Use apenas quando o pagamento foi verificado fora do fluxo automático."
                confirmLabel="Confirmar pagamento"
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
            <ApprovalDialog
                open={dialog === 'dispatch'}
                title="Despachar pacote"
                description="Informe a transportadora e o código de rastreio para notificar o cliente."
                confirmLabel="Despachar"
                fields={[
                    { name: 'carrier', label: 'Transportadora', placeholder: 'Ex.: Correios', minLength: 2, maxLength: 120 },
                    { name: 'trackingCode', label: 'Código de rastreio', placeholder: 'Ex.: BR123456789BR', minLength: 2, maxLength: 100 },
                ]}
                onCancel={() => setDialog(null)}
                onConfirm={handleApprovalConfirm}
            />
        </main>
    );
}
