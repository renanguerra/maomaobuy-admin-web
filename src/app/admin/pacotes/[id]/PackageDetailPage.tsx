'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    Calculator,
    ArrowUpRight,
    CheckCircle2,
    ClipboardList,
    FileText,
    ListRestart,
    OctagonAlert,
    Package as PackageIcon,
    Pencil,
    Plus,
    Send,
    Trash2,
    Truck,
    Upload,
    Wallet,
    XCircle,
} from 'lucide-react';
import { PackageCostSheetDialog } from '@/components/admin/CostSheets';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { BoxContents } from '@/components/admin/BoxContents';
import { CarrierQuoteDialog, CarrierShipmentSection } from '@/components/admin/CarrierShipments';
import { Alert } from '@/components/admin/Alert';
import { CommercialInvoiceDialog } from '@/components/admin/CommercialInvoice';
import { CustomerCard } from '@/components/admin/CustomerCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { MediaGrid, MediaTile } from '@/components/admin/MediaGrid';
import { MessageThread } from '@/components/admin/MessageThread';
import { PageActions } from '@/components/admin/PageActions';
import { PageHeader } from '@/components/admin/PageHeader';
import { PageNotices } from '@/components/admin/PageNotices';
import { CopyButton } from '@/components/admin/CopyButton';
import { DeferredSection } from '@/components/admin/DeferredSection';
import { PackageInternalControl } from '@/components/admin/PackageInternalControl';
import { SectionCard } from '@/components/admin/SectionCard';
import { SectionTabs } from '@/components/admin/SectionTabs';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { SummaryList, type SummaryRow } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/translations';
import { useDispatchFields } from '@/services/admin/shipping-modalities';
import { OTHER_RATE_LINE } from '@/types/shipping-table';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import type { ShippingBox } from '@/types/shipping-box';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { customerHref } from '@/services/admin/customer-link';
import { api, ApiError, uploadToPresignedUrl } from '@/services/api';
import {
    formatDate,
    formatPhone,
    lineTotalMinor,
    money,
    packageStatusLabel,
    recipientTaxIdLabel,
    totalUnits,
    type AdminPackage,
    type AdminPackageAttachment,
    type AdminPackageItem,
    type PresignedUpload,
} from '@/types/api';
import { QuantityBadge } from '@/components/admin/QuantityBadge';
import { AddPackageItemsDialog } from './AddPackageItemsDialog';
import { FreightQuoteDialog } from './FreightQuoteDialog';
import { PackageHistory } from './PackageHistory';
import { RemovePackageItemDialog } from './RemovePackageItemDialog';
import { kilograms } from '@/types/carrier';

type DialogKind =
    | 'approve'
    | 'reject'
    | 'cancel'
    | 'dispatch'
    | 'correct-dispatch'
    | 'shipment'
    | 'approve-quote'
    | 'measurements'
    | 'add-items'
    | 'override-status'
    | 'carrier-quote'
    | 'shipping-failure'
    | 'import-tax'
    | null;

function numberOrNull(value: string | undefined): number | null {
    return value ? Number(value) : null;
}

/** Situações finais do pacote — nada mais é anexado depois delas. */
/** Tipos aceitos pela API; alguns sistemas não informam o MIME de `.doc` e `.csv`. */
const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    xml: 'application/xml',
};
const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_MIME_BY_EXTENSION)
    .map((extension) => `.${extension}`)
    .join(',');

function attachmentMimeType(file: File): string | undefined {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ATTACHMENT_MIME_BY_EXTENSION[extension];
}

const CLOSED_STATUSES = ['DELIVERED', 'RETURNED', 'SHIPPING_FAILED', 'CANCELLED'];

/**
 * Espelha `SHIPPING_FAILABLE_STATUSES` do backend: frete pago e pacote ainda
 * não encerrado. Antes do pagamento o caminho é cancelar.
 */
const SHIPPING_FAILABLE_STATUSES = [
    'READY_FOR_DISPATCH',
    'SHIPPED',
    'IN_TRANSIT',
    'CUSTOMS',
    'OUT_FOR_DELIVERY',
    'EXCEPTION',
];

/**
 * Destinos do ajuste manual (`POST /packages/:id/status`), na ordem do fluxo.
 * Espelha as travas do backend: pago não volta antes do pagamento, despachado
 * não volta ao armazém e sem cotação não há o que pagar.
 */
const OVERRIDE_TARGETS = [
    'AWAITING_FREIGHT_QUOTE',
    'AWAITING_FREIGHT_PAYMENT',
    'READY_FOR_DISPATCH',
    'SHIPPED',
    'IN_TRANSIT',
    'CUSTOMS',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
];
const BEFORE_PAYMENT = ['AWAITING_FREIGHT_QUOTE', 'AWAITING_FREIGHT_PAYMENT'];
const BEFORE_DISPATCH = [...BEFORE_PAYMENT, 'READY_FOR_DISPATCH'];

function overrideTargets(pkg: AdminPackage): string[] {
    return OVERRIDE_TARGETS.filter(
        (status) =>
            status !== pkg.status &&
            !(pkg.shippedAt && BEFORE_DISPATCH.includes(status)) &&
            !(pkg.paidAt && BEFORE_PAYMENT.includes(status)) &&
            !(status === 'AWAITING_FREIGHT_PAYMENT' && !pkg.shippingAmountMinor),
    );
}

/** Dias entre o despacho e a entrega; no mesmo dia conta um. */
function transitDays(shippedAt: string, deliveredAt: string): number {
    return Math.max(1, Math.round((Date.parse(deliveredAt) - Date.parse(shippedAt)) / 86_400_000));
}

