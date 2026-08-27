'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';

const FORM_ID = 'variant-form';

export interface VariantFormValues {
    externalId: string;
    label: string;
    amountAdjustmentMinor: string;
    isAvailable: boolean;
}

interface VariantFormDialogProps {
    open: boolean;
    /** Ausente ao criar; preenchido ao editar. */
    initialValues?: VariantFormValues;
    onClose: () => void;
    onSubmit: (values: VariantFormValues) => Promise<void> | void;
}

const EMPTY: VariantFormValues = { externalId: '', label: '', amountAdjustmentMinor: '0', isAvailable: true };

/**
 * Cadastro de variação (tamanho, cor). Ficava numa linha de formulário com
 * cinco colunas espremidas dentro da lista; num diálogo cada campo cabe com
 * rótulo e dica próprios.
 */
export function VariantFormDialog({ open, initialValues, onClose, onSubmit }: VariantFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('products.detail.variants.description')}
            onClose={onClose}
            open={open}
            title={initialValues ? t('products.detail.variants.editTitle') : t('products.detail.variants.addTitle')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {initialValues ? t('common.actions.save') : t('common.actions.add')}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto aberto: os campos partem sempre da variação
                escolhida agora, nunca da que foi editada antes. */}
            <VariantForm
                initialValues={initialValues ?? EMPTY}
                onSubmit={onSubmit}
                onSubmittingChange={setSubmitting}
            />
        </Modal>
    );
}

function VariantForm({
    initialValues,
    onSubmit,
    onSubmittingChange,
}: {
    initialValues: VariantFormValues;
    onSubmit: (values: VariantFormValues) => Promise<void> | void;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [values, setValues] = useState<VariantFormValues>(initialValues);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit(values);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.errors.generic'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                label={t('products.detail.variants.label')}
                onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))}
                placeholder={t('products.detail.variants.labelPlaceholder')}
                required
                value={values.label}
            />
            <Input
                hint={t('products.detail.variants.externalIdHint')}
                label={t('products.detail.variants.externalId')}
                onChange={(event) => setValues((current) => ({ ...current, externalId: event.target.value }))}
                placeholder={t('products.detail.variants.externalIdPlaceholder')}
                required
                value={values.externalId}
            />
            <CurrencyInput
                currency="BRL"
                hint={t('products.detail.variants.adjustmentHint')}
                label={t('products.detail.variants.adjustment')}
                minor={values.amountAdjustmentMinor}
                onMinorChange={(minor) => setValues((current) => ({ ...current, amountAdjustmentMinor: minor }))}
            />
            <Checkbox
                boxed
                checked={values.isAvailable}
                description={t('products.detail.variants.availableHint')}
                label={t('products.detail.variants.available')}
                onChange={(event) => setValues((current) => ({ ...current, isAvailable: event.target.checked }))}
            />

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
