'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTranslation } from '@/i18n/LanguageProvider';
import { ApiError } from '@/services/api';
import { loginAdminAccount } from '@/services/auth/admin-account-auth';

export function LoginPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        setSubmitting(true);
        setError(undefined);
        try {
            await loginAdminAccount(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
            router.replace('/admin');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('login.genericError'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="relative grid min-h-screen place-items-center bg-warm-100 px-4 py-10 dark:bg-night-canvas">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
            </div>

            <div className="mm-card w-full max-w-md p-7">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-800 p-2 dark:bg-night-deep">
                    <Image
                        alt="MaoMaoBuy"
                        className="h-full w-full"
                        height={40}
                        priority
                        src="/brand/logo-kit/svg/maomaobuy-symbol.svg"
                        width={40}
                    />
                </span>

                <p className="mm-kicker mt-5 mb-3">{t('login.kicker')}</p>
                <h1 className="mm-display m-0 text-2xl">{t('login.title')}</h1>
                <p className="mt-2 mb-0 text-sm leading-relaxed text-muted dark:text-night-muted">
                    {t('login.subtitle')}
                </p>

                <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                    <Input
                        autoComplete="username"
                        autoFocus
                        label={t('login.emailLabel')}
                        name="email"
                        required
                        type="email"
                    />
                    <Input
                        autoComplete="current-password"
                        label={t('login.passwordLabel')}
                        name="password"
                        required
                        type="password"
                    />

                    {error && (
                        <Alert tone="danger">
                            <p>{error}</p>
                        </Alert>
                    )}

                    <Button fullWidth loading={submitting} size="large" type="submit">
                        {submitting ? t('login.submitting') : t('login.submit')}
                    </Button>
                </form>
            </div>
        </main>
    );
}
