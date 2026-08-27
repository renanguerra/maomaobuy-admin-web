'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    ArrowUpRight,
    CheckCircle2,
    Images,
    Package as PackageIcon,
    Plus,
    Ruler,
    Send,
    Trash2,
    Upload,
    Wallet,
    XCircle,
} from 'lucide-react';
import { ActionBar } from '@/components/admin/ActionBar';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { PageHeader } from '@/components/admin/PageHeader';
import { PaymentAttachmentsManager } from '@/components/admin/PaymentAttachmentsManager';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/translations';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import { api, ApiError } from '@/services/api';
import { formatDate, money, packageStatusLabel, type AdminPackage, type PresignedUpload } from '@/types/api';
import { AddPackageItemsDialog } from './AddPackageItemsDialog';

type DialogKind =
    'approve' | 'reject' | 'confirm-freight-payment-manually' | 'dispatch' | 'shipment' | 'add-items' | null;

/** Situações finais do pacote — nada mais é anexado depois delas. */
const CLOSED_STATUSES = ['DELIVERED', 'RETURNED', 'CANCELLED'];

/**
 * Rastreio anda para frente, um evento por vez. O botão mostra sempre o próximo
 * marco esperado — quem informa a exceção usa o suporte, não este atalho.
 */
const TRACKING_NEXT_STEP: Record<string, { status: string; labelKey: MessageKey }> = {
    SHIPPED: { status: 'IN_TRANSIT', labelKey: 'packages.detail.actions.markInTransit' },
    IN_TRANSIT: { status: 'CUSTOMS', labelKey: 'packages.detail.actions.markCustoms' },
    CUSTOMS: { status: 'OUT_FOR_DELIVERY', labelKey: 'packages.detail.actions.markOutForDelivery' },
    OUT_FOR_DELIVERY: { status: 'DELIVERED', labelKey: 'packages.detail.actions.markDelivered' },
};

