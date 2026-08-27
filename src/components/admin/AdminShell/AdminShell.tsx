'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { useTranslation } from '@/i18n/LanguageProvider';

/**
 * Moldura do painel: barra lateral fixa no desktop e gaveta no celular, com
 * a área de conteúdo centralizada e limitada em largura — linha de tabela
 * larguíssima em monitor grande é ilegível.
 */
export function AdminShell({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        if (!drawerOpen) return;
        document.body.dataset.dialogOpen = 'true';
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setDrawerOpen(false);
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            delete document.body.dataset.dialogOpen;
        };
    }, [drawerOpen]);

    return (
        <div className="flex min-h-screen w-full">
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
                <AdminSidebar />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden dark:border-night-line dark:bg-night-surface/95">
                    <button
                        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-ink transition hover:border-brand-300 dark:border-night-line dark:bg-night-raised dark:text-night-text"
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        aria-expanded={drawerOpen}
                        aria-label={t('shell.openMenu')}
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="flex min-w-0 items-center gap-2">
                        <Image
                            alt=""
                            className="h-7 w-7"
                            height={28}
                            src="/brand/logo-kit/svg/maomaobuy-symbol.svg"
                            width={28}
                        />
                        <strong className="mm-display truncate text-sm">{t('sidebar.brandTagline')}</strong>
                    </span>
                </header>

                <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
                    <div className="mx-auto w-full max-w-[84rem]">{children}</div>
                </main>
            </div>

            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        className="absolute inset-0 h-full w-full cursor-default bg-warm-950/50 dark:bg-black/65"
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        aria-label={t('shell.closeMenu')}
                    />
                    <div className="relative h-full w-[17rem] max-w-[85vw] shadow-2xl">
                        <button
                            className="absolute top-3.5 right-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-white/70 transition hover:bg-white/12 hover:text-white"
                            type="button"
                            onClick={() => setDrawerOpen(false)}
                            aria-label={t('shell.closeMenu')}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}
