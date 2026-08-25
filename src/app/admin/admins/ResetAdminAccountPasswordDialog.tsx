'use client';

import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ResetAdminAccountPasswordDialogProps {
    open: boolean;
    adminName?: string;
    onCancel: () => void;
    onConfirm: (password: string) => Promise<void>;
}

export function ResetAdminAccountPasswordDialog({ open, adminName, onCancel, onConfirm }: ResetAdminAccountPasswordDialogProps) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    if (!open) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get('password') ?? '');
        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm(password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 dark:bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-admin-password-title"
        >
            <div className="mm-panel w-full max-w-md p-6">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="m-0 text-lg" id="reset-admin-password-title">
                        Redefinir senha{adminName ? ` de ${adminName}` : ''}
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
                <p className="mt-2 text-sm text-muted dark:text-night-muted">
                    As sessões ativas desse admin serão encerradas.
                </p>

                <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
                    <Input
                        label="Nova senha"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        hint="Mínimo 8 caracteres, com uma maiúscula, um número e um símbolo."
                        required
                    />

                    {error && <p className="text-sm text-secondary">{error}</p>}

                    <div className="mt-2 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="danger" loading={submitting}>
                            Redefinir senha
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
