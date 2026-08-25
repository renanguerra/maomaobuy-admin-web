'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

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
    onCancel: () => void;
    onConfirm: (values: OrderAmountDialogValues) => Promise<void>;
}

/**
 * Diálogo genérico para alterar um valor em BRL do pedido (preço total ou
 * frete estimado): usa `CurrencyInput` em vez do campo de texto livre do
 * `ApprovalDialog`, para não reintroduzir parsing manual de valor em reais.
 */
export function OrderAmountDialog({
    open,
    title,
    description,
    fieldLabel,
    fieldName,
    currentAmountMinor,
    confirmLabel,
    onCancel,
    onConfirm,
}: OrderAmountDialogProps) {
    const [minor, setMinor] = useState(currentAmountMinor);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    if (!open) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const totpCode = String(data.get('totpCode') ?? '');
        const reason = String(data.get('reason') ?? '');
        const newAmountMinor = String(data.get(fieldName) ?? '');

        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm({ totpCode, reason, newAmountMinor });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 dark:bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-amount-dialog-title"
        >
            <div className="mm-panel w-full max-w-md p-6">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="m-0 text-lg" id="order-amount-dialog-title">
                        {title}
                    </h2>
                    <button
                        className="text-muted hover:text-ink dark:text-night-muted dark:hover:text-night-text"
                        type="button"
                        onClick={onCancel}
                        aria-label="Fechar"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <p className="mt-2 text-sm text-muted dark:text-night-muted">{description}</p>

                <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                    <label className="grid gap-2 text-sm font-semibold">
                        {fieldLabel}
                        <CurrencyInput name={fieldName} minor={minor} onMinorChange={setMinor} required />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold">
                        Código TOTP (6 dígitos)
                        <input
                            className="min-h-11 rounded-md border border-line bg-surface px-3 font-mono tracking-[0.3em] dark:border-night-line dark:bg-night-canvas"
                            name="totpCode"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            minLength={6}
                            placeholder="000000"
                            autoComplete="one-time-code"
                            required
                        />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold">
                        Motivo
                        <textarea
                            className="min-h-24 rounded-md border border-line bg-surface px-3 py-2 dark:border-night-line dark:bg-night-canvas"
                            name="reason"
                            placeholder="Explique o motivo do ajuste"
                            minLength={5}
                            maxLength={2000}
                            required
                        />
                    </label>

                    {error && <p className="text-sm text-secondary">{error}</p>}

                    <div className="mt-2 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" loading={submitting}>
                            {confirmLabel}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
