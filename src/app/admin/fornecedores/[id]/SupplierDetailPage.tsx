'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    FileText,
    Image as ImageIcon,
    Mail,
    MessageCircle,
    Paperclip,
    Pencil,
    Phone,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    Upload,
    User,
} from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError, uploadToPresignedUrl } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { formatDate, type PresignedUpload, type Supplier, type SupplierAttachment } from '@/types/api';
import { locationLabel, SUPPLIER_STATUS_TONES, whatsappHref } from '../supplier-format';

/** Tipos aceitos pela API; alguns sistemas não informam o MIME de `.doc` e `.csv`. */
const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};
const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_MIME_BY_EXTENSION)
    .map((extension) => `.${extension}`)
    .join(',');

function attachmentMimeType(file: File): string | undefined {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ATTACHMENT_MIME_BY_EXTENSION[extension];
}

/** Texto livre com as quebras de linha que o admin digitou. */
function Prose({ text, empty }: { text: string | null; empty: string }) {
    return text ? (
        <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-ink dark:text-night-text">{text}</p>
    ) : (
        <p className="m-0 text-sm text-muted dark:text-night-muted">{empty}</p>
    );
}

/**
 * Ficha do fornecedor. Pontos fortes e fracos lado a lado no topo: é o que se
 * procura antes de fechar uma cotação. Contatos e anexos na coluna da direita,
 * à mão para abrir o WhatsApp ou baixar a tabela de preço.
 */
