'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardCheck, ImagePlus, Send, Trash2, Upload } from 'lucide-react';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { inspectionStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import {
    inspectionStatusLabel,
    type AdminInspection,
    type AdminPendingInspectionItem,
    type PresignedUpload,
} from '@/types/api';

const FILTERS = ['PENDING', 'AWAITING_ADMIN', 'AWAITING_CUSTOMER', 'DECIDED'] as const;
type Filter = (typeof FILTERS)[number];

function mediaTypeFromMimeType(mimeType: string): 'IMAGE' | 'VIDEO' | undefined {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return undefined;
}

/**
 * A bancada do armazém. Abre o laudo de um item que chegou, anexa as fotos e os
 * vídeos e publica para o cliente decidir. Enquanto não é publicado o cliente
 * não vê nada — é rascunho nosso.
 */
export function AdminInspectionsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const searchParams = useSearchParams();
    const highlightedOrderId = searchParams.get('orderId');

    const [filter, setFilter] = useState<Filter>('PENDING');
    const [inspections, setInspections] = useState<AdminInspection[]>();
    const [pendingItems, setPendingItems] = useState<AdminPendingInspectionItem[]>([]);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState<string>();

    // O `setState` fica no `.then` de propósito: chamado direto no corpo do
    // efeito, o lint (com razão) acusa render em cascata.
    const load = useCallback(
        () =>
            Promise.all([
                api<AdminInspection[]>(`/inspections?status=${filter}`),
                api<AdminPendingInspectionItem[]>('/inspections/pending-items'),
            ])
                .then(([list, items]) => {
                    setInspections(list);
                    setPendingItems(items);
                    setError(undefined);
                })
                .catch(() => setError(t('inspections.error'))),
        [filter, t],
    );

    useEffect(() => {
        void load();
    }, [load]);

    function fail(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof ApiError ? err.message : t('common.errors.generic'),
        });
    }

    async function openInspection(orderItemId: string) {
        setBusy(orderItemId);
        try {
            await api<AdminInspection>('/inspections', {
                method: 'POST',
                body: JSON.stringify({ orderItemId }),
            });
            notify({ tone: 'success', title: t('inspections.feedback.created') });
            setFilter('PENDING');
            await load();
        } catch (err) {
            fail(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function publish(id: string) {
        setBusy(id);
        try {
            await api<AdminInspection>(`/inspections/${id}/publish`, { method: 'POST' });
            notify({ tone: 'success', title: t('inspections.feedback.published') });
            void refreshPendingCounts();
            await load();
        } catch (err) {
            fail(err);
        } finally {
            setBusy(undefined);
        }
    }

    return (
        <div className="grid gap-5">
            <PageHeader
                description={t('inspections.description')}
                kicker={t('inspections.kicker')}
                title={t('inspections.title')}
            />

            <SectionCard
                description={t('inspections.queue.description')}
                icon={<ClipboardCheck aria-hidden="true" />}
                title={t('inspections.queue.title')}
            >
                {pendingItems.length === 0 ? (
                    <EmptyState
                        description={t('inspections.queue.emptyDescription')}
                        icon={ClipboardCheck}
                        title={t('inspections.queue.empty')}
                    />
                ) : (
                    <ul className="m-0 grid list-none gap-2 p-0">
                        {pendingItems.map((item) => (
                            <li
                                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                                    item.orderId === highlightedOrderId
                                        ? 'border-brand-400 bg-brand-50 dark:border-night-accent dark:bg-night-brand'
                                        : 'border-line dark:border-night-line'
                                }`}
                                key={item.orderItemId}
                            >
                                <span className="min-w-0 text-sm">
                                    <strong className="block truncate text-ink dark:text-night-text">
                                        {item.productName}
                                    </strong>
                                    <span className="mm-data text-xs text-muted dark:text-night-subtle">
                                        {item.orderId.slice(0, 8).toUpperCase()}
                                    </span>
                                </span>
                                <Button
                                    loading={busy === item.orderItemId}
                                    onClick={() => openInspection(item.orderItemId)}
                                    size="small"
                                >
                                    {t('inspections.queue.open')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <FilterTabs
                label={t('inspections.filterLabel')}
                onChange={(value) => setFilter(value as Filter)}
                options={FILTERS.map((value) => ({ value, label: inspectionStatusLabel(value) }))}
                value={filter}
            />

            {error && <EmptyState description={error} icon={ClipboardCheck} title={t('inspections.error')} />}

            {!inspections && !error && <SkeletonCards label={t('inspections.loading')} />}

            {inspections?.length === 0 && (
                <EmptyState
                    description={t('inspections.emptyDescription')}
                    icon={ClipboardCheck}
                    title={t('inspections.empty')}
                />
            )}

            {inspections?.map((inspection) => (
                <InspectionCard
                    busy={busy === inspection.id}
                    inspection={inspection}
                    key={inspection.id}
                    onChanged={load}
                    onFail={fail}
                    onPublish={() => publish(inspection.id)}
                />
            ))}
        </div>
    );
}

function InspectionCard({
    inspection,
    busy,
    onChanged,
    onPublish,
    onFail,
}: {
    inspection: AdminInspection;
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
            description={inspection.orderId ? inspection.orderId.slice(0, 8).toUpperCase() : undefined}
            title={inspection.productName ?? t('inspections.unnamedItem')}
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
