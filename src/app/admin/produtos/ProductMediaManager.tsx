'use client';

import { useRef, useState } from 'react';
import { Images, Trash2, Upload } from 'lucide-react';
import { EmptyState } from '@/components/admin/EmptyState';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, uploadToPresignedUrl } from '@/services/api';
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
 * enviado, então reenviar o mesmo arquivo nunca é necessário — é só
 * reaproveitar o que já está na lista (texto alternativo, remoção, etc.).
 */
export function ProductMediaManager({ productId, media, onChanged }: ProductMediaManagerProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const [uploading, setUploading] = useState(false);
    const [busyMediaId, setBusyMediaId] = useState<string>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    function reportError(err: unknown, fallback: string) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof Error ? err.message : fallback,
        });
    }

    async function uploadOne(file: File, sortOrder: number) {
        const type = mediaTypeFromMimeType(file.type);
        if (!type) throw new Error(t('products.media.unsupportedType', { name: file.name }));

        const presigned = await api<PresignedUpload>(`/products/${productId}/media/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await uploadToPresignedUrl(presigned, file);
        if (!uploadResponse.ok) throw new Error(t('products.media.uploadFailed', { name: file.name }));

        await api(`/products/${productId}/media`, {
            method: 'POST',
            body: JSON.stringify({ key: presigned.key, type, mimeType: file.type, sizeBytes: file.size, sortOrder }),
        });
    }

    async function handleFiles(files: File[]) {
        setUploading(true);
        try {
            let sortOrder = media.length;
            for (const file of files) {
                await uploadOne(file, sortOrder);
                sortOrder += 1;
            }
            notify({ tone: 'success', title: t('products.media.uploadedToast', { count: files.length }) });
            onChanged();
        } catch (err) {
            reportError(err, t('products.media.uploadError'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function updateAlt(mediaId: string, altText: string) {
        setBusyMediaId(mediaId);
        try {
            await api(`/products/${productId}/media/${mediaId}`, {
                method: 'PATCH',
                body: JSON.stringify({ altText }),
            });
            onChanged();
        } catch (err) {
            reportError(err, t('products.media.updateError'));
        } finally {
            setBusyMediaId(undefined);
        }
    }

    async function remove(mediaId: string) {
        const confirmed = await confirm({
            title: t('products.media.removeTitle'),
            description: t('products.media.removeConfirm'),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusyMediaId(mediaId);
        try {
            await api(`/products/${productId}/media/${mediaId}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('products.media.removedToast') });
            onChanged();
        } catch (err) {
            reportError(err, t('products.media.removeError'));
        } finally {
            setBusyMediaId(undefined);
        }
    }

    return (
        <SectionCard
            description={t('products.media.description')}
            icon={<Images aria-hidden="true" />}
            title={t('products.media.title')}
            action={
                <>
                    <input
                        accept="image/*,video/*,application/pdf"
                        className="sr-only"
                        multiple
                        onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            if (files.length > 0) void handleFiles(files);
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
                        {uploading ? t('products.media.uploadingButton') : t('products.media.uploadButton')}
                    </Button>
                </>
            }
        >
            {media.length === 0 ? (
                <EmptyState
                    description={t('products.media.emptyDescription')}
                    icon={Images}
                    title={t('products.media.empty')}
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
                                <>
                                    <Input
                                        className="min-h-8 text-xs"
                                        defaultValue={item.altText ?? ''}
                                        hideLabel
                                        label={t('products.media.altLabel')}
                                        onBlur={(event) => {
                                            if (event.target.value !== (item.altText ?? '')) {
                                                void updateAlt(item.id, event.target.value);
                                            }
                                        }}
                                        placeholder={t('products.media.altPlaceholder')}
                                    />
                                    <Button
                                        fullWidth
                                        leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                        loading={busyMediaId === item.id}
                                        onClick={() => remove(item.id)}
                                        size="small"
                                        variant="dangerGhost"
                                    >
                                        {t('products.media.remove')}
                                    </Button>
                                </>
                            }
                        />
                    ))}
                </MediaGrid>
            )}
        </SectionCard>
    );
}
