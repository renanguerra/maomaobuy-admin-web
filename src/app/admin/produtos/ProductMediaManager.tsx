'use client';

import { useRef, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, Images, Star, Trash2, Upload } from 'lucide-react';
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
    // Ordem otimista: a galeria muda na hora e o servidor confirma depois. Só
    // vale enquanto bate com as mídias recebidas — upload ou remoção trazem
    // uma lista nova, e a ordem volta a ser a do servidor.
    const [pending, setPending] = useState<{ base: AdminProductMedia[]; ids: string[] }>();
    const [draggedId, setDraggedId] = useState<string>();
    const [dropTargetId, setDropTargetId] = useState<string>();
    const ordered =
        pending && pending.base === media
            ? pending.ids.map((id) => media.find((item) => item.id === id)).filter((item) => item !== undefined)
            : media;

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

    async function saveOrder(ids: string[]) {
        const previous = ordered.map((item) => item.id);
        if (ids.every((id, index) => id === previous[index])) return;
        setPending({ base: media, ids });
        try {
            await api(`/products/${productId}/media/order`, {
                method: 'PUT',
                body: JSON.stringify({ mediaIds: ids }),
            });
            onChanged();
        } catch (err) {
            setPending({ base: media, ids: previous });
            reportError(err, t('products.media.reorderError'));
        }
    }

    function move(mediaId: string, toIndex: number) {
        const ids = ordered.map((item) => item.id).filter((id) => id !== mediaId);
        ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, mediaId);
        void saveOrder(ids);
    }

    function dropOn(event: DragEvent, targetId: string) {
        event.preventDefault();
        setDropTargetId(undefined);
        if (!draggedId || draggedId === targetId) return;
        move(
            draggedId,
            ordered.findIndex((item) => item.id === targetId),
        );
        setDraggedId(undefined);
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
                <>
                    {ordered.length > 1 && (
                        <p className="m-0 mb-3 text-sm text-muted dark:text-night-muted">
                            {t('products.media.orderHint')}
                        </p>
                    )}
                    <MediaGrid>
                        {ordered.map((item, index) => (
                            <div
                                className={`relative rounded-lg transition ${draggedId === item.id ? 'opacity-40' : ''} ${
                                    dropTargetId === item.id && draggedId !== item.id
                                        ? 'outline-2 outline-offset-2 outline-brand-400'
                                        : ''
                                }`}
                                draggable={ordered.length > 1}
                                key={item.id}
                                onDragEnd={() => {
                                    setDraggedId(undefined);
                                    setDropTargetId(undefined);
                                }}
                                onDragOver={(event) => {
                                    if (!draggedId) return;
                                    event.preventDefault();
                                    setDropTargetId(item.id);
                                }}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDraggedId(item.id);
                                }}
                                onDrop={(event) => dropOn(event, item.id)}
                            >
                                {index === 0 && ordered.length > 1 && (
                                    <span className="pointer-events-none absolute top-2 left-2 z-10 rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white dark:bg-black/80">
                                        {t('products.media.cover')}
                                    </span>
                                )}
                                <MediaTile
                                    alt={item.altText ?? ''}
                                    kind={item.type}
                                    openLabel={t('common.actions.open')}
                                    url={item.url}
                                    footer={
                                        <>
                                            {ordered.length > 1 && (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        aria-label={t('products.media.moveBefore')}
                                                        disabled={index === 0}
                                                        iconOnly
                                                        leadingIcon={
                                                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                                        }
                                                        onClick={() => move(item.id, index - 1)}
                                                        size="small"
                                                        title={t('products.media.moveBefore')}
                                                        type="button"
                                                        variant="ghost"
                                                    />
                                                    <Button
                                                        aria-label={t('products.media.moveAfter')}
                                                        disabled={index === ordered.length - 1}
                                                        iconOnly
                                                        leadingIcon={
                                                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                                        }
                                                        onClick={() => move(item.id, index + 1)}
                                                        size="small"
                                                        title={t('products.media.moveAfter')}
                                                        type="button"
                                                        variant="ghost"
                                                    />
                                                    {index > 0 && (
                                                        <Button
                                                            aria-label={t('products.media.makeCover')}
                                                            className="ml-auto"
                                                            iconOnly
                                                            leadingIcon={
                                                                <Star className="h-4 w-4" aria-hidden="true" />
                                                            }
                                                            onClick={() => move(item.id, 0)}
                                                            size="small"
                                                            title={t('products.media.makeCover')}
                                                            type="button"
                                                            variant="ghost"
                                                        />
                                                    )}
                                                </div>
                                            )}
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
                            </div>
                        ))}
                    </MediaGrid>
                </>
            )}
        </SectionCard>
    );
}
