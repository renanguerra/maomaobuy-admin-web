'use client';

import { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminProductMedia, PresignedUpload } from '@/types/api';
import { mediaTypeFromMimeType } from './media-utils';

interface ProductMediaManagerProps {
    productId: string;
    media: AdminProductMedia[];
    onChanged: () => void;
}

/**
 * Envio de mídia (imagens/vídeos/PDFs) para um produto já existente. Aceita
 * múltiplos arquivos de uma vez; a galeria abaixo mostra tudo que já foi
 * enviado antes, então reenviar o mesmo arquivo nunca é necessário — é só
 * reaproveitar o que já está na lista (texto alternativo, remoção, etc.).
 */
export function ProductMediaManager({ productId, media, onChanged }: ProductMediaManagerProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>();
    const [busyMediaId, setBusyMediaId] = useState<string>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function uploadOne(file: File, sortOrder: number) {
        const type = mediaTypeFromMimeType(file.type);
        if (!type) throw new Error(t('products.media.unsupportedType', { name: file.name }));
        const presigned = await api<PresignedUpload>(`/products/${productId}/media/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            headers: presigned.headers,
            body: file,
        });
        if (!uploadResponse.ok) throw new Error(t('products.media.uploadFailed', { name: file.name }));
        await api(`/products/${productId}/media`, {
            method: 'POST',
            body: JSON.stringify({ key: presigned.key, type, mimeType: file.type, sizeBytes: file.size, sortOrder }),
        });
    }

    async function handleFiles(files: FileList) {
        setUploading(true);
        setError(undefined);
        try {
            let sortOrder = media.length;
            for (const file of Array.from(files)) {
                await uploadOne(file, sortOrder);
                sortOrder += 1;
            }
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('products.media.uploadError'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function updateAlt(mediaId: string, altText: string) {
        setBusyMediaId(mediaId);
        try {
            await api(`/products/${productId}/media/${mediaId}`, { method: 'PATCH', body: JSON.stringify({ altText }) });
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('products.media.updateError'));
        } finally {
            setBusyMediaId(undefined);
        }
    }

    async function remove(mediaId: string) {
        if (!confirm(t('products.media.removeConfirm'))) return;
        setBusyMediaId(mediaId);
        try {
            await api(`/products/${productId}/media/${mediaId}`, { method: 'DELETE' });
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('products.media.removeError'));
        } finally {
            setBusyMediaId(undefined);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="m-0 text-lg">{t('products.media.title')}</h2>
                    <p className="mt-1 text-xs text-muted dark:text-night-muted">{t('products.media.description')}</p>
                </div>
                <label>
                    <input
                        ref={fileInputRef}
                        className="hidden"
                        type="file"
                        accept="image/*,video/*,application/pdf"
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
                        {uploading ? t('products.media.uploadingButton') : t('products.media.uploadButton')}
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
                        ) : (
                            <div className="grid aspect-square w-full place-items-center bg-warm-200 text-xs text-muted dark:bg-night-raised dark:text-night-muted">
                                {item.type}
                            </div>
                        )}
                        <div className="p-3">
                            <input
                                className="min-h-8 w-full rounded border border-line bg-surface px-2 text-xs dark:border-night-line dark:bg-night-canvas"
                                defaultValue={item.altText ?? ''}
                                placeholder={t('products.media.altPlaceholder')}
                                onBlur={(event) => {
                                    if (event.target.value !== (item.altText ?? '')) void updateAlt(item.id, event.target.value);
                                }}
                            />
                            <Button className="mt-2 w-full text-origin-700" size="small" variant="ghost" onClick={() => remove(item.id)} loading={busyMediaId === item.id}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                {t('products.media.remove')}
                            </Button>
                        </div>
                    </div>
                ))}
                {media.length === 0 && <p className="text-sm text-muted dark:text-night-muted">{t('products.media.empty')}</p>}
            </div>
        </div>
    );
}