export function SupplierDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const { admin } = useAdminAccountAuth();
    const [supplier, setSupplier] = useState<Supplier>();
    const [error, setError] = useState<string>();
    const [attaching, setAttaching] = useState(false);
    const [busy, setBusy] = useState<string>();
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(() => {
        api<Supplier>(`/suppliers/${params.id}`)
            .then((detail) => {
                setSupplier(detail);
                setError(undefined);
            })
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 404
                        ? t('suppliers.detail.notFound')
                        : t('suppliers.error'),
                ),
            );
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    function reportError(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description:
                err instanceof ApiError
                    ? err.status === 403
                        ? t('suppliers.forbidden')
                        : err.message
                    : err instanceof Error
                      ? err.message
                      : t('common.errors.generic'),
        });
    }

    async function uploadAttachments(files: File[]) {
        setAttaching(true);
        try {
            let updated: Supplier | undefined;
            for (const file of files) {
                const mimeType = attachmentMimeType(file);
                if (!mimeType) throw new Error(t('suppliers.attachments.unsupported'));
                const presigned = await api<PresignedUpload>(`/suppliers/${params.id}/attachments/upload-url`, {
                    method: 'POST',
                    body: JSON.stringify({ mimeType, sizeBytes: file.size }),
                });
                const typed = new File([file], file.name, { type: mimeType });
                const uploadResponse = await uploadToPresignedUrl(presigned, typed);
                if (!uploadResponse.ok) throw new Error(t('suppliers.attachments.uploadFailed'));
                updated = await api<Supplier>(`/suppliers/${params.id}/attachments`, {
                    method: 'POST',
                    body: JSON.stringify({ key: presigned.key, fileName: file.name, mimeType, sizeBytes: file.size }),
                });
            }
            if (updated) setSupplier(updated);
            notify({ tone: 'success', title: t('suppliers.attachments.uploadedToast') });
        } catch (err) {
            reportError(err);
        } finally {
            setAttaching(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    }

    async function removeAttachment(attachment: SupplierAttachment) {
        const confirmed = await confirm({
            title: t('suppliers.attachments.removeTitle'),
            description: t('suppliers.attachments.removeConfirm', { name: attachment.fileName }),
            confirmLabel: t('common.actions.remove'),
            tone: 'danger',
        });
        if (!confirmed) return;
        setBusy(`attachment:${attachment.id}`);
        try {
            const updated = await api<Supplier>(`/suppliers/${params.id}/attachments/${attachment.id}`, {
                method: 'DELETE',
            });
            setSupplier(updated);
            notify({ tone: 'success', title: t('suppliers.attachments.removedToast') });
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function removeSupplier(current: Supplier) {
        const confirmed = await confirm({
            title: t('suppliers.detail.deleteTitle'),
            description: t('suppliers.detail.deleteConfirm', { name: current.name }),
            confirmLabel: t('suppliers.detail.delete'),
            tone: 'danger',
        });
        if (!confirmed) return;
        setBusy('delete');
        try {
            await api(`/suppliers/${current.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('suppliers.detail.deletedToast') });
            router.push('/admin/fornecedores');
        } catch (err) {
            reportError(err);
            setBusy(undefined);
        }
    }

    if (error)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/fornecedores"
                    backLabel={t('suppliers.detail.back')}
                    title={t('suppliers.title')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );

    if (!supplier)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/fornecedores"
                    backLabel={t('suppliers.detail.back')}
                    title={t('common.loading')}
                />
                <SkeletonCards label={t('common.loading')} />
            </div>
        );

    const empty = t('suppliers.detail.nothingYet');
    const location = locationLabel(supplier.city, supplier.country);
    const commercial: { label: string; value: string | null; wide?: boolean }[] = [
        { label: t('suppliers.detail.minOrder'), value: supplier.minOrder },
        { label: t('suppliers.detail.leadTime'), value: supplier.leadTime },
        { label: t('suppliers.detail.paymentTerms'), value: supplier.paymentTerms },
        { label: t('suppliers.detail.currency'), value: supplier.currency },
        { label: t('suppliers.detail.priceReference'), value: supplier.priceReference, wide: true },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <>
                        {admin?.role === 'SUPERADMIN' && (
                            <Button
                                leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                loading={busy === 'delete'}
                                onClick={() => void removeSupplier(supplier)}
                                variant="dangerGhost"
                            >
                                {t('suppliers.detail.delete')}
                            </Button>
                        )}
                        <ButtonLink
                            href={`/admin/fornecedores/${supplier.id}/editar`}
                            leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                        >
                            {t('suppliers.detail.edit')}
                        </ButtonLink>
                    </>
                }
                backHref="/admin/fornecedores"
                backLabel={t('suppliers.detail.back')}
                badge={
                    <StatusPill tone={SUPPLIER_STATUS_TONES[supplier.status]}>
                        {t(`suppliers.statuses.${supplier.status}`)}
                    </StatusPill>
                }
                kicker={`${t('suppliers.title')} · ${t(`suppliers.kinds.${supplier.kind}`)}`}
                title={supplier.name}
            />

            <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="grid gap-6 xl:col-span-2">
                    <SectionCard title={t('suppliers.detail.overview')}>
                        <DescriptionList
                            columns={2}
                            items={[
                                { label: t('suppliers.detail.location'), value: location || '—' },
                                {
                                    label: t('suppliers.detail.website'),
                                    value: supplier.website ? (
                                        <a
                                            className="break-all text-primary hover:underline dark:text-night-accent"
                                            href={supplier.website}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            {supplier.website}
                                        </a>
                                    ) : (
                                        '—'
                                    ),
                                },
                                {
                                    label: t('suppliers.detail.modalities'),
                                    wide: true,
                                    value:
                                        supplier.modalities.length === 0 ? (
                                            '—'
                                        ) : (
                                            <span className="flex flex-wrap gap-1.5">
                                                {supplier.modalities.map((name) => (
                                                    <span
                                                        className="rounded-full border border-brand-300 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:border-night-accent/40 dark:bg-night-brand dark:text-night-text"
                                                        key={name}
                                                    >
                                                        {name}
                                                    </span>
                                                ))}
                                            </span>
                                        ),
                                },
                                {
                                    label: t('suppliers.detail.supplies'),
                                    wide: true,
                                    value: <Prose empty={empty} text={supplier.supplies} />,
                                },
                            ]}
                        />
                    </SectionCard>

                    <div className="grid gap-6 md:grid-cols-2">
                        <EvaluationCard
                            icon={<ThumbsUp aria-hidden="true" />}
                            text={supplier.strengths}
                            empty={empty}
                            title={t('suppliers.detail.strengths')}
                            tone="positive"
                        />
                        <EvaluationCard
                            icon={<ThumbsDown aria-hidden="true" />}
                            text={supplier.weaknesses}
                            empty={empty}
                            title={t('suppliers.detail.weaknesses')}
                            tone="negative"
                        />
                    </div>

                    <SectionCard title={t('suppliers.detail.commercial')}>
                        <DescriptionList
                            columns={2}
                            items={commercial.map((item) => ({
                                label: item.label,
                                wide: item.wide,
                                value: item.wide ? <Prose empty="—" text={item.value} /> : item.value || '—',
                            }))}
                        />
                    </SectionCard>

                    <SectionCard title={t('suppliers.detail.notes')}>
                        <Prose empty={empty} text={supplier.notes} />
                    </SectionCard>
                </div>

                <div className="grid gap-6">
                    <SectionCard
                        flush={supplier.contacts.length > 0}
                        icon={<User aria-hidden="true" />}
                        title={t('suppliers.detail.contacts')}
                    >
                        {supplier.contacts.length === 0 ? (
                            <EmptyState icon={User} title={t('suppliers.detail.noContacts')} />
                        ) : (
                            <ul className="m-0 grid list-none divide-y divide-line p-0 dark:divide-night-line">
                                {supplier.contacts.map((contact, index) => {
                                    const whatsapp = whatsappHref(contact.phone);
                                    return (
                                        <li className="grid gap-1.5 px-4 py-3.5" key={`${contact.name}-${index}`}>
                                            <span className="text-sm font-semibold text-ink dark:text-night-text">
                                                {contact.name}
                                                {contact.role && (
                                                    <span className="font-normal text-muted dark:text-night-muted">
                                                        {' '}
                                                        · {contact.role}
                                                    </span>
                                                )}
                                            </span>
                                            {contact.phone && (
                                                <ContactLine icon={<Phone aria-hidden="true" />}>
                                                    <a className="hover:underline" href={`tel:${contact.phone}`}>
                                                        {contact.phone}
                                                    </a>
                                                    {whatsapp && (
                                                        <a
                                                            className="ml-2 text-primary hover:underline dark:text-night-accent"
                                                            href={whatsapp}
                                                            rel="noopener noreferrer"
                                                            target="_blank"
                                                        >
                                                            {t('suppliers.detail.whatsapp')}
                                                        </a>
                                                    )}
                                                </ContactLine>
                                            )}
                                            {contact.wechat && (
                                                <ContactLine icon={<MessageCircle aria-hidden="true" />}>
                                                    {t('suppliers.detail.wechat')}:{' '}
                                                    <span className="mm-data">{contact.wechat}</span>
                                                </ContactLine>
                                            )}
                                            {contact.email && (
                                                <ContactLine icon={<Mail aria-hidden="true" />}>
                                                    <a
                                                        className="break-all hover:underline"
                                                        href={`mailto:${contact.email}`}
                                                    >
                                                        {contact.email}
                                                    </a>
                                                </ContactLine>
                                            )}
                                            {contact.notes && (
                                                <p className="m-0 text-xs whitespace-pre-line text-muted dark:text-night-muted">
                                                    {contact.notes}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </SectionCard>

                    <SectionCard
                        action={
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
                                    tabIndex={-1}
                                    type="file"
                                />
                                <Button
                                    leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                                    loading={attaching}
                                    onClick={() => attachmentInputRef.current?.click()}
                                    size="small"
                                    type="button"
                                    variant="secondary"
                                >
                                    {attaching
                                        ? t('suppliers.attachments.uploadingButton')
                                        : t('suppliers.attachments.uploadButton')}
                                </Button>
                            </>
                        }
                        description={t('suppliers.attachments.description')}
                        flush={supplier.attachments.length > 0}
                        icon={<Paperclip aria-hidden="true" />}
                        title={t('suppliers.attachments.title')}
                    >
                        {supplier.attachments.length === 0 ? (
                            <EmptyState icon={Paperclip} title={t('suppliers.attachments.empty')} />
                        ) : (
                            <ListRows>
                                {supplier.attachments.map((attachment) => (
                                    <li key={attachment.id}>
                                        <ListRow
                                            actions={
                                                <Button
                                                    aria-label={t('suppliers.attachments.removeAria', {
                                                        name: attachment.fileName,
                                                    })}
                                                    iconOnly
                                                    loading={busy === `attachment:${attachment.id}`}
                                                    onClick={() => void removeAttachment(attachment)}
                                                    size="small"
                                                    variant="dangerGhost"
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            }
                                            leading={
                                                attachment.mimeType.startsWith('image/') ? (
                                                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                                                ) : (
                                                    <FileText className="h-4 w-4" aria-hidden="true" />
                                                )
                                            }
                                            meta={`${
                                                attachment.sizeBytes < 1024 * 1024
                                                    ? t('suppliers.attachments.sizeKilobytes', {
                                                          size: Math.max(1, Math.round(attachment.sizeBytes / 1024)),
                                                      })
                                                    : t('suppliers.attachments.sizeMegabytes', {
                                                          size: (attachment.sizeBytes / (1024 * 1024)).toFixed(1),
                                                      })
                                            } · ${formatDate(attachment.createdAt)}`}
                                            title={
                                                <a
                                                    className="hover:underline"
                                                    href={attachment.url}
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                >
                                                    {attachment.fileName}
                                                </a>
                                            }
                                        />
                                    </li>
                                ))}
                            </ListRows>
                        )}
                    </SectionCard>

                    <SectionCard dense title={t('suppliers.detail.record')}>
                        <div className="grid gap-1 text-xs text-muted dark:text-night-muted">
                            <span>
                                {t('suppliers.detail.createdBy', {
                                    name: supplier.createdBy?.name ?? t('suppliers.detail.unknownAdmin'),
                                    date: formatDate(supplier.createdAt),
                                })}
                            </span>
                            <span>
                                {t('suppliers.detail.updatedBy', {
                                    name: supplier.updatedBy?.name ?? t('suppliers.detail.unknownAdmin'),
                                    date: formatDate(supplier.updatedAt),
                                })}
                            </span>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}

function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <span className="flex items-center gap-2 text-sm text-ink dark:text-night-text [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:text-muted">
            {icon}
            <span className="min-w-0">{children}</span>
        </span>
    );
}

function EvaluationCard({
    icon,
    title,
    text,
    empty,
    tone,
}: {
    icon: ReactNode;
    title: string;
    text: string | null;
    empty: string;
    tone: 'positive' | 'negative';
}) {
    const accent =
        tone === 'positive'
            ? 'border-t-jade-600 [&_svg]:text-jade-700 dark:[&_svg]:text-jade-300'
            : 'border-t-origin-600 [&_svg]:text-origin-700 dark:[&_svg]:text-night-coral';
    return (
        <SectionCard className={`border-t-4 ${accent}`} icon={icon} title={title}>
            <Prose empty={empty} text={text} />
        </SectionCard>
    );
}