export function PackageDetailPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const params = useParams<{ id: string }>();
    const [pkg, setPkg] = useState<AdminPackage>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [busy, setBusy] = useState<string>();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(() => {
        api<AdminPackage>(`/packages/${params.id}`)
            .then((loaded) => {
                setPkg(loaded);
                setError(undefined);
            })
            .catch(() => setError(t('packages.detail.error')));
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    function applyUpdate(updated: AdminPackage, message: string) {
        setPkg(updated);
        setDialog(null);
        notify({ tone: 'success', title: message });
        void refreshPendingCounts();
    }

    function reportError(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof ApiError ? err.message : t('common.errors.generic'),
        });
    }

    async function handleActionConfirm(values: { totpCode: string; reason: string } & Record<string, string>) {
        const action = dialog;
        if (!action || action === 'add-items') return;

        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            applyUpdate(
                updated,
                action === 'approve'
                    ? t('packages.detail.feedback.approve')
                    : action === 'reject'
                      ? t('packages.detail.feedback.reject')
                      : action === 'confirm-freight-payment-manually'
                        ? t('packages.detail.feedback.confirm-freight-payment-manually')
                        : action === 'shipment'
                          ? t('packages.detail.feedback.shipment')
                          : t('packages.detail.feedback.dispatch'),
            );
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    async function submitPackage() {
        setBusy('submit');
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/submit`, { method: 'POST' });
            applyUpdate(updated, t('packages.detail.feedback.submitted'));
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function advanceTracking(status: string) {
        setBusy('tracking');
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/tracking`, {
                method: 'POST',
                body: JSON.stringify({ status }),
            });
            applyUpdate(updated, t('packages.detail.feedback.trackingAdvanced'));
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function removeItem(packageItemId: string) {
        const confirmed = await confirm({
            title: t('packages.detail.itemsSection.removeTitle'),
            description: t('packages.detail.itemsSection.removeConfirm'),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy(`remove-item:${packageItemId}`);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/items/${packageItemId}`, {
                method: 'DELETE',
            });
            setPkg(updated);
            notify({ tone: 'success', title: t('packages.detail.itemsSection.removedToast') });
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function uploadPhotos(files: File[]) {
        setUploading(true);
        try {
            const keys: string[] = [];
            for (const file of files) {
                const presigned = await api<PresignedUpload>(`/packages/${params.id}/photos/upload-url`, {
                    method: 'POST',
                    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
                });
                const uploadResponse = await fetch(presigned.uploadUrl, {
                    method: 'PUT',
                    headers: presigned.headers,
                    body: file,
                });
                if (!uploadResponse.ok) throw new Error(t('packages.detail.photosSection.uploadFailed'));
                keys.push(presigned.key);
            }

            const updated = await api<AdminPackage>(`/packages/${params.id}/photos`, {
                method: 'POST',
                body: JSON.stringify({ keys }),
            });
            setPkg(updated);
            notify({ tone: 'success', title: t('packages.detail.feedback.photoUploaded', { count: keys.length }) });
        } catch (err) {
            reportError(err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    if (error) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/pacotes"
                    backLabel={t('packages.detail.backLink')}
                    title={t('packages.list.title')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );
    }

    if (!pkg) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/pacotes"
                    backLabel={t('packages.detail.backLink')}
                    title={t('packages.detail.loading')}
                />
                <SkeletonCards label={t('packages.detail.loading')} />
            </div>
        );
    }

    const isDraft = pkg.status === 'DRAFT';
    const isAwaitingApproval = pkg.status === 'AWAITING_APPROVAL';
    const canEditItems = isDraft || isAwaitingApproval;
    const trackingStep = TRACKING_NEXT_STEP[pkg.status];
    const hasActions =
        canEditItems ||
        pkg.status === 'AWAITING_FREIGHT_QUOTE' ||
        pkg.status === 'AWAITING_FREIGHT_PAYMENT' ||
        pkg.status === 'READY_FOR_DISPATCH' ||
        Boolean(trackingStep);

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/pacotes"
                backLabel={t('packages.detail.backLink')}
                badge={<StatusPill tone={packageStatusTone(pkg.status)}>{packageStatusLabel(pkg.status)}</StatusPill>}
                kicker={t('packages.detail.kicker')}
                title={pkg.packageCode}
                meta={
                    <>
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={`/admin/usuarios/${pkg.userId}`}
                        >
                            {pkg.userName}
                        </Link>{' '}
                        · {pkg.userEmail}
                    </>
                }
            />

            {pkg.rejectionReason && (
                <Alert tone="danger" title={t('packages.detail.fields.rejectionReason')}>
                    <p>{pkg.rejectionReason}</p>
                </Alert>
            )}

            {hasActions && (
                <ActionBar
                    description={t('packages.detail.actionBar.description')}
                    title={t('packages.detail.actionBar.title', { status: packageStatusLabel(pkg.status) })}
                >
                    {canEditItems && (
                        <Button
                            leadingIcon={<Ruler className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('shipment')}
                            size="small"
                            variant="secondary"
                        >
                            {t('packages.detail.actions.setShipping')}
                        </Button>
                    )}
                    {isDraft && (
                        <Button
                            leadingIcon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                            loading={busy === 'submit'}
                            onClick={submitPackage}
                            size="small"
                        >
                            {t('packages.detail.actions.submitForApproval')}
                        </Button>
                    )}
                    {isAwaitingApproval && (
                        <>
                            <Button
                                leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('approve')}
                                size="small"
                            >
                                {t('packages.detail.actions.approve')}
                            </Button>
                            <Button
                                leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog('reject')}
                                size="small"
                                variant="danger"
                            >
                                {t('packages.detail.actions.reject')}
                            </Button>
                        </>
                    )}
                    {pkg.status === 'AWAITING_FREIGHT_QUOTE' && (
                        <Button
                            leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('shipment')}
                            size="small"
                        >
                            {t('packages.detail.actions.quoteFreight')}
                        </Button>
                    )}
                    {pkg.status === 'AWAITING_FREIGHT_PAYMENT' && (
                        <Button
                            leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('confirm-freight-payment-manually')}
                            size="small"
                        >
                            {t('packages.detail.actions.confirmFreightPayment')}
                        </Button>
                    )}
                    {pkg.status === 'READY_FOR_DISPATCH' && (
                        <Button
                            leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setDialog('dispatch')}
                            size="small"
                        >
                            {t('packages.detail.actions.dispatch')}
                        </Button>
                    )}
                    {trackingStep && (
                        <Button
                            leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                            loading={busy === 'tracking'}
                            onClick={() => advanceTracking(trackingStep.status)}
                            size="small"
                            variant="secondary"
                        >
                            {t(trackingStep.labelKey)}
                        </Button>
                    )}
                </ActionBar>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div className="grid min-w-0 gap-5">
                    <SectionCard
                        flush
                        title={t('packages.detail.itemsSection.title')}
                        action={
                            canEditItems ? (
                                <Button
                                    leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                    onClick={() => setDialog('add-items')}
                                    size="small"
                                    variant="secondary"
                                >
                                    {t('packages.detail.itemsSection.addButton')}
                                </Button>
                            ) : undefined
                        }
                    >
                        {pkg.items.length === 0 ? (
                            <EmptyState icon={PackageIcon} title={t('packages.detail.itemsSection.empty')} />
                        ) : (
                            <ListRows>
                                {pkg.items.map((item) => (
                                    <li key={item.id}>
                                        <ListRow
                                            title={item.orderItem.productName}
                                            value={money(item.orderItem.unitAmountMinor, item.orderItem.currency)}
                                            meta={t('packages.detail.itemsSection.quantity', { count: item.quantity })}
                                            leading={
                                                <span className="grid h-9 w-9 place-items-center rounded-lg bg-warm-200 text-muted dark:bg-night-raised dark:text-night-muted">
                                                    <PackageIcon className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            }
                                            actions={
                                                canEditItems ? (
                                                    <Button
                                                        aria-label={t('packages.detail.itemsSection.removeAria', {
                                                            name: item.orderItem.productName,
                                                        })}
                                                        iconOnly
                                                        loading={busy === `remove-item:${item.id}`}
                                                        onClick={() => removeItem(item.id)}
                                                        size="small"
                                                        variant="dangerGhost"
                                                    >
                                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                ) : undefined
                                            }
                                        />
                                    </li>
                                ))}
                            </ListRows>
                        )}
                    </SectionCard>

                    <SectionCard
                        description={t('packages.detail.photosSection.description')}
                        icon={<Images aria-hidden="true" />}
                        title={t('packages.detail.photosSection.title')}
                        action={
                            <>
                                <input
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                    className="sr-only"
                                    multiple
                                    onChange={(event) => {
                                        const files = Array.from(event.target.files ?? []);
                                        if (files.length > 0) void uploadPhotos(files);
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
                                    {uploading
                                        ? t('packages.detail.photosSection.uploadingButton')
                                        : t('packages.detail.photosSection.uploadButton')}
                                </Button>
                            </>
                        }
                    >
                        {pkg.photoUrls.length === 0 ? (
                            <EmptyState icon={Images} title={t('packages.detail.photosSection.empty')} />
                        ) : (
                            <MediaGrid>
                                {pkg.photoUrls.map((url) => (
                                    <MediaTile
                                        alt={t('packages.detail.photosSection.photoAlt')}
                                        key={url}
                                        kind="IMAGE"
                                        openLabel={t('common.actions.open')}
                                        url={url}
                                    />
                                ))}
                            </MediaGrid>
                        )}
                    </SectionCard>

                    <PaymentAttachmentsManager
                        attachments={pkg.paymentAttachments}
                        canManage={!CLOSED_STATUSES.includes(pkg.status)}
                        onChanged={load}
                        resource="packages"
                        resourceId={pkg.id}
                    />
                </div>

                <div className="grid min-w-0 gap-5">
                    <SectionCard dense title={t('packages.detail.shippingSection')}>
                        <SummaryList
                            rows={[
                                {
                                    label: t('packages.detail.fields.shipping'),
                                    value:
                                        pkg.shippingAmountMinor && pkg.shippingCurrency
                                            ? money(pkg.shippingAmountMinor, pkg.shippingCurrency)
                                            : t('common.dash'),
                                    emphasis: true,
                                },
                                { label: t('packages.detail.fields.carrier'), value: pkg.carrier ?? t('common.dash') },
                                {
                                    label: t('packages.detail.fields.trackingCode'),
                                    value: pkg.trackingCode ?? t('common.dash'),
                                },
                                {
                                    label: t('packages.detail.fields.weight'),
                                    value: pkg.weightGrams ? `${pkg.weightGrams} g` : t('common.dash'),
                                },
                                {
                                    label: t('packages.detail.fields.dimensions'),
                                    value:
                                        pkg.lengthMillimeters && pkg.widthMillimeters && pkg.heightMillimeters
                                            ? `${pkg.lengthMillimeters} × ${pkg.widthMillimeters} × ${pkg.heightMillimeters} mm`
                                            : t('common.dash'),
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard dense title={t('packages.detail.datesSection')}>
                        <SummaryList
                            rows={[
                                { label: t('packages.detail.fields.createdAt'), value: formatDate(pkg.createdAt) },
                                { label: t('packages.detail.fields.shippedAt'), value: formatDate(pkg.shippedAt) },
                                { label: t('packages.detail.fields.deliveredAt'), value: formatDate(pkg.deliveredAt) },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard dense title={t('packages.detail.fields.destination')}>
                        <address className="m-0 text-sm leading-relaxed text-ink not-italic dark:text-night-text">
                            <strong className="block">{pkg.destination.recipientFullName}</strong>
                            <span className="mt-1.5 block">
                                {pkg.destination.addressLine1}
                                {pkg.destination.addressLine2 ? `, ${pkg.destination.addressLine2}` : ''}
                            </span>
                            <span className="block">
                                {pkg.destination.locality}/{pkg.destination.administrativeArea} ·{' '}
                                {pkg.destination.postalCode} · {pkg.destination.countryCode}
                            </span>
                        </address>
                    </SectionCard>
                </div>
            </div>

            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.approve.confirmLabel')}
                description={t('packages.detail.dialogs.approve.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'approve'}
                title={t('packages.detail.dialogs.approve.title')}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.reject.confirmLabel')}
                description={t('packages.detail.dialogs.reject.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'reject'}
                requireReason
                title={t('packages.detail.dialogs.reject.title')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.shipment.confirmLabel')}
                description={t('packages.detail.dialogs.shipment.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'shipment'}
                title={t('packages.detail.dialogs.shipment.title')}
                fields={[
                    {
                        name: 'weightGrams',
                        label: t('packages.detail.dialogs.shipment.weight'),
                        kind: 'number',
                        min: 1,
                        suffix: 'g',
                        defaultValue: pkg.weightGrams ? String(pkg.weightGrams) : undefined,
                        placeholder: '1500',
                    },
                    {
                        name: 'lengthMillimeters',
                        label: t('packages.detail.dialogs.shipment.length'),
                        kind: 'number',
                        min: 1,
                        suffix: 'mm',
                        defaultValue: pkg.lengthMillimeters ? String(pkg.lengthMillimeters) : undefined,
                        placeholder: '300',
                    },
                    {
                        name: 'widthMillimeters',
                        label: t('packages.detail.dialogs.shipment.width'),
                        kind: 'number',
                        min: 1,
                        suffix: 'mm',
                        defaultValue: pkg.widthMillimeters ? String(pkg.widthMillimeters) : undefined,
                        placeholder: '200',
                    },
                    {
                        name: 'heightMillimeters',
                        label: t('packages.detail.dialogs.shipment.height'),
                        kind: 'number',
                        min: 1,
                        suffix: 'mm',
                        defaultValue: pkg.heightMillimeters ? String(pkg.heightMillimeters) : undefined,
                        placeholder: '150',
                    },
                    {
                        name: 'shippingCurrency',
                        label: t('packages.detail.dialogs.shipment.currency'),
                        kind: 'select',
                        defaultValue: pkg.shippingCurrency ?? 'BRL',
                        options: [
                            { value: 'BRL', label: 'BRL' },
                            { value: 'CNY', label: 'CNY' },
                        ],
                    },
                    {
                        name: 'shippingAmountMinor',
                        label: t('packages.detail.dialogs.shipment.amount'),
                        kind: 'currency',
                        defaultValue: pkg.shippingAmountMinor ?? '0',
                    },
                ]}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.confirmFreightPayment.confirmLabel')}
                description={t('packages.detail.dialogs.confirmFreightPayment.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'confirm-freight-payment-manually'}
                title={t('packages.detail.dialogs.confirmFreightPayment.title')}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.dispatch.confirmLabel')}
                description={t('packages.detail.dialogs.dispatch.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'dispatch'}
                title={t('packages.detail.dialogs.dispatch.title')}
                fields={[
                    {
                        name: 'carrier',
                        label: t('packages.detail.dialogs.dispatch.carrier'),
                        placeholder: t('packages.detail.dialogs.dispatch.carrierPlaceholder'),
                        minLength: 2,
                        maxLength: 120,
                    },
                    {
                        name: 'trackingCode',
                        label: t('packages.detail.dialogs.dispatch.trackingCode'),
                        placeholder: t('packages.detail.dialogs.dispatch.trackingCodePlaceholder'),
                        minLength: 2,
                        maxLength: 100,
                    },
                ]}
            />
            <AddPackageItemsDialog
                onAdded={(updated) => {
                    setPkg(updated);
                    notify({ tone: 'success', title: t('packages.detail.itemsSection.addedToast') });
                }}
                onClose={() => setDialog(null)}
                open={dialog === 'add-items'}
                packageId={pkg.id}
                userId={pkg.userId}
            />
        </div>
    );
}
