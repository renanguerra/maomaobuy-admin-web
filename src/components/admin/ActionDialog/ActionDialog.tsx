'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { ActionDialogField, ActionDialogProps } from './ActionDialog.types';

const FORM_ID = 'action-dialog-form';

/**
 * Formulário único de toda ação sensível do painel (aprovar, rejeitar,
 * confirmar pagamento, despachar, suspender, reativar...) — o corpo enviado é
 * compatível com o `AdminApprovalDto` do backend.
 *
 * Concentrar as ações aqui mantém três coisas iguais em todas elas: o motivo
 * fica sempre no mesmo lugar, o erro do backend aparece dentro do diálogo (e
 * não numa faixa perdida na página) e o botão principal trava enquanto envia.
 */
export function ActionDialog({
    open,
    title,
    description,
    confirmLabel,
    variant = 'primary',
    fields = [],
    requireTotp = true,
    requireReason = false,
    onCancel,
    onConfirm,
}: ActionDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const hasGrid = fields.length > 1;

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={description}
            onClose={onCancel}
            open={open}
            size={hasGrid ? 'medium' : 'small'}
            title={title}
            footer={
                <>
                    <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button
                        form={FORM_ID}
                        loading={submitting}
                        type="submit"
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                    >
                        {confirmLabel ?? t('common.actions.confirm')}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto o diálogo está aberto: reabrir a mesma ação
                nunca herda o erro nem o valor da tentativa anterior. */}
            <ActionDialogForm
                fields={fields}
                onConfirm={onConfirm}
                onSubmittingChange={setSubmitting}
                requireReason={requireReason}
                requireTotp={requireTotp}
            />
        </Modal>
    );
}

function ActionDialogForm({
    fields,
    requireTotp,
    requireReason,
    onConfirm,
    onSubmittingChange,
}: {
    fields: readonly ActionDialogField[];
    requireTotp: boolean;
    requireReason: boolean;
    onConfirm: ActionDialogProps['onConfirm'];
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [error, setError] = useState<string>();
    const [amounts, setAmounts] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            fields.filter((field) => field.kind === 'currency').map((field) => [field.name, field.defaultValue ?? '0']),
        ),
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values: Record<string, string> = {};
        for (const field of fields) values[field.name] = String(data.get(field.name) ?? '');

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onConfirm({
                totpCode: String(data.get('totpCode') ?? ''),
                reason: String(data.get('reason') ?? ''),
                ...values,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('actionDialog.error'));
        } finally {
            onSubmittingChange(false);
        }
    }

    const hasGrid = fields.length > 1;
    const wideClassName = hasGrid ? 'sm:col-span-2' : '';

    return (
        <form className={`grid gap-4 ${hasGrid ? 'sm:grid-cols-2' : ''}`} id={FORM_ID} onSubmit={handleSubmit}>
            {fields.map((field) => (
                <ActionField
                    amount={amounts[field.name] ?? '0'}
                    field={field}
                    key={field.name}
                    onAmountChange={(minor) => setAmounts((current) => ({ ...current, [field.name]: minor }))}
                />
            ))}

            {requireTotp && (
                <Input
                    autoComplete="one-time-code"
                    className="font-mono tracking-[0.3em]"
                    fieldClassName={wideClassName}
                    inputMode="numeric"
                    label={t('common.fields.totpCode')}
                    maxLength={6}
                    minLength={6}
                    name="totpCode"
                    pattern="\d{6}"
                    placeholder="000000"
                    required
                />
            )}

            {requireReason && (
                <Textarea
                    fieldClassName={wideClassName}
                    hint={t('common.fields.reasonHint')}
                    label={t('common.fields.reason')}
                    maxLength={2000}
                    minLength={5}
                    name="reason"
                    placeholder={t('common.fields.reasonPlaceholder')}
                    required
                />
            )}

            {error && (
                <Alert className={wideClassName} tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}

function ActionField({
    field,
    amount,
    onAmountChange,
}: {
    field: ActionDialogField;
    amount: string;
    onAmountChange: (minor: string) => void;
}) {
    const fieldClassName = field.wide || field.kind === 'textarea' ? 'sm:col-span-2' : '';
    const required = !field.optional;

    if (field.kind === 'textarea') {
        return (
            <Textarea
                defaultValue={field.defaultValue}
                fieldClassName={fieldClassName}
                hint={field.hint}
                label={field.label}
                maxLength={field.maxLength}
                minLength={field.minLength}
                name={field.name}
                placeholder={field.placeholder}
                required={required}
            />
        );
    }

    if (field.kind === 'select') {
        return (
            <Select
                defaultValue={field.defaultValue}
                fieldClassName={fieldClassName}
                hint={field.hint}
                label={field.label}
                name={field.name}
                options={field.options ?? []}
                required={required}
            />
        );
    }

    if (field.kind === 'currency') {
        return (
            <CurrencyInput
                currency={field.suffix}
                fieldClassName={fieldClassName}
                hint={field.hint}
                label={field.label}
                minor={amount}
                name={field.name}
                onMinorChange={onAmountChange}
                required={required}
            />
        );
    }

    return (
        <Input
            defaultValue={field.defaultValue}
            fieldClassName={fieldClassName}
            hint={field.hint}
            inputMode={field.inputMode}
            label={field.label}
            max={field.max}
            maxLength={field.maxLength}
            min={field.min}
            minLength={field.minLength}
            name={field.name}
            pattern={field.pattern}
            placeholder={field.placeholder}
            required={required}
            suffix={field.suffix}
            type={field.kind === 'number' ? 'number' : 'text'}
        />
    );
}
