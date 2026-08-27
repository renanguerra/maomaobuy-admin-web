'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';

interface ResetAdminAccountPasswordDialogProps {
    open: boolean;
    adminName?: string;
    onCancel: () => void;
    onConfirm: (password: string) => Promise<void>;
}

export function ResetAdminAccountPasswordDialog({
    open,
    adminName,
    onCancel,
    onConfirm,
}: ResetAdminAccountPasswordDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm(String(data.get('password') ?? ''));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admins.resetPassword.error'));
        } finally {
            setSubmitting(false);
        }
    }

    const formId = 'reset-admin-password-form';

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('admins.resetPassword.description')}
            onClose={onCancel}
            open={open}
            title={
                adminName
                    ? t('admins.resetPassword.titleWithName', { name: adminName })
                    : t('admins.resetPassword.title')
            }
            footer={
                <>
                    <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
                        {t('admins.resetPassword.cancel')}
                    </Button>
                    <Button form={formId} loading={submitting} type="submit" variant="danger">
                        {t('admins.resetPassword.submit')}
                    </Button>
                </>
            }
        >
            <form className="grid gap-4" id={formId} onSubmit={handleSubmit}>
                <Input
                    autoComplete="new-password"
                    hint={t('admins.resetPassword.passwordHint')}
                    label={t('admins.resetPassword.newPasswordLabel')}
                    maxLength={128}
                    minLength={8}
                    name="password"
                    required
                    type="password"
                />

                {error && (
                    <Alert tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
