'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Send, Trash2, Upload } from 'lucide-react';
import { EmptyState } from '@/components/admin/EmptyState';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { SectionCard } from '@/components/admin/SectionCard';
import { inspectionStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { inspectionStatusLabel, type OrderInspection, type PresignedUpload } from '@/types/api';

function mediaTypeFromMimeType(mimeType: string): 'IMAGE' | 'VIDEO' | undefined {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return undefined;
}

/**
 * O laudo de um item, editável dentro do pedido. A inspeção não tem vida
 * própria: ela é o relatório do armazém sobre um item deste pedido.
 */
export function InspectionCard({
    inspection,
    busy,
    onChanged,
    onPublish,
    onFail,
}: {
    inspection: OrderInspection;
    busy: boolean;
    onChanged: () => Promise<void>;
    onPublish: () => void;
    onFail: (error: unknown) => void;
}) {
    const { t } = useTranslation();
    const [summary, setSummary] = useState(inspection.summary ?? '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const editable = inspection.status === 'PENDING' || inspection.status === 'AWAITING_ADMIN';

    async function saveSummary() {
        try {
            await api(`/inspections/${inspection.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ summary }),
            });
            await onChanged();
        } catch (err) {
            onFail(err);
        }
    }

    async function upload(files: File[]) {
        setUploading(true);
        try {
            let sortOrder = inspection.media.length;
            for (const file of files) {
                const type = mediaTypeFromMimeType(file.type);
                if (!type) throw new Error(t('inspections.media.unsupportedType', { name: file.name }));

                const presigned = await api<PresignedUpload>(`/inspections/${inspection.id}/media/upload-url`, {
                    method: 'POST',
                    body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
                });
                const uploaded = await fetch(presigned.uploadUrl, {
                    method: 'PUT',
                    headers: presigned.headers,
                    body: file,
                });
                if (!uploaded.ok) throw new Error(t('inspections.media.uploadFailed', { name: file.name }));

                await api(`/inspections/${inspection.id}/media`, {
                    method: 'POST',
                    body: JSON.stringify({
                        key: presigned.key,
                        type,
                        mimeType: file.type,
                        sizeBytes: file.size,
                        sortOrder,
                    }),
                });
                sortOrder += 1;
            }
            await onChanged();
        } catch (err) {
            onFail(err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function removeMedia(mediaId: string) {
        try {
            await api(`/inspections/${inspection.id}/media/${mediaId}`, { method: 'DELETE' });
            await onChanged();
        } catch (err) {
            onFail(err);
        }
    }

    return (
        <SectionCard
            action={
                <StatusPill tone={inspectionStatusTone(inspection.status)}>
                    {inspectionStatusLabel(inspection.status)}
                </StatusPill>
            }
            description={inspection.productName}
            title={t('inspections.reportTitle')}
        >
            {inspection.decisionNote && (
                <p className="m-0 mb-4 rounded-lg border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-night-warning-surface dark:text-night-text">
                    <strong className="block">{t('inspections.customerNote')}</strong>
                    {inspection.decisionNote}
                </p>
            )}

            <label className="grid content-start gap-2 text-sm font-semibold" htmlFor={`summary-${inspection.id}`}>
                {t('inspections.summaryLabel')}
                <textarea
                    className="min-h-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal text-ink focus:border-brand-400 focus:outline-none disabled:opacity-60 dark:border-night-line dark:bg-night-canvas dark:text-night-text"
                    disabled={!editable}
                    id={`summary-${inspection.id}`}
                    maxLength={4000}
                    onBlur={saveSummary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder={t('inspections.summaryPlaceholder')}
                    value={summary}
                />
            </label>

            <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="m-0 text-sm font-bold text-ink dark:text-night-text">
                        {t('inspections.media.title')}
                    </p>
                    {editable && (
                        <>
                            <input
                                accept="image/*,video/*"
                                className="sr-only"
                                multiple
                                onChange={(event) => {
                                    const files = Array.from(event.target.files ?? []);
                                    if (files.length > 0) void upload(files);
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
                                {t('inspections.media.upload')}
                            </Button>
                        </>
                    )}
                </div>

                {inspection.media.length === 0 ? (
                    <EmptyState
                        description={t('inspections.media.emptyDescription')}
                        icon={ImagePlus}
                        title={t('inspections.media.empty')}
                    />
                ) : (
                    <MediaGrid>
                        {inspection.media.map((item) => (
                            <MediaTile
                                alt={item.altText ?? ''}
                                key={item.id}
                                kind={item.type}
                                openLabel={t('common.actions.open')}
                                url={item.url}
                                footer={
                                    editable ? (
                                        <Button
                                            fullWidth
                                            leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                            onClick={() => removeMedia(item.id)}
                                            size="small"
                                            variant="dangerGhost"
                                        >
                                            {t('inspections.media.remove')}
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ))}
                    </MediaGrid>
                )}
            </div>

            {editable && (
                <div className="mt-5 border-t border-line pt-4 dark:border-night-line">
                    <Button
                        disabled={inspection.media.length === 0}
                        leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                        loading={busy}
                        onClick={onPublish}
                        size="small"
                        title={inspection.media.length === 0 ? t('inspections.publishNeedsMedia') : undefined}
                    >
                        {t('inspections.publish')}
                    </Button>
                    <p className="mt-2 mb-0 text-xs text-muted dark:text-night-subtle">
                        {t('inspections.publishHint')}
                    </p>
                </div>
            )}
        </SectionCard>
    );
}