/** O destino linha a linha: é o que a tela mostra e o que o botão copia. */
function destinationLines(pkg: AdminPackage): string[] {
    const { destination } = pkg;
    return [
        destination.recipientFullName,
        destination.recipientCompanyName !== destination.recipientFullName ? destination.recipientCompanyName : null,
        formatPhone(destination.phoneE164),
        pkg.userEmail,
        recipientTaxIdLabel(destination),
        [destination.addressLine1, destination.addressLine2].filter(Boolean).join(', '),
        destination.district,
        `${destination.locality}/${destination.administrativeArea}`,
        `${destination.postalCode} · ${destination.countryCode}`,
        destination.deliveryInstructions,
    ].filter((line): line is string => Boolean(line));
}

/** Um tipo de arquivo dentro da aba Arquivos. */
function FileGroup({
    title,
    description,
    actions,
    empty,
    isEmpty,
    children,
}: {
    title: string;
    description: string;
    actions: ReactNode;
    empty: string;
    isEmpty: boolean;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="mm-display m-0 text-sm">{title}</h3>
                    <p className="mt-0.5 mb-0 text-xs text-muted dark:text-night-muted">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
            {isEmpty ? <p className="m-0 text-sm text-muted dark:text-night-muted">{empty}</p> : children}
        </section>
    );
}

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
    const { admin } = useAdminAccountAuth();
    const confirm = useConfirm();
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [pkg, setPkg] = useState<AdminPackage>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [costSheetOpen, setCostSheetOpen] = useState(false);
    const [sheetVersion, setSheetVersion] = useState(0);
    // Embalagens carregadas pelo controle interno: preenchem as medidas
    // sugeridas quando o pacote ainda não tem as dele.
    const [boxes, setBoxes] = useState<ShippingBox[]>([]);
    const [removingItem, setRemovingItem] = useState<AdminPackageItem>();
    const [busy, setBusy] = useState<string>();
    const [uploading, setUploading] = useState(false);
    const [attaching, setAttaching] = useState(false);
    // Linha e custo escolhidos na cotação Westlink: preenchem a cotação do
    // pacote e, depois do pagamento, a linha do envio.
    const [hasCarrierShipment, setHasCarrierShipment] = useState(false);
    const [carrierSelection, setCarrierSelection] = useState<{
        parcel: { weightGrams: number; lengthMillimeters: number; widthMillimeters: number; heightMillimeters: number };
        costAmountMinor: string;
        channelCode: string;
    }>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const [invoiceOpen, setInvoiceOpen] = useState(false);

    const { carrierField, modalityField, quoteLineField } = useDispatchFields(
        dialog === 'dispatch' ||
            dialog === 'correct-dispatch' ||
            dialog === 'override-status' ||
            dialog === 'shipment' ||
            dialog === 'approve-quote',
    );

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
        if (action === 'override-status') {
            const updated = await api<AdminPackage>(`/packages/${params.id}/status`, {
                method: 'POST',
                body: JSON.stringify({
                    totpCode: values.totpCode,
                    reason: values.reason,
                    status: values.status,
                    notifyCustomer: values.notifyCustomer === 'yes',
                    carrier: values.carrier || undefined,
                    trackingCode: values.trackingCode || undefined,
                    shippingModalityId: values.shippingModalityId || undefined,
                }),
            });
            applyUpdate(updated, t('packages.detail.feedback.statusOverridden'));
            return;
        }

        if (action === 'shipping-failure') {
            // A resposta é o substituto: a conferência continua nele.
            const replacement = await api<AdminPackage>(`/packages/${params.id}/shipping-failure`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setDialog(null);
            notify({ tone: 'success', title: t('packages.detail.feedback.shippingFailure') });
            void refreshPendingCounts();
            router.push(`/admin/pacotes/${replacement.id}`);
            return;
        }

        if (action === 'import-tax') {
            if (values.outcome === 'charged' && Number(values.amountMinor || '0') === 0)
                throw new Error(t('packages.detail.dialogs.importTax.amountRequired'));
            const updated = await api<AdminPackage>(`/packages/${params.id}/import-tax`, {
                method: 'PUT',
                body: JSON.stringify({
                    amountMinor:
                        values.outcome === 'charged' ? values.amountMinor : values.outcome === 'none' ? '0' : null,
                }),
            });
            applyUpdate(updated, t('packages.detail.feedback.importTax'));
            return;
        }

        if (action === 'measurements') {
            // Só peso e medidas, em qualquer status: o frete não é recotado.
            const updated = await api<AdminPackage>(`/packages/${params.id}/measurements`, {
                method: 'PATCH',
                body: JSON.stringify(values),
            });
            applyUpdate(updated, t('packages.detail.feedback.measurements'));
            return;
        }

        if (action === 'shipment' || action === 'approve-quote') {
            // "Outra" = nenhuma linha cadastrada serviu; o backend guarda nulo.
            try {
                const route = action === 'approve-quote' ? 'approve-and-quote' : 'shipment';
                const updated = await api<AdminPackage>(`/packages/${params.id}/${route}`, {
                    method: 'POST',
                    body: JSON.stringify({
                        ...values,
                        freightRateLineId:
                            values.freightRateLineId === OTHER_RATE_LINE ? null : values.freightRateLineId,
                    }),
                });
                applyUpdate(
                    updated,
                    action === 'approve-quote'
                        ? t('packages.detail.feedback.approveAndQuote')
                        : t('packages.detail.feedback.shipment'),
                );
                return;
            } catch (err) {
                throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
            }
        }

        // Corrigir o despacho é a mesma rota, só que PATCH: cria vs. ajusta.
        const correcting = action === 'correct-dispatch';

        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/${correcting ? 'dispatch' : action}`, {
                method: correcting ? 'PATCH' : 'POST',
                body: JSON.stringify(values),
            });
            applyUpdate(
                updated,
                action === 'approve'
                    ? t('packages.detail.feedback.approve')
                    : action === 'reject'
                      ? t('packages.detail.feedback.reject')
                      : action === 'cancel'
                        ? t('packages.detail.feedback.cancel')
                        : correcting
                          ? t('packages.detail.feedback.correctDispatch')
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

    async function removeItem(item: AdminPackageItem) {
        // Com mais de uma unidade, o admin escolhe quantas saem.
        if (item.quantity > 1) {
            setRemovingItem(item);
            return;
        }
        const packageItemId = item.id;
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

    async function removePhoto(key: string) {
        const confirmed = await confirm({
            title: t('packages.detail.photosSection.removeTitle'),
            description: t('packages.detail.photosSection.removeConfirm'),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy(`remove-photo:${key}`);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/photos`, {
                method: 'DELETE',
                body: JSON.stringify({ key }),
            });
            setPkg(updated);
            notify({ tone: 'success', title: t('packages.detail.photosSection.removedToast') });
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
                const uploadResponse = await uploadToPresignedUrl(presigned, file);
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

    async function uploadAttachments(files: File[]) {
        setAttaching(true);
        try {
            let updated: AdminPackage | undefined;
            for (const file of files) {
                const mimeType = attachmentMimeType(file);
                if (!mimeType) throw new Error(t('packages.detail.attachmentsSection.unsupported'));
                const presigned = await api<PresignedUpload>(`/packages/${params.id}/attachments/upload-url`, {
                    method: 'POST',
                    body: JSON.stringify({ mimeType, sizeBytes: file.size }),
                });
                const typed = new File([file], file.name, { type: mimeType });
                const uploadResponse = await uploadToPresignedUrl(presigned, typed);
                if (!uploadResponse.ok) throw new Error(t('packages.detail.attachmentsSection.uploadFailed'));
                updated = await api<AdminPackage>(`/packages/${params.id}/attachments`, {
                    method: 'POST',
                    body: JSON.stringify({
                        key: presigned.key,
                        fileName: file.name,
                        mimeType,
                        sizeBytes: file.size,
                    }),
                });
            }
            if (updated) setPkg(updated);
            notify({ tone: 'success', title: t('packages.detail.attachmentsSection.uploadedToast') });
        } catch (err) {
            reportError(err);
        } finally {
            setAttaching(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    }

    async function removeAttachment(attachment: AdminPackageAttachment) {
        const confirmed = await confirm({
            title: t('packages.detail.attachmentsSection.removeTitle'),
            description: t('packages.detail.attachmentsSection.removeConfirm', { name: attachment.fileName }),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy(`remove-attachment:${attachment.id}`);
        try {
            const updated = await api<AdminPackage>(`/packages/${params.id}/attachments/${attachment.id}`, {
                method: 'DELETE',
            });
            setPkg(updated);
            notify({ tone: 'success', title: t('packages.detail.attachmentsSection.removedToast') });
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
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
    // Substituto de um pacote com problema no envio: nasce com o frete pago,
    // então não tem cotação nem cobrança — só conferência e despacho.
    const freightPaid = pkg.paidAt !== null;
    // Espelha `lockMutable` do backend: o admin ainda troca itens depois de
    // aprovado, até cotar o frete — o pacote que ele cria já nasce aí.
    const canEditContents = canEditItems || pkg.status === 'AWAITING_FREIGHT_QUOTE';
    // Espelha `PackagesRepository.cancel`: tudo antes do pagamento do frete.
    const canCancel =
        canEditItems || pkg.status === 'AWAITING_FREIGHT_QUOTE' || pkg.status === 'AWAITING_FREIGHT_PAYMENT';
    // Espelha `FREIGHT_QUOTABLE_STATUSES` do backend: com a cobrança aberta o
    // frete ainda pode ser corrigido — o cliente só pagou depois de pagar.
    const canRequoteFreight = pkg.status === 'AWAITING_FREIGHT_PAYMENT';
    const canQuoteCarrier =
        !freightPaid && (canEditItems || pkg.status === 'AWAITING_FREIGHT_QUOTE' || canRequoteFreight);
    const canFailShipment = freightPaid && SHIPPING_FAILABLE_STATUSES.includes(pkg.status);
    const shipmentDefaults = {
        weightGrams: carrierSelection?.parcel.weightGrams ?? pkg.weightGrams,
        lengthMillimeters: carrierSelection?.parcel.lengthMillimeters ?? pkg.lengthMillimeters,
        widthMillimeters: carrierSelection?.parcel.widthMillimeters ?? pkg.widthMillimeters,
        heightMillimeters: carrierSelection?.parcel.heightMillimeters ?? pkg.heightMillimeters,
        freightCostAmountMinor: carrierSelection?.costAmountMinor ?? pkg.freightCostAmountMinor,
    };
    const trackingStep = TRACKING_NEXT_STEP[pkg.status];
    // Corrigir o rastreio só faz sentido enquanto o pacote está a caminho.
    const canCorrectDispatch = pkg.shippedAt !== null && !CLOSED_STATUSES.includes(pkg.status);
    const statusTargets = isDraft || CLOSED_STATUSES.includes(pkg.status) ? [] : overrideTargets(pkg);
    const canOverrideStatus = statusTargets.length > 0;
    // Medida já gravada; sem ela, a da embalagem escolhida no controle interno.
    const chosenBox = boxes.find((box) => box.id === pkg.shippingBoxId);
    const suggestedSide = (side: 'length' | 'width' | 'height') => {
        const own = pkg[`${side}Millimeters`];
        if (own) return String(own);
        const fromBox = chosenBox?.[`${side}Mm`];
        return fromBox ? String(fromBox) : undefined;
    };
    const shipsToBrazil = pkg.destination.countryCode === 'BR';
    // O backend aceita armazém, financeiro e SUPERADMIN; para os outros o campo só mostra.
    const canEditPackaging = ['WAREHOUSE', 'FINANCE', 'SUPERADMIN'].includes(admin?.role ?? '');

    /** O valor e o lápis que o corrige, na mesma linha. */
    const editable = (value: ReactNode, label: string, target: Exclude<DialogKind, null>, allowed: boolean) =>
        allowed ? (
            <span className="inline-flex items-center gap-1">
                {value}
                <Button
                    aria-label={label}
                    className="-my-2"
                    iconOnly
                    onClick={() => setDialog(target)}
                    size="small"
                    title={label}
                    variant="ghost"
                >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
            </span>
        ) : (
            value
        );
    const dash = t('common.dash');
    const hasSize = pkg.lengthMillimeters && pkg.widthMillimeters && pkg.heightMillimeters;
    const transportRows: SummaryRow[] = [
        // Com envio na Westlink, transportadora e linha já estão no bloco dela.
        ...(hasCarrierShipment ? [] : [{ label: t('packages.detail.fields.carrier'), value: pkg.carrier ?? dash }]),
        ...(pkg.carrierService && !hasCarrierShipment
            ? [{ label: t('packages.detail.fields.carrierService'), value: pkg.carrierService }]
            : []),
        {
            label: t('packages.detail.fields.trackingCode'),
            value: editable(
                <span className="min-w-0 break-all">{pkg.trackingCode ?? dash}</span>,
                t('packages.detail.actions.correctDispatch'),
                'correct-dispatch',
                canCorrectDispatch,
            ),
        },
        ...(pkg.shippedAt
            ? [
                  { label: t('packages.detail.fields.shippedAt'), value: formatDate(pkg.shippedAt) },
                  ...(pkg.deliveredAt
                      ? [
                            { label: t('packages.detail.fields.deliveredAt'), value: formatDate(pkg.deliveredAt) },
                            {
                                label: t('packages.detail.fields.transitTime'),
                                value: t('packages.detail.fields.transitDays', {
                                    count: transitDays(pkg.shippedAt, pkg.deliveredAt),
                                }),
                            },
                        ]
                      : []),
              ]
            : []),
    ];
    const volumeRows: SummaryRow[] = [
        {
            label: t('packages.detail.fields.weight'),
            value: editable(
                pkg.weightGrams ? kilograms(pkg.weightGrams) : dash,
                t('packages.detail.actions.editMeasurements'),
                'measurements',
                true,
            ),
        },
        {
            label: t('packages.detail.fields.dimensions'),
            value: hasSize
                ? `${Number(pkg.lengthMillimeters) / 10} × ${Number(pkg.widthMillimeters) / 10} × ${Number(pkg.heightMillimeters) / 10} cm`
                : dash,
        },
    ];
    const chargeRows: SummaryRow[] = [
        {
            label: t('packages.detail.fields.shipping'),
            value: editable(
                pkg.shippingAmountMinor && pkg.shippingCurrency
                    ? money(pkg.shippingAmountMinor, pkg.shippingCurrency)
                    : dash,
                t('packages.detail.actions.requoteFreight'),
                'shipment',
                canRequoteFreight,
            ),
        },
        {
            label: t('packages.detail.fields.storageFee'),
            value: money(pkg.storageFeeAmountMinor, pkg.shippingCurrency ?? 'CNY'),
        },
        ...(pkg.couponCode
            ? [
                  {
                      label: t('packages.detail.fields.coupon', { code: pkg.couponCode }),
                      value: `−${money(pkg.discountAmountMinor, pkg.shippingCurrency ?? 'CNY')}`,
                  },
              ]
            : []),
        {
            label: t('packages.detail.fields.totalDue'),
            value:
                pkg.totalDueAmountMinor && pkg.shippingCurrency
                    ? money(pkg.totalDueAmountMinor, pkg.shippingCurrency)
                    : dash,
            emphasis: true,
        },
        ...(pkg.totalDueAmountMinor || pkg.paidAt
            ? [
                  {
                      label: t('packages.detail.paymentStatus'),
                      value: pkg.paidAt
                          ? t('packages.detail.paidAt', { date: formatDate(pkg.paidAt) })
                          : t('packages.detail.notPaid'),
                  },
              ]
            : []),
        ...(pkg.shippedAt && shipsToBrazil
            ? [
                  {
                      label: t('packages.detail.fields.importTax'),
                      value: editable(
                          pkg.importTaxAmountMinor === null
                              ? t('packages.detail.fields.importTaxUnknown')
                              : pkg.importTaxAmountMinor === '0'
                                ? t('packages.detail.fields.importTaxNone')
                                : money(pkg.importTaxAmountMinor, 'BRL'),
                          t('packages.detail.actions.importTax'),
                          'import-tax',
                          canEditPackaging,
                      ),
                  },
              ]
            : []),
    ];
    // O que ainda define o envio; corrigir um dado é o lápis da linha dele.
    const shippingActions = [
        canEditItems && !freightPaid && (
            <Button
                key="set-shipping"
                leadingIcon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('shipment')}
                size="small"
                variant="secondary"
            >
                {t('packages.detail.actions.setShipping')}
            </Button>
        ),
        canQuoteCarrier && (
            <Button
                key="carrier-quote"
                leadingIcon={<Truck className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('carrier-quote')}
                size="small"
                variant="secondary"
            >
                {t('carrier.quote.action')}
            </Button>
        ),
        pkg.status === 'READY_FOR_DISPATCH' && hasCarrierShipment && (
            <Button
                key="manual-dispatch"
                leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setDialog('dispatch')}
                size="small"
                variant="secondary"
            >
                {t('carrier.section.manualDispatch')}
            </Button>
        ),
    ].filter(Boolean);

    return (
        <div className="grid gap-4">
            <PageHeader
                backHref="/admin/pacotes"
                backLabel={t('packages.detail.backLink')}
                badge={<StatusPill tone={packageStatusTone(pkg.status)}>{packageStatusLabel(pkg.status)}</StatusPill>}
                title={pkg.packageCode}
                meta={
                    <>
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={customerHref(pkg.userId, 'pacote', pkg.id)}
                        >
                            {pkg.userName}
                        </Link>{' '}
                        {pkg.declaration && (
                            <StatusPill hideDot tone="neutral">
                                {t('users.accountTypes.WHOLESALE')}
                            </StatusPill>
                        )}{' '}
                        · {pkg.userEmail}
                    </>
                }
                actions={
                    <PageActions
                        actions={[
                            {
                                key: 'assembly-sheet',
                                label: t('packages.detail.actions.assemblySheet'),
                                icon: ClipboardList,
                                href: `/impressao/pacotes?ids=${pkg.id}`,
                                newTab: true,
                                inline: true,
                            },
                            isDraft && {
                                key: 'submit',
                                label: t('packages.detail.actions.submitForApproval'),
                                icon: ArrowUpRight,
                                tone: 'primary',
                                loading: busy === 'submit',
                                onClick: () => void submitPackage(),
                            },
                            isAwaitingApproval && {
                                key: 'reject',
                                label: t('packages.detail.actions.reject'),
                                icon: XCircle,
                                tone: 'danger',
                                inline: true,
                                onClick: () => setDialog('reject'),
                            },
                            isAwaitingApproval && {
                                key: 'approve',
                                label: t('packages.detail.actions.approve'),
                                icon: CheckCircle2,
                                inline: true,
                                onClick: () => setDialog('approve'),
                            },
                            // Substituto de pacote com problema já tem frete pago: só aprova.
                            isAwaitingApproval &&
                                !freightPaid && {
                                    key: 'approve-quote',
                                    label: t('packages.detail.actions.approveAndQuote'),
                                    icon: Wallet,
                                    tone: 'primary',
                                    onClick: () => setDialog('approve-quote'),
                                },
                            pkg.status === 'AWAITING_FREIGHT_QUOTE' && {
                                key: 'quote-freight',
                                label: t('packages.detail.actions.quoteFreight'),
                                icon: Wallet,
                                tone: 'primary',
                                onClick: () => setDialog('shipment'),
                            },
                            // Com envio Westlink criado, o despacho é pelo envio
                            // (mesmo rastreio da etiqueta); o manual fica no card.
                            pkg.status === 'READY_FOR_DISPATCH' &&
                                !hasCarrierShipment && {
                                    key: 'dispatch',
                                    label: t('packages.detail.actions.dispatch'),
                                    icon: Send,
                                    tone: 'primary',
                                    onClick: () => setDialog('dispatch'),
                                },
                            trackingStep && {
                                key: 'tracking',
                                label: t(trackingStep.labelKey),
                                icon: Send,
                                tone: 'primary',
                                loading: busy === 'tracking',
                                onClick: () => void advanceTracking(trackingStep.status),
                            },
                            canOverrideStatus && {
                                key: 'override-status',
                                label: t('packages.detail.actions.overrideStatus'),
                                icon: ListRestart,
                                onClick: () => setDialog('override-status'),
                            },
                            canCancel &&
                                !isAwaitingApproval && {
                                    key: 'cancel',
                                    label: t('packages.detail.actions.cancel'),
                                    icon: XCircle,
                                    tone: 'danger',
                                    onClick: () => setDialog('cancel'),
                                },
                            canFailShipment && {
                                key: 'shipping-failure',
                                label: t('packages.detail.actions.shippingFailure'),
                                icon: OctagonAlert,
                                tone: 'danger',
                                onClick: () => setDialog('shipping-failure'),
                            },
                        ]}
                    />
                }
            />
            <PackageCostSheetDialog
                onChanged={() => setSheetVersion((value) => value + 1)}
                onClose={() => setCostSheetOpen(false)}
                packageId={costSheetOpen ? pkg.id : null}
            />

            <PageNotices
                notices={[
                    pkg.replacedByPackage && {
                        key: 'replaced',
                        tone: 'danger',
                        title: t('packages.detail.replacement.replacedTitle'),
                        body: t('packages.detail.replacement.replacedDescription', {
                            code: pkg.replacedByPackage.packageCode,
                        }),
                        link: {
                            href: `/admin/pacotes/${pkg.replacedByPackage.id}`,
                            label: t('packages.detail.replacement.open', { code: pkg.replacedByPackage.packageCode }),
                        },
                    },
                    Boolean(pkg.rejectionReason) && {
                        key: 'reason',
                        tone: 'danger',
                        title:
                            pkg.status === 'SHIPPING_FAILED'
                                ? t('packages.detail.fields.shippingFailureReason')
                                : t('packages.detail.fields.rejectionReason'),
                        body: pkg.rejectionReason,
                    },
                    pkg.replacesPackage && {
                        key: 'replaces',
                        tone: 'info',
                        title: t('packages.detail.replacement.replacesTitle', {
                            code: pkg.replacesPackage.packageCode,
                        }),
                        // A orientação de conferência só vale até aprovar.
                        body: canEditItems
                            ? t('packages.detail.replacement.replacesDescription')
                            : t('packages.detail.replacement.replacesSummary'),
                        link: {
                            href: `/admin/pacotes/${pkg.replacesPackage.id}`,
                            label: t('packages.detail.replacement.open', { code: pkg.replacesPackage.packageCode }),
                        },
                    },
                ]}
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div className="grid min-w-0 gap-5">
                    <SectionCard
                        flush
                        title={t('packages.detail.itemsSection.title')}
                        description={
                            pkg.items.length > 0
                                ? t('packages.detail.itemsSection.summary', {
                                      products: pkg.items.length,
                                      units: totalUnits(pkg.items),
                                  })
                                : undefined
                        }
                        action={
                            canEditContents ? (
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
                                            title={
                                                <>
                                                    <span className="sr-only">{item.quantity} × </span>
                                                    {item.orderItem.productName}
                                                </>
                                            }
                                            value={money(
                                                lineTotalMinor(item.orderItem.unitAmountMinor, item.quantity),
                                                item.orderItem.currency,
                                            )}
                                            meta={
                                                <>
                                                    {t('packages.detail.itemsSection.unitPrice', {
                                                        count: item.quantity,
                                                        amount: money(
                                                            item.orderItem.unitAmountMinor,
                                                            item.orderItem.currency,
                                                        ),
                                                    })}
                                                    {item.orderItem.size
                                                        ? t('orders.detail.itemsSection.size', {
                                                              size: item.orderItem.size,
                                                          })
                                                        : ''}
                                                    <BoxContents contents={item.orderItem.boxContents} />
                                                </>
                                            }
                                            leading={<QuantityBadge quantity={item.quantity} />}
                                            actions={
                                                canEditContents ? (
                                                    <Button
                                                        aria-label={t('packages.detail.itemsSection.removeAria', {
                                                            name: item.orderItem.productName,
                                                        })}
                                                        iconOnly
                                                        loading={busy === `remove-item:${item.id}`}
                                                        onClick={() => removeItem(item)}
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

                    <CarrierShipmentSection
                        actions={shippingActions}
                        carrierEnabled={pkg.status === 'READY_FOR_DISPATCH' || Boolean(pkg.shippedAt)}
                        chargeRows={chargeRows}
                        declaration={
                            pkg.declaration && (
                                <div className="grid gap-2">
                                    <SummaryList
                                        rows={[
                                            {
                                                label: t('packages.detail.declarationSection.modeLabel'),
                                                value:
                                                    pkg.declaration.mode === 'CUSTOM'
                                                        ? t('packages.detail.declarationSection.modeCustom')
                                                        : t('packages.detail.declarationSection.modeFull'),
                                            },
                                        ]}
                                    />
                                    {pkg.declaration.mode === 'CUSTOM' && (
                                        <div className="rounded-lg border border-line p-4 dark:border-night-line">
                                            <p className="m-0 text-xs text-muted dark:text-night-muted">
                                                {t('packages.detail.declarationSection.customText')}
                                            </p>
                                            <p className="mt-1 mb-0 text-sm break-words whitespace-pre-line text-ink dark:text-night-text">
                                                {pkg.declaration.description ?? t('common.dash')}
                                            </p>
                                            {pkg.declaration.riskAcceptedAt && (
                                                <p className="mt-2 mb-0 text-xs text-muted dark:text-night-muted">
                                                    {t('packages.detail.declarationSection.riskAccepted')}{' '}
                                                    {formatDate(pkg.declaration.riskAcceptedAt)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        }
                        onActiveChange={setHasCarrierShipment}
                        onPackageChanged={(updated) => {
                            if (updated) setPkg(updated);
                            else load();
                            void refreshPendingCounts();
                        }}
                        pkg={pkg}
                        preferredChannelCode={carrierSelection?.channelCode}
                        transportRows={transportRows}
                        volumeRows={volumeRows}
                    />

                    {invoiceOpen && (
                        <CommercialInvoiceDialog
                            onAttach={(file) => uploadAttachments([file])}
                            onClose={() => setInvoiceOpen(false)}
                            pkg={pkg}
                        />
                    )}

                    <SectionTabs
                        label={t('packages.detail.tabs.label')}
                        tabs={[
                            {
                                key: 'messages',
                                label: t('messages.title'),
                                content: <MessageThread endpoint={`/packages/${params.id}/messages`} />,
                            },
                            {
                                key: 'files',
                                label: t('packages.detail.tabs.files'),
                                count: pkg.attachments.length + pkg.photoUrls.length,
                                content: (
                                    <div className="grid gap-6">
                                        <FileGroup
                                            actions={
                                                <>
                                                    <input
                                                        accept={ATTACHMENT_ACCEPT}
                                                        className="sr-only"
                                                        multiple
                                                        onChange={(event) => {
                                                            const files = Array.from(event.target.files ?? []);
                                                            if (files.length > 0) void uploadAttachments(files);
                                                        }}
                                                        ref={attachmentInputRef}
                                                        type="file"
                                                    />
                                                    <Button
                                                        leadingIcon={
                                                            <FileText className="h-4 w-4" aria-hidden="true" />
                                                        }
                                                        onClick={() => setInvoiceOpen(true)}
                                                        size="small"
                                                        type="button"
                                                        variant="secondary"
                                                    >
                                                        {t('packages.detail.invoice.openButton')}
                                                    </Button>
                                                    <Button
                                                        leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                                                        loading={attaching}
                                                        onClick={() => attachmentInputRef.current?.click()}
                                                        size="small"
                                                        type="button"
                                                        variant="secondary"
                                                    >
                                                        {attaching
                                                            ? t('packages.detail.attachmentsSection.uploadingButton')
                                                            : t('packages.detail.attachmentsSection.uploadButton')}
                                                    </Button>
                                                </>
                                            }
                                            description={t('packages.detail.attachmentsSection.description')}
                                            empty={t('packages.detail.attachmentsSection.empty')}
                                            isEmpty={pkg.attachments.length === 0}
                                            title={t('packages.detail.attachmentsSection.title')}
                                        >
                                            <ListRows>
                                                {pkg.attachments.map((attachment) => (
                                                    <li key={attachment.id}>
                                                        <ListRow
                                                            leading={
                                                                <FileText className="h-4 w-4" aria-hidden="true" />
                                                            }
                                                            title={
                                                                <a className="hover:underline" href={attachment.url}>
                                                                    {attachment.fileName}
                                                                </a>
                                                            }
                                                            meta={
                                                                attachment.sizeBytes < 1024 * 1024
                                                                    ? t(
                                                                          'packages.detail.attachmentsSection.sizeKilobytes',
                                                                          {
                                                                              size: Math.max(
                                                                                  1,
                                                                                  Math.round(
                                                                                      attachment.sizeBytes / 1024,
                                                                                  ),
                                                                              ),
                                                                          },
                                                                      )
                                                                    : t(
                                                                          'packages.detail.attachmentsSection.sizeMegabytes',
                                                                          {
                                                                              size: (
                                                                                  attachment.sizeBytes /
                                                                                  (1024 * 1024)
                                                                              ).toFixed(1),
                                                                          },
                                                                      )
                                                            }
                                                            actions={
                                                                <Button
                                                                    aria-label={t(
                                                                        'packages.detail.attachmentsSection.removeAria',
                                                                        {
                                                                            name: attachment.fileName,
                                                                        },
                                                                    )}
                                                                    iconOnly
                                                                    loading={
                                                                        busy === `remove-attachment:${attachment.id}`
                                                                    }
                                                                    onClick={() => removeAttachment(attachment)}
                                                                    size="small"
                                                                    variant="dangerGhost"
                                                                >
                                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                                </Button>
                                                            }
                                                        />
                                                    </li>
                                                ))}
                                            </ListRows>
                                        </FileGroup>
                                        <FileGroup
                                            actions={
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
                                            description={t('packages.detail.photosSection.description')}
                                            empty={t('packages.detail.photosSection.empty')}
                                            isEmpty={pkg.photoUrls.length === 0}
                                            title={t('packages.detail.photosSection.title')}
                                        >
                                            <MediaGrid>
                                                {pkg.photoUrls.map((url, index) => {
                                                    const key = pkg.photoKeys[index];
                                                    return (
                                                        <MediaTile
                                                            alt={t('packages.detail.photosSection.photoAlt')}
                                                            key={key ?? url}
                                                            kind="IMAGE"
                                                            openLabel={t('common.actions.open')}
                                                            url={url}
                                                            footer={
                                                                key ? (
                                                                    <Button
                                                                        leadingIcon={
                                                                            <Trash2
                                                                                className="h-4 w-4"
                                                                                aria-hidden="true"
                                                                            />
                                                                        }
                                                                        loading={busy === `remove-photo:${key}`}
                                                                        onClick={() => removePhoto(key)}
                                                                        size="small"
                                                                        variant="dangerGhost"
                                                                    >
                                                                        {t('packages.detail.photosSection.remove')}
                                                                    </Button>
                                                                ) : undefined
                                                            }
                                                        />
                                                    );
                                                })}
                                            </MediaGrid>
                                        </FileGroup>
                                    </div>
                                ),
                            },
                            {
                                key: 'history',
                                label: t('packages.detail.tabs.history'),
                                content: <PackageHistory pkg={pkg} />,
                            },
                        ]}
                    />
                </div>

                <div className="grid min-w-0 gap-5">
                    <SectionCard
                        action={<CopyButton label={t('common.actions.copy')} text={destinationLines(pkg).join('\n')} />}
                        dense
                        title={t('packages.detail.fields.destination')}
                    >
                        <address className="m-0 text-sm leading-relaxed break-words text-ink not-italic dark:text-night-text">
                            {destinationLines(pkg).map((line, index) =>
                                index === 0 ? (
                                    <strong className="block" key={line}>
                                        {line}
                                    </strong>
                                ) : (
                                    <span className="block" key={line}>
                                        {line}
                                    </span>
                                ),
                            )}
                        </address>
                    </SectionCard>

                    <CustomerCard
                        href={customerHref(pkg.userId, 'pacote', pkg.id)}
                        name={pkg.userName}
                        userId={pkg.userId}
                    />

                    <DeferredSection
                        description={t('shippingBoxes.package.sectionHint')}
                        icon={<Calculator aria-hidden="true" />}
                        title={t('shippingBoxes.package.sectionTitle')}
                    >
                        <PackageInternalControl
                            canEditPackaging={canEditPackaging}
                            onBoxesLoaded={setBoxes}
                            onError={(message) => notify({ tone: 'danger', title: message })}
                            onOpenSheet={() => setCostSheetOpen(true)}
                            onUpdated={(updated) => {
                                setPkg(updated);
                                notify({ tone: 'success', title: t('shippingBoxes.package.saved') });
                            }}
                            pkg={pkg}
                            sheetVersion={sheetVersion}
                        />
                    </DeferredSection>
                </div>
            </div>

            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.approve.confirmLabel')}
                description={t('packages.detail.dialogs.approve.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'approve'}
                requireTotp={false}
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
                confirmLabel={t('packages.detail.dialogs.shippingFailure.confirmLabel')}
                description={t('packages.detail.dialogs.shippingFailure.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'shipping-failure'}
                requireReason
                title={t('packages.detail.dialogs.shippingFailure.title')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.cancel.confirmLabel')}
                description={t('packages.detail.dialogs.cancel.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'cancel'}
                requireReason
                title={t('packages.detail.dialogs.cancel.title')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.measurements.confirmLabel')}
                description={t('packages.detail.dialogs.measurements.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'measurements'}
                requireTotp={false}
                title={t('packages.detail.dialogs.measurements.title')}
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
                        defaultValue: suggestedSide('length'),
                        placeholder: '300',
                    },
                    {
                        name: 'widthMillimeters',
                        label: t('packages.detail.dialogs.shipment.width'),
                        kind: 'number',
                        min: 1,
                        suffix: 'mm',
                        defaultValue: suggestedSide('width'),
                        placeholder: '200',
                    },
                    {
                        name: 'heightMillimeters',
                        label: t('packages.detail.dialogs.shipment.height'),
                        kind: 'number',
                        min: 1,
                        suffix: 'mm',
                        defaultValue: suggestedSide('height'),
                        placeholder: '150',
                    },
                ]}
            />
            <FreightQuoteDialog
                confirmLabel={t('packages.detail.dialogs.shipment.confirmLabel')}
                defaults={shipmentDefaults}
                description={
                    canRequoteFreight
                        ? t('packages.detail.dialogs.shipment.requoteDescription')
                        : t('packages.detail.dialogs.shipment.description')
                }
                destinationCountry={pkg.destination.countryCode || 'BR'}
                lineField={quoteLineField(pkg, carrierSelection?.channelCode)}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'shipment'}
                title={t('packages.detail.dialogs.shipment.title')}
            />
            <FreightQuoteDialog
                confirmLabel={t('packages.detail.dialogs.approveQuote.confirmLabel')}
                defaults={{
                    ...shipmentDefaults,
                    lengthMillimeters: shipmentDefaults.lengthMillimeters ?? numberOrNull(suggestedSide('length')),
                    widthMillimeters: shipmentDefaults.widthMillimeters ?? numberOrNull(suggestedSide('width')),
                    heightMillimeters: shipmentDefaults.heightMillimeters ?? numberOrNull(suggestedSide('height')),
                }}
                description={t('packages.detail.dialogs.approveQuote.description')}
                destinationCountry={pkg.destination.countryCode || 'BR'}
                lineField={quoteLineField(pkg, carrierSelection?.channelCode)}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'approve-quote'}
                title={t('packages.detail.dialogs.approveQuote.title')}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.dispatch.confirmLabel')}
                description={t('packages.detail.dialogs.dispatch.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'dispatch'}
                requireTotp={false}
                title={t('packages.detail.dialogs.dispatch.title')}
                fields={[
                    modalityField(pkg),
                    carrierField(),
                    {
                        name: 'trackingCode',
                        label: t('packages.detail.dialogs.dispatch.trackingCode'),
                        placeholder: t('packages.detail.dialogs.dispatch.trackingCodePlaceholder'),
                        minLength: 2,
                        maxLength: 100,
                        wide: true,
                    },
                ]}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.correctDispatch.confirmLabel')}
                description={t('packages.detail.dialogs.correctDispatch.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'correct-dispatch'}
                requireTotp={false}
                title={t('packages.detail.dialogs.correctDispatch.title')}
                fields={[
                    modalityField(pkg),
                    carrierField({ defaultValue: pkg.carrier ?? undefined }),
                    {
                        name: 'trackingCode',
                        label: t('packages.detail.dialogs.dispatch.trackingCode'),
                        defaultValue: pkg.trackingCode ?? undefined,
                        minLength: 2,
                        maxLength: 100,
                        wide: true,
                    },
                ]}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.overrideStatus.confirmLabel')}
                description={t('packages.detail.dialogs.overrideStatus.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'override-status'}
                requireReason
                title={t('packages.detail.dialogs.overrideStatus.title')}
                fields={[
                    {
                        name: 'status',
                        kind: 'select',
                        label: t('packages.detail.dialogs.overrideStatus.statusLabel'),
                        defaultValue: statusTargets[statusTargets.length - 1],
                        options: statusTargets.map((status) => ({ value: status, label: packageStatusLabel(status) })),
                    },
                    {
                        name: 'notifyCustomer',
                        kind: 'select',
                        label: t('packages.detail.dialogs.overrideStatus.notifyLabel'),
                        hint: t('packages.detail.dialogs.overrideStatus.notifyHint'),
                        defaultValue: 'no',
                        options: [
                            { value: 'no', label: t('packages.detail.dialogs.overrideStatus.notifyNo') },
                            { value: 'yes', label: t('packages.detail.dialogs.overrideStatus.notifyYes') },
                        ],
                    },
                    ...(pkg.shippedAt
                        ? []
                        : [
                              modalityField(pkg, { optional: true }),
                              carrierField({
                                  hint: t('packages.detail.dialogs.overrideStatus.carrierHint'),
                                  minLength: undefined,
                                  optional: true,
                              }),
                              {
                                  name: 'trackingCode',
                                  label: t('packages.detail.dialogs.dispatch.trackingCode'),
                                  hint: t('packages.detail.dialogs.overrideStatus.carrierHint'),
                                  optional: true,
                                  maxLength: 100,
                              },
                          ]),
                ]}
            />
            <ActionDialog
                confirmLabel={t('packages.detail.dialogs.importTax.confirmLabel')}
                description={t('packages.detail.dialogs.importTax.description')}
                onCancel={() => setDialog(null)}
                onConfirm={handleActionConfirm}
                open={dialog === 'import-tax'}
                requireTotp={false}
                title={t('packages.detail.dialogs.importTax.title')}
                fields={[
                    {
                        name: 'outcome',
                        kind: 'select',
                        label: t('packages.detail.dialogs.importTax.outcome'),
                        defaultValue: pkg.importTaxAmountMinor === '0' ? 'none' : 'charged',
                        options: [
                            { value: 'charged', label: t('packages.detail.dialogs.importTax.charged') },
                            { value: 'none', label: t('packages.detail.dialogs.importTax.none') },
                            ...(pkg.importTaxAmountMinor === null
                                ? []
                                : [{ value: 'unknown', label: t('packages.detail.dialogs.importTax.unknown') }]),
                        ],
                    },
                    {
                        name: 'amountMinor',
                        kind: 'currency',
                        label: t('packages.detail.dialogs.importTax.amount'),
                        hint: t('packages.detail.dialogs.importTax.amountHint'),
                        suffix: 'BRL',
                        optional: true,
                        defaultValue: pkg.importTaxAmountMinor ?? '0',
                    },
                ]}
            />
            {dialog === 'carrier-quote' && (
                <CarrierQuoteDialog
                    onClose={() => setDialog(null)}
                    onUse={(selection) => {
                        setCarrierSelection(selection);
                        setDialog('shipment');
                    }}
                    pkg={pkg}
                />
            )}
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
            {removingItem && (
                <RemovePackageItemDialog
                    item={removingItem}
                    key={removingItem.id}
                    onClose={() => setRemovingItem(undefined)}
                    onRemoved={(updated) => {
                        setPkg(updated);
                        setRemovingItem(undefined);
                        notify({ tone: 'success', title: t('packages.detail.itemsSection.removedToast') });
                    }}
                    packageId={pkg.id}
                />
            )}
        </div>
    );
}
