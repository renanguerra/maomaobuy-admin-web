'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminAccount } from '@/types/api';

interface CreateAdminAccountDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated: (admin: AdminAccount) => void;
}

export function CreateAdminAccountDialog({ open, onClose, onCreated }: CreateAdminAccountDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);

        setSubmitting(true);
        setError(undefined);
        try {
            const admin = await api<AdminAccount>('/admin-accounts', {
                method: 'POST',
                body: JSON.stringify({
                    name: String(data.get('name') ?? ''),
                    email: String(data.get('email') ?? ''),
                    password: String(data.get('password') ?? ''),
                }),
            });
            form.reset();
            onCreated(admin);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('admins.create.error'));
        } finally {
            setSubmitting(false);
        }
    }

    const formId = 'create-admin-form';

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('admins.create.description')}
            onClose={onClose}
            open={open}
            title={t('admins.create.title')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('admins.create.cancel')}
                    </Button>
                    <Button form={formId} loading={submitting} type="submit">
                        {t('admins.create.submit')}
                    </Button>
                </>
            }
        >
            <form className="grid gap-4" id={formId} onSubmit={handleSubmit}>
                <Input label={t('admins.create.nameLabel')} maxLength={120} minLength={2} name="name" required />
                <Input label={t('admins.create.emailLabel')} maxLength={320} name="email" required type="email" />
                <Input
                    autoComplete="new-password"
                    hint={t('admins.create.passwordHint')}
                    label={t('admins.create.passwordLabel')}
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
