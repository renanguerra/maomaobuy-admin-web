'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';

export function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { isReady, admin } = useAdminAccountAuth();

    useEffect(() => {
        if (isReady && !admin) {
            router.replace('/login');
        }
    }, [admin, isReady, router]);

    if (!isReady || !admin) {
        return (
            <main className="grid min-h-screen place-items-center px-4" aria-live="polite" aria-busy="true">
                <div className="flex items-center gap-3 text-sm font-semibold text-muted dark:text-night-muted">
                    <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
                    Verificando sessão administrativa...
                </div>
            </main>
        );
    }

    return children;
}
