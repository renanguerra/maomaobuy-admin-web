'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { AdminSetting } from '@/types/api';

const FORM_ID = 'setting-form';

interface SettingFormDialogProps {
    open: boolean;
    setting?: AdminSetting;
    onClose: () => void;
    onSubmit: (value: string) => Promise<void>;
}

/**
 * Edita só o valor — chave e tipo vêm do que já está gravado, nunca de algo
 * que o admin escolhe aqui. Ver `AdminSettingsService.update` no backend.
 */
export function SettingFormDialog({ open, setting, onClose, onSubmit }: SettingFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={setting?.description ?? undefined}
            onClose={onClose}
            open={open}
            title={setting ? t('settings.editTitle', { key: setting.key }) : ''}
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
            {/* Montado só enquanto aberto, pra sempre partir do valor atual da
                configuração selecionada, nunca de uma edição anterior. */}
            {setting && <SettingForm setting={setting} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />}
        </Modal>
    );
}

function SettingForm({
    setting,
    onSubmit,
    onSubmittingChange,
}: {
    setting: AdminSetting;
    onSubmit: (value: string) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [value, setValue] = useState(setting.value);
    const [error, setError] = useState<string>();
    const isDecimal = setting.type === 'DECIMAL';

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit(value.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : t('settings.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={handleSubmit}>
            <Input className="font-mono" disabled label={t('settings.columns.key')} value={setting.key} />
            <Input
                hint={isDecimal ? t('settings.decimalHint') : t('settings.integerHint')}
                inputMode={isDecimal ? 'decimal' : 'numeric'}
                label={t('settings.columns.value')}
                onChange={(event) => setValue(event.target.value)}
                pattern={isDecimal ? '\\d+(\\.\\d{1,8})?' : '\\d+'}
                required
                value={value}
            />

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
