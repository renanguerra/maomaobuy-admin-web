'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { EmptyState } from '@/components/admin/EmptyState';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, uploadToPresignedUrl } from '@/services/api';
import type { AdminOrderMedia, PresignedUpload } from '@/types/api';

function mediaTypeFromMimeType(mimeType: string): 'IMAGE' | 'VIDEO' | undefined {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return undefined;
}

interface OrderMediaManagerProps {
    orderId: string;
    media: AdminOrderMedia[];
    onChanged: () => void;
}

type PendingAction = { kind: 'upload'; files: File[] } | { kind: 'remove'; mediaId: string } | null;

/**
 * Fotos e vídeos anexados ao pedido durante a análise, liberado só enquanto o
 * pedido está em análise ou gerando pagamento. Cada envio e cada remoção
 * exigem um motivo — o texto vira uma entrada no histórico do pedido, então
 * ele é pedido num diálogo do painel, e não num `prompt` do navegador.
 */
export function OrderMediaManager({ orderId, media, onChanged }: OrderMediaManagerProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [pending, setPending] = useState<PendingAction>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function resetFileInput() {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function uploadOne(file: File, sortOrder: number, reason: string) {
        const type = mediaTypeFromMimeType(file.type);
        if (!type) throw new Error(t('orders.media.unsupportedType', { name: file.name }));

        const presigned = await api<PresignedUpload>(`/orders/${orderId}/media/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await uploadToPresignedUrl(presigned, file);
        if (!uploadResponse.ok) throw new Error(t('orders.media.uploadFailed', { name: file.name }));

        await api(`/orders/${orderId}/media`, {
            method: 'POST',
            body: JSON.stringify({
                key: presigned.key,
                type,
                mimeType: file.type,
                sizeBytes: file.size,
                sortOrder,
                reason,
            }),
        });
    }

    async function handleConfirm({ reason }: { reason: string }) {
        if (!pending) return;

        if (pending.kind === 'upload') {
            setUploading(true);
            try {
                let sortOrder = media.length;
                for (const file of pending.files) {
                    await uploadOne(file, sortOrder, reason.trim());
                    sortOrder += 1;
                }
                notify({ tone: 'success', title: t('orders.media.uploadedToast', { count: pending.files.length }) });
            } finally {
                setUploading(false);
                resetFileInput();
            }
        } else {
            await api(`/orders/${orderId}/media/${pending.mediaId}`, {
                method: 'DELETE',
                body: JSON.stringify({ reason: reason.trim() }),
            });
            notify({ tone: 'success', title: t('orders.media.removedToast') });
        }

        setPending(null);
        onChanged();
    }

    return (
        <>
            <SectionCard
                description={t('orders.media.description')}
                icon={<ImagePlus aria-hidden="true" />}
                title={t('orders.media.title')}
                action={
                    <>
                        <input
                            accept="image/*,video/*"
                            className="sr-only"
                            id="order-media-input"
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
                            {t('orders.media.uploadButton')}
                        </Button>
                    </>
                }
            >
                {media.length === 0 ? (
                    <EmptyState
                        description={t('orders.media.emptyDescription')}
                        icon={ImagePlus}
                        title={t('orders.media.empty')}
                    />
                ) : (
                    <MediaGrid>
                        {media.map((item) => (
                            <MediaTile
                                alt={item.altText ?? ''}
                                key={item.id}
                                kind={item.type}
                                openLabel={t('common.actions.open')}
                                url={item.url}
                                footer={
                                    <Button
                                        fullWidth
                                        leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                        onClick={() => setPending({ kind: 'remove', mediaId: item.id })}
                                        size="small"
                                        variant="dangerGhost"
                                    >
                                        {t('orders.media.remove')}
                                    </Button>
                                }
                            />
                        ))}
                    </MediaGrid>
                )}
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
                    pending?.kind === 'remove' ? t('orders.media.remove') : t('orders.media.uploadConfirmLabel')
                }
                description={
                    pending?.kind === 'remove'
                        ? t('orders.media.removeReasonDescription')
                        : t('orders.media.uploadReasonDescription')
                }
                title={
                    pending?.kind === 'remove'
                        ? t('orders.media.removeReasonTitle')
                        : t('orders.media.uploadReasonTitle')
                }
            />
        </>
    );
}
