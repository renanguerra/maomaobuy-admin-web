'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { markTotpEnrolled } from '@/services/auth/admin-account-auth';
import type { TotpEnrollmentStart } from '@/types/api';

const FORM_ID = 'totp-enrollment-form';

interface TotpEnrollmentDialogProps {
    open: boolean;
    onCancel: () => void;
    /** Chamado depois que o backend confirmou o primeiro código. */
    onEnrolled: () => void;
}

/**
 * Cadastro do autenticador do admin logado. Abre sozinho na primeira ação
 * sensível de quem ainda não cadastrou (ver `ActionDialog`): gera o segredo
 * no backend, mostra o QR para o app autenticador ler e só fecha quando o
 * primeiro código bate — sem isso o segredo fica pendente e a ação continua
 * bloqueada.
 */
export function TotpEnrollmentDialog({ open, onCancel, onEnrolled }: TotpEnrollmentDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('totpEnrollment.description')}
            onClose={onCancel}
            open={open}
            size="medium"
            title={t('totpEnrollment.title')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {t('totpEnrollment.submit')}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto aberto: cada abertura pede um segredo novo ao
                backend — reabrir nunca mostra um QR de uma tentativa anterior. */}
            <TotpEnrollmentForm onEnrolled={onEnrolled} onSubmittingChange={setSubmitting} />
        </Modal>
    );
}

function TotpEnrollmentForm({
    onEnrolled,
    onSubmittingChange,
}: {
    onEnrolled: () => void;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [start, setStart] = useState<TotpEnrollmentStart>();
    const [loadError, setLoadError] = useState<string>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        let cancelled = false;
        api<TotpEnrollmentStart>('/admin-auth/totp/enroll', { method: 'POST' })
            .then((result) => {
                if (!cancelled) setStart(result);
            })
            .catch((err: unknown) => {
                if (!cancelled) setLoadError(err instanceof Error ? err.message : t('totpEnrollment.loadError'));
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        onSubmittingChange(true);
        setError(undefined);
        try {
            await api('/admin-auth/totp/confirm', {
                method: 'POST',
                body: JSON.stringify({ code: String(data.get('code') ?? '') }),
            });
            markTotpEnrolled();
            onEnrolled();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('totpEnrollment.error'));
        } finally {
            onSubmittingChange(false);
        }
    }

    if (loadError) {
        return (
            <Alert tone="danger">
                <p>{loadError}</p>
            </Alert>
        );
    }

    return (
        <form className="grid gap-5" id={FORM_ID} onSubmit={handleSubmit}>
            <ol className="grid gap-2 text-sm text-muted dark:text-night-muted">
                <li>1. {t('totpEnrollment.steps.install')}</li>
                <li>2. {t('totpEnrollment.steps.scan')}</li>
                <li>3. {t('totpEnrollment.steps.confirm')}</li>
            </ol>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4 dark:border-night-line dark:bg-night-raised">
                {start ? (
                    <QRCodeSVG
                        aria-label={t('totpEnrollment.qrAria')}
                        className="rounded-lg bg-white p-2"
                        level="M"
                        role="img"
                        size={200}
                        value={start.otpauthUri}
                    />
                ) : (
                    <div
                        aria-busy="true"
                        aria-label={t('totpEnrollment.loading')}
                        className="h-[216px] w-[216px] animate-pulse rounded-lg bg-warm-100 dark:bg-night-surface"
                        role="status"
                    />
                )}
                <p className="text-center text-xs text-muted dark:text-night-subtle">
                    {t('totpEnrollment.manualHint')}
                </p>
                <code
                    className="max-w-full break-all rounded-lg bg-warm-100 px-3 py-2 text-center font-mono text-xs tracking-[0.15em] text-ink dark:bg-night-surface dark:text-night-text"
                    data-testid="totp-secret"
                >
                    {start ? start.secret.replace(/(.{4})/g, '$1 ').trim() : '…'}
                </code>
            </div>

            <Input
                autoComplete="one-time-code"
                className="font-mono tracking-[0.3em]"
                disabled={!start}
                hint={t('totpEnrollment.codeHint')}
                inputMode="numeric"
                label={t('totpEnrollment.codeLabel')}
                maxLength={6}
                minLength={6}
                name="code"
                pattern="\d{6}"
                placeholder="000000"
                required
            />

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
