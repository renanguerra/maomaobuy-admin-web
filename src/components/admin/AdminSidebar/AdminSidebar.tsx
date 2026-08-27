'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LoaderCircle, LogOut } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTranslation } from '@/i18n/LanguageProvider';
import { clearPendingCounts, usePendingCounts } from '@/services/admin/pending-counts';
import { logoutAdminAccount, useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { MenuItem } from './AdminSidebar.types';
import { MENU_GROUPS, initials, isMenuItemActive } from './menu';

export interface AdminSidebarProps {
    /** Chamado ao navegar — fecha a gaveta no celular. */
    onNavigate?: () => void;
}

/**
 * Navegação do painel. O mesmo componente serve à barra fixa do desktop e à
 * gaveta do celular, então o estado de "onde estou" nunca diverge entre os
 * dois tamanhos de tela.
 */
export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const { counts } = usePendingCounts();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function logout() {
        setIsLoggingOut(true);
        try {
            await logoutAdminAccount();
            clearPendingCounts();
            router.replace('/login');
            router.refresh();
        } finally {
            setIsLoggingOut(false);
        }
    }

    const name = admin?.name ?? t('sidebar.accountFallback');

    return (
        <div className="flex h-full min-h-0 flex-col bg-brand-800 text-white dark:bg-night-deep">
            <div className="flex items-center gap-3 px-4 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white p-1.5 shadow-sm">
                    <Image
                        alt="MaoMaoBuy"
                        className="h-full w-full"
                        height={40}
                        priority
                        src="/brand/logo-kit/svg/maomaobuy-symbol.svg"
                        width={40}
                    />
                </span>
                <div className="min-w-0">
                    <strong className="block truncate text-sm">{t('sidebar.brandName')}</strong>
                    <span className="mt-0.5 block truncate text-xs text-white/60">{t('sidebar.brandTagline')}</span>
                </div>
            </div>

            <nav
                className="mm-scroll-x min-h-0 flex-1 overflow-y-auto px-2.5 pb-3"
                aria-label={t('sidebar.areasLabel')}
            >
                {MENU_GROUPS.map((group, index) => (
                    <section className="mb-4 last:mb-0" key={group.key ?? `group-${index}`}>
                        {group.key && (
                            <h2 className="mt-3 mb-1.5 px-2.5 text-[0.65rem] font-bold tracking-[.12em] text-white/40 uppercase">
                                {t(`sidebar.groups.${group.key}`)}
                            </h2>
                        )}
                        <ul className="m-0 grid list-none gap-0.5 p-0">
                            {group.items.map((item) => (
                                <MenuLink
                                    active={isMenuItemActive(item.href, pathname)}
                                    count={item.badge ? (counts?.[item.badge] ?? 0) : 0}
                                    item={item}
                                    key={item.href}
                                    label={t(`sidebar.items.${item.key}`)}
                                    pendingLabel={t('sidebar.pendingAria')}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </ul>
                    </section>
                ))}
            </nav>

            <div className="shrink-0 border-t border-white/12 p-2.5">
                <div className="flex items-center gap-2.5 px-1.5 py-2">
                    <span
                        className="mm-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold"
                        aria-hidden="true"
                    >
                        {initials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{name}</strong>
                        <span className="block truncate text-xs text-white/55">{admin?.email ?? t('common.dash')}</span>
                    </div>
                </div>

                <div className="mt-1 flex items-center gap-2">
                    <ThemeToggle variant="inverted" />
                    <LanguageSwitcher className="min-w-0 flex-1" variant="inverted" />
                    <button
                        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/20 bg-white/10 transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={logout}
                        disabled={isLoggingOut}
                        aria-busy={isLoggingOut}
                        title={t('sidebar.signOut')}
                    >
                        {isLoggingOut ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">{isLoggingOut ? t('sidebar.signingOut') : t('sidebar.signOut')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function MenuLink({
    item,
    label,
    active,
    count,
    pendingLabel,
    onNavigate,
}: {
    item: MenuItem;
    label: string;
    active: boolean;
    count: number;
    pendingLabel: string;
    onNavigate?: () => void;
}) {
    const Icon = item.icon;

    return (
        <li>
            <Link
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold no-underline transition ${
                    active ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'
                }`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
            >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden={true} />
                <span className="flex-1 truncate">{label}</span>
                {count > 0 && (
                    <span className="mm-data grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-300 px-1.5 text-[0.65rem] leading-none font-bold text-amber-950">
                        {count}
                        <span className="sr-only"> {pendingLabel}</span>
                    </span>
                )}
            </Link>
        </li>
    );
}
