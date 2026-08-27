'use client';

import { useRef, useState } from 'react';
import { Receipt, Trash2, Upload } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminPaymentAttachment, PresignedUpload } from '@/types/api';

interface PaymentAttachmentsManagerProps {
    resource: 'orders' | 'packages';
    resourceId: string;
    attachments: AdminPaymentAttachment[];
    onChanged: () => void;
    /** Esconde os controles de enviar/remover quando o pedido/pacote já está concluído ou cancelado. */
    canManage?: boolean;
}

type PendingAction = { kind: 'upload'; files: File[] } | { kind: 'remove'; attachmentId: string } | null;

/**
 * Documentos de pagamento (boleto, QR do Pix) anexados pelo admin, e
 * comprovantes enviados pelo cliente — separados em dois blocos para que
 * ninguém confunda o que a MaoMaoBuy emitiu com o que o cliente mandou.
 * Reaproveita o upload pré-assinado das mídias, mas aceita PDF além de
 * imagem, e toda alteração exige motivo.
 */
export function PaymentAttachmentsManager({
    resource,
    resourceId,
    attachments,
    onChanged,
    canManage = true,
}: PaymentAttachmentsManagerProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [pending, setPending] = useState<PendingAction>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const basePath = `/${resource}/${resourceId}/payment-attachments`;
    const adminAttachments = attachments.filter((item) => item.uploadedBy === 'ADMIN');
    const customerAttachments = attachments.filter((item) => item.uploadedBy === 'USER');

    function resetFileInput() {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function uploadOne(file: File, reason: string) {
        const presigned = await api<PresignedUpload>(`${basePath}/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            headers: presigned.headers,
            body: file,
        });
        if (!uploadResponse.ok) throw new Error(t('paymentAttachments.uploadFailed', { name: file.name }));

        await api(basePath, {
            method: 'POST',
            body: JSON.stringify({ key: presigned.key, mimeType: file.type, sizeBytes: file.size, reason }),
        });
    }

    async function handleConfirm({ reason }: { reason: string }) {
        if (!pending) return;

        if (pending.kind === 'upload') {
            setUploading(true);
            try {
                for (const file of pending.files) await uploadOne(file, reason.trim());
                notify({
                    tone: 'success',
                    title: t('paymentAttachments.uploadedToast', { count: pending.files.length }),
                });
            } finally {
                setUploading(false);
                resetFileInput();
            }
        } else {
            await api(`${basePath}/${pending.attachmentId}`, {
                method: 'DELETE',
                body: JSON.stringify({ reason: reason.trim() }),
            });
            notify({ tone: 'success', title: t('paymentAttachments.removedToast') });
        }

        setPending(null);
        onChanged();
    }

    function renderTile(item: AdminPaymentAttachment) {
        return (
            <MediaTile
                key={item.id}
                kind={item.mimeType.startsWith('image/') ? 'IMAGE' : t('paymentAttachments.pdfLabel')}
                openLabel={t('common.actions.open')}
                url={item.url}
                footer={
                    canManage ? (
                        <Button
                            fullWidth
                            leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setPending({ kind: 'remove', attachmentId: item.id })}
                            size="small"
                            variant="dangerGhost"
                        >
                            {t('paymentAttachments.remove')}
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    return (
        <>
            <SectionCard
                description={t('paymentAttachments.description')}
                icon={<Receipt aria-hidden="true" />}
                title={t('paymentAttachments.title')}
                action={
                    canManage ? (
                        <>
                            <input
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="sr-only"
                                multiple
                                onChange={(event) => {
                                    const files = Array.from(event.target.files ?? []);
                                    if (files.length > 0) setPending({ kind: 'upload', files });
                                }}
                                ref={fileInputRef}
                                type="file"
                            />
                            <Button
                                leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                                loading={uploading}
                                onClick={() => fileInputRef.current?.click()}
                                size="small"
                                type="button"
                                variant="secondary"
                            >
                                {t('paymentAttachments.uploadButton')}
                            </Button>
                        </>
                    ) : undefined
                }
            >
                <div className="grid gap-6">
                    <section>
                        <h3 className="m-0 mb-2.5 text-xs font-bold tracking-[.06em] text-muted uppercase dark:text-night-subtle">
                            {t('paymentAttachments.adminDocsTitle')}
                        </h3>
                        {adminAttachments.length === 0 ? (
                            <EmptyState icon={Receipt} title={t('paymentAttachments.emptyAdmin')} variant="bordered" />
                        ) : (
                            <MediaGrid>{adminAttachments.map(renderTile)}</MediaGrid>
                        )}
                    </section>

                    <section>
                        <h3 className="m-0 mb-2.5 text-xs font-bold tracking-[.06em] text-muted uppercase dark:text-night-subtle">
                            {t('paymentAttachments.customerDocsTitle')}
                        </h3>
                        {customerAttachments.length === 0 ? (
                            <EmptyState
                                icon={Receipt}
                                title={t('paymentAttachments.emptyCustomer')}
                                variant="bordered"
                            />
                        ) : (
                            <MediaGrid>{customerAttachments.map(renderTile)}</MediaGrid>
                        )}
                    </section>
                </div>
            </SectionCard>

            <ActionDialog
                onCancel={() => {
                    setPending(null);
                    resetFileInput();
                }}
                onConfirm={handleConfirm}
                open={pending !== null}
                requireReason
                variant={pending?.kind === 'remove' ? 'danger' : 'primary'}
                confirmLabel={
                    pending?.kind === 'remove'
                        ? t('paymentAttachments.remove')
                        : t('paymentAttachments.uploadConfirmLabel')
                }
                description={
                    pending?.kind === 'remove'
                        ? t('paymentAttachments.removeReasonDescription')
                        : t('paymentAttachments.uploadReasonDescription')
                }
                title={
                    pending?.kind === 'remove'
                        ? t('paymentAttachments.removeReasonTitle')
                        : t('paymentAttachments.uploadReasonTitle')
                }
            />
        </>
    );
}
