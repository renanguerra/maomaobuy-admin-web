'use client';

import { useState, type FormEvent } from 'react';
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
import type { SiteNotice, SiteNoticeFrequency } from '@/types/api';
import { fromDateTimeLocal, toDateTimeLocal } from '../cupons/coupon-format';

const FORM_ID = 'site-notice-form';

/** O corpo que o backend espera; `null` limpa um campo opcional na edição. */
export interface SiteNoticeFormValues {
    title: string;
    body: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
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
    const [frequency, setFrequency] = useState<SiteNoticeFrequency>(notice?.displayFrequency ?? 'ONCE');
    const [isActive, setIsActive] = useState(notice?.isActive ?? true);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const label = ctaLabel.trim();
        const url = ctaUrl.trim();

        if (Boolean(label) !== Boolean(url)) {
            setError(t('siteNotices.form.ctaPairRequired'));
            return;
        }

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                title: title.trim(),
                body: body.trim(),
                ctaLabel: label || null,
                ctaUrl: url || null,
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

            <Preview body={body} ctaLabel={ctaLabel.trim()} title={title} />
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
