'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { COST_CATEGORIES, type CostCategory, type CostCurrency, type CostPreset } from '@/types/api';

const FORM_ID = 'cost-preset-form';

export function CostPresetDialog({
    open,
    preset,
    onClose,
    onSaved,
}: {
    open: boolean;
    preset?: CostPreset;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            title={preset ? t('profit.presets.editTitle') : t('profit.presets.createTitle')}
            description={t('profit.presets.formDescription')}
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
            {open && <PresetForm onSaved={onSaved} onSubmittingChange={setSubmitting} preset={preset} />}
        </Modal>
    );
}

function PresetForm({
    preset,
    onSaved,
    onSubmittingChange,
}: {
    preset?: CostPreset;
    onSaved: () => void;
    onSubmittingChange: (value: boolean) => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState(preset?.name ?? '');
    const [category, setCategory] = useState<CostCategory>(preset?.category ?? 'PACKAGING');
    const [unitAmountMinor, setUnitAmountMinor] = useState(preset?.unitAmountMinor ?? '0');
    const [currency, setCurrency] = useState<CostCurrency>(preset?.currency ?? 'CNY');
    const [isActive, setIsActive] = useState(preset?.isActive ?? true);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError(undefined);
        if (unitAmountMinor === '0') {
            setError(t('profit.entryForm.amountRequired'));
            return;
        }
        onSubmittingChange(true);
        try {
            await api(preset ? `/costs/presets/${preset.id}` : '/costs/presets', {
                method: preset ? 'PATCH' : 'POST',
                body: JSON.stringify({ name: name.trim(), category, unitAmountMinor, currency, isActive }),
            });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={submit}>
            {error && (
                <Alert tone="danger" title={t('profit.entryForm.errorTitle')}>
                    <p>{error}</p>
                </Alert>
            )}
            <Input
                label={t('profit.presets.name')}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('profit.presets.namePlaceholder')}
                required
                value={name}
            />
            <Select
                label={t('profit.entryForm.category')}
                onChange={(event) => setCategory(event.target.value as CostCategory)}
                options={COST_CATEGORIES.map((value) => ({ value, label: t(`profit.categories.${value}`) }))}
                value={category}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <CurrencyInput
                    currency={currency}
                    label={t('profit.entryForm.unitAmount')}
                    minor={unitAmountMinor}
                    onMinorChange={setUnitAmountMinor}
                    required
                />
                <Select
                    label={t('profit.entryForm.currency')}
                    onChange={(event) => setCurrency(event.target.value as CostCurrency)}
                    options={[
                        { value: 'CNY', label: 'CNY (¥)' },
                        { value: 'BRL', label: 'BRL (R$)' },
                    ]}
                    value={currency}
                />
            </div>
            <Checkbox
                checked={isActive}
                label={t('profit.presets.active')}
                onChange={(event) => setIsActive(event.target.checked)}
            />
        </form>
    );
}
