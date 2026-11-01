'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, uploadToPresignedUrl } from '@/services/api';
import type { PresignedUpload, SiteNotice, SiteNoticeFrequency } from '@/types/api';
import { fromDateTimeLocal, toDateTimeLocal } from '../cupons/coupon-format';

const FORM_ID = 'site-notice-form';

/** Os mesmos limites do backend: arte pronta, sem SVG e sem conversão. */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type ContentKind = 'TEXT' | 'IMAGE';

/** O corpo que o backend espera; `null` limpa um campo opcional na edição. */
export interface SiteNoticeFormValues {
    title: string;
    /** Aviso é texto **ou** imagem: o lado que não vale vai como `null`. */
    body: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    imageKey: string | null;
    imageAlt: string | null;
    imageLinkUrl: string | null;
    displayFrequency: SiteNoticeFrequency;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    totpCode: string;
}

interface SiteNoticeFormDialogProps {
    open: boolean;
    /** Ausente = criação. */
    notice?: SiteNotice;
    onClose: () => void;
    onSubmit: (values: SiteNoticeFormValues) => Promise<void>;
}

/**
 * O aviso fala com todo cliente que abre a loja: uma sessão roubada que o
 * trocasse poderia pedir Pix em nome da MaoMaoBuy. Por isso salvar pede
 * TOTP, como as ações de dinheiro.
 */
