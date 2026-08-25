'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ApprovalDialogProps } from './ApprovalDialog.types';

/**
 * Toda ação sensível do painel (aprovar, rejeitar, confirmar pagamento
 * manualmente, despachar, suspender, reativar, liberar carteira...) exige um
 * código TOTP de 6 dígitos e um motivo — exatamente o corpo de
 * `AdminApprovalDto` no backend. Este componente é o formulário único usado
 * por todas essas ações.
 */
export function ApprovalDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirmar',
    variant = 'primary',
    fields = [],
    requireTotp = true,
    onCancel,
    onConfirm,
}: ApprovalDialogProps) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    if (!open) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const totpCode = String(data.get('totpCode') ?? '');
        const reason = String(data.get('reason') ?? '');
        const extra: Record<string, string> = {};
        for (const field of fields) extra[field.name] = String(data.get(field.name) ?? '');

        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm({ totpCode, reason, ...extra });
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
            aria-labelledby="approval-dialog-title"
        >
            <div className="mm-panel w-full max-w-md p-6">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="m-0 text-lg" id="approval-dialog-title">
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
                {description && <p className="mt-2 text-sm text-muted dark:text-night-muted">{description}</p>}

                <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                    {fields.map((field) =>
                        field.multiline ? (
                            <label className="grid gap-2 text-sm font-semibold" key={field.name}>
                                {field.label}
                                <textarea
                                    className="min-h-24 rounded-md border border-line bg-surface px-3 py-2 dark:border-night-line dark:bg-night-canvas"
                                    name={field.name}
                                    placeholder={field.placeholder}
                                    minLength={field.minLength}
                                    maxLength={field.maxLength}
                                    required
                                />
                            </label>
                        ) : (
                            <label className="grid gap-2 text-sm font-semibold" key={field.name}>
                                {field.label}
                                <input
                                    className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                    name={field.name}
                                    placeholder={field.placeholder}
                                    minLength={field.minLength}
                                    maxLength={field.maxLength}
                                    pattern={field.pattern}
                                    inputMode={field.inputMode}
                                    required
                                />
                            </label>
                        ),
                    )}

                    {requireTotp && (
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
                    )}

                    <label className="grid gap-2 text-sm font-semibold">
                        Motivo
                        <textarea
                            className="min-h-24 rounded-md border border-line bg-surface px-3 py-2 dark:border-night-line dark:bg-night-canvas"
                            name="reason"
                            placeholder="Explique o motivo desta ação"
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
                        <Button type="submit" variant={variant === 'danger' ? 'danger' : 'primary'} loading={submitting}>
                            {confirmLabel}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
