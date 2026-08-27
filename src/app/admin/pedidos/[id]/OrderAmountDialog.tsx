'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { money } from '@/types/api';

const FORM_ID = 'order-amount-form';

export interface OrderAmountDialogValues {
    totpCode: string;
    reason: string;
    newAmountMinor: string;
}

interface OrderAmountDialogProps {
    open: boolean;
    title: string;
    description: string;
    fieldLabel: string;
    fieldName: string;
    currentAmountMinor: string;
    confirmLabel: string;
    /**
     * TOTP temporariamente não exigido em nenhuma rota admin (ver AGENTS.md
     * do backend) — default `false`. Prop mantida para religar quando a
     * exigência voltar (mesmo padrão do `ActionDialog`).
     */
    requireTotp?: boolean;
    /**
     * Motivo também não é exigido por padrão (mudar preço/frete não está na
     * lista de ações que precisam de motivo — ver AGENTS.md do backend).
     */
    requireReason?: boolean;
    onCancel: () => void;
    onConfirm: (values: OrderAmountDialogValues) => Promise<void>;
}

/**
 * Diálogo para alterar um valor em BRL do pedido (preço total ou frete
 * estimado): usa `CurrencyInput` em vez de campo de texto livre, para não
 * reintroduzir parsing manual de valor em reais, e mostra o valor atual ao
 * lado para o admin comparar antes de confirmar.
 */
export function OrderAmountDialog({
    open,
    title,
    description,
    fieldLabel,
    fieldName,
    currentAmountMinor,
    confirmLabel,
    requireTotp = false,
    requireReason = false,
    onCancel,
    onConfirm,
}: OrderAmountDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={description}
            onClose={onCancel}
            open={open}
            title={title}
            footer={
                <>
                    <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto o diálogo está aberto: cada abertura parte do
                valor atual do pedido, e não do rascunho da tentativa anterior. */}
            <OrderAmountForm
                currentAmountMinor={currentAmountMinor}
                fieldLabel={fieldLabel}
                fieldName={fieldName}
                onConfirm={onConfirm}
                onSubmittingChange={setSubmitting}
                requireReason={requireReason}
                requireTotp={requireTotp}
            />
        </Modal>
    );
}

function OrderAmountForm({
    fieldLabel,
    fieldName,
    currentAmountMinor,
    requireTotp,
    requireReason,
    onConfirm,
    onSubmittingChange,
}: {
    fieldLabel: string;
    fieldName: string;
    currentAmountMinor: string;
    requireTotp: boolean;
    requireReason: boolean;
    onConfirm: (values: OrderAmountDialogValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [minor, setMinor] = useState(currentAmountMinor);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onConfirm({
                totpCode: String(data.get('totpCode') ?? ''),
                reason: String(data.get('reason') ?? ''),
                newAmountMinor: String(data.get(fieldName) ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('actionDialog.error'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={handleSubmit}>
            <CurrencyInput
                currency="BRL"
                hint={t('orders.amountDialog.currentValue', { amount: money(currentAmountMinor) })}
                label={fieldLabel}
                minor={minor}
                name={fieldName}
                onMinorChange={setMinor}
                required
            />

            {requireTotp && (
                <Input
                    autoComplete="one-time-code"
                    className="font-mono tracking-[0.3em]"
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
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
