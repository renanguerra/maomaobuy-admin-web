'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { ApprovalDialogProps } from './ApprovalDialog.types';

/**
 * Formulário único usado por toda ação sensível do painel (aprovar, rejeitar,
 * confirmar pagamento manualmente, despachar, suspender, reativar, liberar
 * carteira...) — corpo compatível com `AdminApprovalDto` no backend.
 *
 * TOTP temporariamente não exigido (ver AGENTS.md do backend): o campo e a
 * lógica continuam aqui, só o default de `requireTotp` virou `false`. Motivo
 * segue a mesma ideia: só bloqueio de usuário e rejeição de pedido/pacote
 * passam `requireReason`; o resto vira confirmação simples.
 */
export function ApprovalDialog({
    open,
    title,
    description,
    confirmLabel,
    variant = 'primary',
    fields = [],
    requireTotp = false,
    requireReason = false,
    onCancel,
    onConfirm,
}: ApprovalDialogProps) {
    const { t } = useTranslation();
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
            setError(err instanceof Error ? err.message : t('approvalDialog.error'));
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
                        aria-label={t('approvalDialog.closeAria')}
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
                            {t('approvalDialog.totpLabel')}
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

                    {requireReason && (
                        <label className="grid gap-2 text-sm font-semibold">
                            {t('approvalDialog.reasonLabel')}
                            <textarea
                                className="min-h-24 rounded-md border border-line bg-surface px-3 py-2 dark:border-night-line dark:bg-night-canvas"
                                name="reason"
                                placeholder={t('approvalDialog.reasonPlaceholder')}
                                minLength={5}
                                maxLength={2000}
                                required
                            />
                        </label>
                    )}

                    {error && <p className="text-sm text-secondary">{error}</p>}

                    <div className="mt-2 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
                            {t('approvalDialog.cancel')}
                        </Button>
                        <Button type="submit" variant={variant === 'danger' ? 'danger' : 'primary'} loading={submitting}>
                            {confirmLabel ?? t('approvalDialog.confirmLabel')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