export function SiteNoticeFormDialog({ open, notice, onClose, onSubmit }: SiteNoticeFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const needsEnrollment = useTotpEnrollmentGate(open, true);

    if (needsEnrollment) {
        return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            size="large"
            title={notice ? t('siteNotices.form.editTitle') : t('siteNotices.form.createTitle')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
        >
            {open && <SiteNoticeForm notice={notice} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />}
        </Modal>
    );
}

function SiteNoticeForm({
    notice,
    onSubmit,
    onSubmittingChange,
}: {
    notice?: SiteNotice;
    onSubmit: (values: SiteNoticeFormValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [title, setTitle] = useState(notice?.title ?? '');
    const [body, setBody] = useState(notice?.body ?? '');
    const [ctaLabel, setCtaLabel] = useState(notice?.ctaLabel ?? '');
    const [ctaUrl, setCtaUrl] = useState(notice?.ctaUrl ?? '');
    const [kind, setKind] = useState<ContentKind>(notice?.imageKey ? 'IMAGE' : 'TEXT');
    const [imageKey, setImageKey] = useState(notice?.imageKey ?? null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(notice?.image?.url ?? null);
    const [imageAlt, setImageAlt] = useState(notice?.image?.alt ?? '');
    const [imageLinkUrl, setImageLinkUrl] = useState(notice?.image?.linkUrl ?? '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [frequency, setFrequency] = useState<SiteNoticeFrequency>(notice?.displayFrequency ?? 'ONCE');
    const [isActive, setIsActive] = useState(notice?.isActive ?? true);
    const [error, setError] = useState<string>();

    // A prévia local é um `blob:`; solta a memória ao trocar de arquivo ou fechar.
    useEffect(() => {
        if (!imagePreviewUrl?.startsWith('blob:')) return;
        return () => URL.revokeObjectURL(imagePreviewUrl);
    }, [imagePreviewUrl]);

    /**
     * Envia na hora da escolha, direto para o storage. O arquivo só chega ao
     * site quando o aviso é salvo (com TOTP); até lá é só um rascunho.
     */
    async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!IMAGE_MIME_TYPES.includes(file.type)) {
            setError(t('siteNotices.form.imageUnsupported'));
            return;
        }
        if (file.size > IMAGE_MAX_BYTES) {
            setError(t('siteNotices.form.imageTooLarge'));
            return;
        }
        setUploading(true);
        onSubmittingChange(true);
        setError(undefined);
        try {
            const presigned = await api<PresignedUpload>('/site-notices/image/upload-url', {
                method: 'POST',
                body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
            });
            const response = await uploadToPresignedUrl(presigned, file);
            if (!response.ok) throw new Error(t('siteNotices.form.imageUploadFailed'));
            setImageKey(presigned.key);
            setImagePreviewUrl(URL.createObjectURL(file));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('siteNotices.form.imageUploadFailed'));
        } finally {
            setUploading(false);
            onSubmittingChange(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const isImage = kind === 'IMAGE';
        const label = isImage ? '' : ctaLabel.trim();
        const url = isImage ? '' : ctaUrl.trim();

        if (isImage && !imageKey) {
            setError(t('siteNotices.form.imageRequired'));
            return;
        }
        if (Boolean(label) !== Boolean(url)) {
            setError(t('siteNotices.form.ctaPairRequired'));
            return;
        }

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                title: title.trim(),
                body: isImage ? null : body.trim(),
                ctaLabel: label || null,
                ctaUrl: url || null,
                imageKey: isImage ? imageKey : null,
                imageAlt: isImage ? imageAlt.trim() : null,
                imageLinkUrl: isImage ? imageLinkUrl.trim() || null : null,
                displayFrequency: frequency,
                isActive,
                startsAt: fromDateTimeLocal(String(data.get('startsAt') ?? '')),
                endsAt: fromDateTimeLocal(String(data.get('endsAt') ?? '')),
                totpCode: String(data.get('totpCode') ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('siteNotices.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <form className="grid content-start gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
                <Input
                    fieldClassName="sm:col-span-2"
                    label={t('siteNotices.form.title')}
                    maxLength={120}
                    minLength={2}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    value={title}
                />
                <Select
                    fieldClassName="sm:col-span-2"
                    hint={t(`siteNotices.form.contentHints.${kind}`)}
                    label={t('siteNotices.form.content')}
                    onChange={(event) => setKind(event.target.value as ContentKind)}
                    options={[
                        { value: 'TEXT', label: t('siteNotices.form.contentKinds.TEXT') },
                        { value: 'IMAGE', label: t('siteNotices.form.contentKinds.IMAGE') },
                    ]}
                    value={kind}
                />

                {kind === 'TEXT' ? (
                    <>
                        <Textarea
                            fieldClassName="sm:col-span-2"
                            hint={t('siteNotices.form.bodyHint')}
                            label={t('siteNotices.form.body')}
                            maxLength={2000}
                            onChange={(event) => setBody(event.target.value)}
                            required
                            rows={5}
                            value={body}
                        />

                        <Input
                            hint={t('siteNotices.form.ctaLabelHint')}
                            label={t('siteNotices.form.ctaLabel')}
                            maxLength={40}
                            onChange={(event) => setCtaLabel(event.target.value)}
                            value={ctaLabel}
                        />
                        <Input
                            hint={t('siteNotices.form.ctaUrlHint')}
                            label={t('siteNotices.form.ctaUrl')}
                            maxLength={500}
                            onChange={(event) => setCtaUrl(event.target.value)}
                            placeholder="/loja"
                            value={ctaUrl}
                        />
                    </>
                ) : (
                    <>
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-semibold text-ink dark:text-night-text">
                                {t('siteNotices.form.image')}
                            </span>
                            <input
                                accept={IMAGE_MIME_TYPES.join(',')}
                                className="sr-only"
                                onChange={handleImageChange}
                                ref={fileInputRef}
                                type="file"
                            />
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    loading={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                    type="button"
                                    variant="secondary"
                                >
                                    {imageKey ? t('siteNotices.form.imageReplace') : t('siteNotices.form.imageChoose')}
                                </Button>
                                <span className="text-xs text-muted dark:text-night-muted">
                                    {t('siteNotices.form.imageHint')}
                                </span>
                            </div>
                        </div>
                        <Input
                            fieldClassName="sm:col-span-2"
                            hint={t('siteNotices.form.imageAltHint')}
                            label={t('siteNotices.form.imageAlt')}
                            maxLength={300}
                            onChange={(event) => setImageAlt(event.target.value)}
                            required
                            value={imageAlt}
                        />
                        <Input
                            fieldClassName="sm:col-span-2"
                            hint={t('siteNotices.form.imageLinkUrlHint')}
                            label={t('siteNotices.form.imageLinkUrl')}
                            maxLength={500}
                            onChange={(event) => setImageLinkUrl(event.target.value)}
                            placeholder="/loja"
                            value={imageLinkUrl}
                        />
                    </>
                )}

                <Select
                    fieldClassName="sm:col-span-2"
                    hint={t(`siteNotices.frequencyHints.${frequency}`)}
                    label={t('siteNotices.form.frequency')}
                    onChange={(event) => setFrequency(event.target.value as SiteNoticeFrequency)}
                    options={[
                        { value: 'ONCE', label: t('siteNotices.frequencies.ONCE') },
                        { value: 'EVERY_VISIT', label: t('siteNotices.frequencies.EVERY_VISIT') },
                    ]}
                    value={frequency}
                />

                <Input
                    defaultValue={toDateTimeLocal(notice?.startsAt ?? null)}
                    hint={t('siteNotices.form.startsAtHint')}
                    label={t('siteNotices.form.startsAt')}
                    name="startsAt"
                    type="datetime-local"
                />
                <Input
                    defaultValue={toDateTimeLocal(notice?.endsAt ?? null)}
                    hint={t('siteNotices.form.endsAtHint')}
                    label={t('siteNotices.form.endsAt')}
                    name="endsAt"
                    type="datetime-local"
                />

                <Checkbox
                    checked={isActive}
                    className="sm:col-span-2"
                    label={t('siteNotices.form.isActive')}
                    onChange={(event) => setIsActive(event.target.checked)}
                />

                <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    label={t('common.fields.totpCode')}
                    maxLength={6}
                    name="totpCode"
                    pattern="\d{6}"
                    required
                />

                {error && (
                    <Alert className="sm:col-span-2" tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
            </form>

            {kind === 'IMAGE' ? (
                <ImagePreview alt={imageAlt} url={imagePreviewUrl} />
            ) : (
                <Preview body={body} ctaLabel={ctaLabel.trim()} title={title} />
            )}
        </div>
    );
}

/** Rascunho do modal do site, para conferir quebra de linha e tamanho do texto antes de publicar. */
function Preview({ title, body, ctaLabel }: { title: string; body: string; ctaLabel: string }) {
    const { t } = useTranslation();
    return (
        <aside aria-label={t('siteNotices.form.preview')} className="grid content-start gap-2">
            <span className="text-xs font-semibold text-muted dark:text-night-muted">
                {t('siteNotices.form.preview')}
            </span>
            <div className="rounded-lg border border-line bg-surface p-5 shadow-sm dark:border-night-line dark:bg-night-surface">
                <p className="m-0 text-base font-bold text-ink dark:text-night-text">
                    {title.trim() || t('siteNotices.form.previewTitle')}
                </p>
                <p className="mt-3 mb-0 whitespace-pre-line text-sm leading-relaxed text-muted dark:text-night-muted">
                    {body.trim() || t('siteNotices.form.previewBody')}
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <span className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink dark:border-night-line dark:text-night-text">
                        {ctaLabel ? t('siteNotices.form.previewLater') : t('siteNotices.form.previewDismiss')}
                    </span>
                    {ctaLabel && (
                        <span className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white">
                            {ctaLabel}
                        </span>
                    )}
                </div>
            </div>
        </aside>
    );
}

/** Como o site mostra: só a imagem, sem título, texto nem botões. */
function ImagePreview({ url, alt }: { url: string | null; alt: string }) {
    const { t } = useTranslation();
    return (
        <aside aria-label={t('siteNotices.form.preview')} className="grid content-start gap-2">
            <span className="text-xs font-semibold text-muted dark:text-night-muted">
                {t('siteNotices.form.preview')}
            </span>
            {url ? (
                // Prévia de arquivo local (`blob:`) ou do bucket público: o
                // otimizador do Next não serve nenhum dos dois.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    alt={alt}
                    className="block h-auto w-full rounded-lg border border-line shadow-sm dark:border-night-line"
                    src={url}
                />
            ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-lg border border-dashed border-line p-5 text-center text-sm text-muted dark:border-night-line dark:text-night-muted">
                    {t('siteNotices.form.previewImage')}
                </div>
            )}
        </aside>
    );
}
