'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { loginAdminAccount } from '@/services/auth/admin-account-auth';

export function LoginPage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const email = String(data.get('email') ?? '');
        const password = String(data.get('password') ?? '');
        setSubmitting(true);
        setError(undefined);
        try {
            await loginAdminAccount(email, password);
            router.replace('/admin');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com essa conta.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="grid min-h-screen place-items-center px-4">
            <div className="mm-panel w-full max-w-md p-8">
                <span className="mm-mascot-stage mb-6 grid h-14 w-14 place-items-center">
                    <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                </span>
                <p className="mm-kicker mb-3">Acesso restrito</p>
                <h1 className="m-0 text-2xl">MaoMaoBuy Admin</h1>
                <p className="mt-3 text-sm text-muted dark:text-night-muted">
                    Entre com o e-mail e a senha da sua conta administrativa para acessar o painel.
                </p>

                <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
                    <Input label="E-mail" name="email" type="email" autoComplete="username" required />
                    <Input label="Senha" name="password" type="password" autoComplete="current-password" required />
                    {error && <p className="text-sm text-secondary">{error}</p>}
                    <Button type="submit" fullWidth loading={submitting}>
                        {submitting ? 'Entrando…' : 'Entrar'}
                    </Button>
                </form>
            </div>
        </main>
    );
}
