'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';

interface TotpModalProps {
    open: boolean;
    title: ReactNode;
    description?: ReactNode;
    onClose: () => void;
    /** Recebe o código e faz a chamada; erro vira mensagem no modal. */
    onConfirm: (totpCode: string) => Promise<void>;
}

/**
 * Tudo o que muda na vitrine aparece para todo cliente, então salvar pede o
 * código TOTP, como os avisos do site. Sem cadastro, abre o cadastro antes.
 */
export function TotpModal({ open, title, description, onClose, onConfirm }: TotpModalProps) {
    const { t } = useTranslation();
    const needsEnrollment = useTotpEnrollmentGate(open, true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get('totpCode') ?? '');
        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm(code);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('storefront.saveError'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={description}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form="storefront-totp" loading={submitting} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
            onClose={onClose}
            open={open}
            title={title}
        >
            {open && (
                <form className="grid gap-4" id="storefront-totp" onSubmit={handleSubmit}>
                    <Input
                        autoComplete="one-time-code"
                        autoFocus
                        inputMode="numeric"
                        label={t('common.fields.totpCode')}
                        maxLength={6}
                        name="totpCode"
                        pattern="\d{6}"
                        required
                    />
                    {error && (
                        <Alert tone="danger">
                            <p>{error}</p>
                        </Alert>
                    )}
                </form>
            )}
        </Modal>
    );
}
