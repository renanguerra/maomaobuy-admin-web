'use client';

import { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
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

/**
 * Fotos e vídeos anexados ao pedido durante a análise, só liberado enquanto
 * o pedido está aguardando aprovação. Segue o padrão de upload pré-assinado
 * de `ProductMediaManager`, mas exige um motivo por envio/remoção — cada
 * mudança vira uma entrada no histórico do pedido.
 */
export function OrderMediaManager({ orderId, media, onChanged }: OrderMediaManagerProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>();
    const [busyMediaId, setBusyMediaId] = useState<string>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function uploadOne(file: File, sortOrder: number, reason: string) {
        const type = mediaTypeFromMimeType(file.type);
        if (!type) throw new Error(t('orders.media.unsupportedType', { name: file.name }));
        const presigned = await api<PresignedUpload>(`/orders/${orderId}/media/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            headers: presigned.headers,
            body: file,
        });
        if (!uploadResponse.ok) throw new Error(t('orders.media.uploadFailed', { name: file.name }));
        await api(`/orders/${orderId}/media`, {
            method: 'POST',
            body: JSON.stringify({ key: presigned.key, type, mimeType: file.type, sizeBytes: file.size, sortOrder, reason }),
        });
    }

    async function handleFiles(files: FileList) {
        const reason = window.prompt(t('orders.media.promptSendReason'));
        if (!reason || reason.trim().length < 5) {
            if (reason !== null) setError(t('orders.media.reasonTooShort'));
            return;
        }
        setUploading(true);
        setError(undefined);
        try {
            let sortOrder = media.length;
            for (const file of Array.from(files)) {
                await uploadOne(file, sortOrder, reason.trim());
                sortOrder += 1;
            }
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('orders.media.uploadError'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function remove(mediaId: string) {
        const reason = window.prompt(t('orders.media.promptRemoveReason'));
        if (!reason || reason.trim().length < 5) {
            if (reason !== null) setError(t('orders.media.reasonTooShort'));
            return;
        }
        setBusyMediaId(mediaId);
        setError(undefined);
        try {
            await api(`/orders/${orderId}/media/${mediaId}`, { method: 'DELETE', body: JSON.stringify({ reason: reason.trim() }) });
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('orders.media.removeError'));
        } finally {
            setBusyMediaId(undefined);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="m-0 text-lg">{t('orders.media.title')}</h2>
                    <p className="mt-1 text-xs text-muted dark:text-night-muted">{t('orders.media.description')}</p>
                </div>
                <label>
                    <input
                        ref={fileInputRef}
                        className="hidden"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(event) => {
                            if (event.target.files && event.target.files.length > 0) void handleFiles(event.target.files);
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
                        {uploading ? t('orders.media.uploadingButton') : t('orders.media.uploadButton')}
                    </Button>
                </label>
            </div>

            {error && <p className="mt-3 text-sm text-secondary">{error}</p>}

            <div className="mt-4 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
                {media.map((item) => (
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
                        <div className="p-3">
                            <Button className="w-full text-origin-700" size="small" variant="ghost" onClick={() => remove(item.id)} loading={busyMediaId === item.id}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                {t('orders.media.remove')}
                            </Button>
                        </div>
                    </div>
                ))}
                {media.length === 0 && <p className="text-sm text-muted dark:text-night-muted">{t('orders.media.empty')}</p>}
            </div>
        </div>
    );
}
