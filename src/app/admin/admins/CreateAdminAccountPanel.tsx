'use client';

import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/services/api';
import type { AdminAccount } from '@/types/api';

interface CreateAdminAccountPanelProps {
    onCreated: (admin: AdminAccount) => void;
}

export function CreateAdminAccountPanel({ onCreated }: CreateAdminAccountPanelProps) {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get('name') ?? '');
        const email = String(data.get('email') ?? '');
        const password = String(data.get('password') ?? '');

        setSubmitting(true);
        setError(undefined);
        try {
            const admin = await api<AdminAccount>('/admin-accounts', {
                method: 'POST',
                body: JSON.stringify({ name, email, password }),
            });
            onCreated(admin);
            setOpen(false);
            event.currentTarget.reset();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível criar o admin.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="mt-8">
            <div className="flex items-center justify-between">
                <h2 className="m-0 text-xl">Novo admin</h2>
                {!open && (
                    <Button
                        size="small"
                        variant="ghost"
                        onClick={() => setOpen(true)}
                        leadingIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                    >
                        Novo admin
                    </Button>
                )}
            </div>

            {open && (
                <form className="mm-panel-soft mt-4 grid gap-4 p-5" onSubmit={handleSubmit}>
                    <Input label="Nome" name="name" minLength={2} maxLength={120} required />
                    <Input label="E-mail" name="email" type="email" maxLength={320} required />
                    <Input
                        label="Senha"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        hint="Mínimo 8 caracteres, com uma maiúscula, um número e um símbolo."
                        required
                    />

                    {error && <p className="text-sm text-secondary">{error}</p>}

                    <div className="flex justify-end gap-3">
                        <Button size="small" type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button size="small" type="submit" loading={submitting}>
                            Criar admin
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}
