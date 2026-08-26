'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, ClipboardList, LoaderCircle, LogOut, Package, ShieldCheck, Tags, UserRound, Users, Wallet } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTranslation } from '@/i18n/LanguageProvider';
import { logoutAdminAccount, useAdminAccountAuth } from '@/services/auth/admin-account-auth';

const menuGroups = [
    {
        key: 'operations',
        items: [{ key: 'users', href: '/admin/usuarios', icon: Users }],
    },
    {
        key: 'catalog',
        items: [
            { key: 'products', href: '/admin/produtos', icon: Package },
            { key: 'categories', href: '/admin/categorias', icon: Tags },
        ],
    },
    {
        key: 'logistics',
        items: [
            { key: 'orders', href: '/admin/pedidos', icon: ClipboardList },
            { key: 'packages', href: '/admin/pacotes', icon: Boxes },
        ],
    },
    {
        key: 'finance',
        items: [{ key: 'finance', href: '/admin/financeiro', icon: Wallet }],
    },
    {
        key: 'system',
        items: [{ key: 'admins', href: '/admin/admins', icon: ShieldCheck }],
    },
] as const;

export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function logout() {
        setIsLoggingOut(true);
        try {
            await logoutAdminAccount();
            router.replace('/login');
            router.refresh();
        } finally {
            setIsLoggingOut(false);
        }
    }

    return (
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between bg-brand-700 px-5 py-6 dark:bg-night-deep max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:flex-row max-[900px]:items-center max-[900px]:gap-4 max-[900px]:px-4 max-[900px]:py-3">
            <div className="min-w-0 max-[900px]:flex max-[900px]:min-w-0 max-[900px]:flex-1 max-[900px]:items-center max-[900px]:gap-4">
                <div className="flex items-center gap-3 border-b border-white/15 pb-6 max-[900px]:border-b-0 max-[900px]:pb-0">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white p-1.5 shadow-sm">
                        <Image src="/brand/logo-kit/svg/maomaobuy-symbol.svg" alt="MaoMaoBuy" width={40} height={40} className="h-full w-full" priority />
                    </span>
                    <div className="min-w-0 max-[900px]:hidden">
                        <strong className="block truncate text-sm text-white">{t('sidebar.brandName')}</strong>
                        <span className="mt-0.5 block truncate text-xs text-white/70">{t('sidebar.brandTagline')}</span>
                    </div>
                </div>

                <nav className="mt-6 grid gap-6 max-[900px]:mt-0 max-[900px]:flex max-[900px]:min-w-0 max-[900px]:flex-1 max-[900px]:gap-2 max-[900px]:overflow-x-auto" aria-label={t('sidebar.areasLabel')}>
                    {menuGroups.map((group) => (
                        <section className="max-[900px]:contents" key={group.key}>
                            <h2 className="mb-2 text-[0.65rem] font-bold tracking-[.1em] text-white/50 uppercase max-[900px]:sr-only">
                                {t(`sidebar.groups.${group.key}`)}
                            </h2>
                            <ul className="m-0 grid list-none gap-1 p-0 max-[900px]:flex max-[900px]:shrink-0 max-[900px]:gap-2">
                                {group.items.map((item) => {
                                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                    const Icon = item.icon;
                                    return (
                                        <li className="shrink-0" key={item.href}>
                                            <Link
                                                className={`flex min-h-10 items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-semibold whitespace-nowrap no-underline transition ${
                                                    active
                                                        ? 'border-origin-400 bg-white/12 text-white'
                                                        : 'border-transparent text-white/70 hover:bg-white/8 hover:text-white'
                                                }`}
                                                href={item.href}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                {t(`sidebar.items.${item.key}`)}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </nav>
            </div>

            <div className="border-t border-white/15 pt-5 max-[900px]:flex max-[900px]:shrink-0 max-[900px]:items-center max-[900px]:gap-2 max-[900px]:border-t-0 max-[900px]:pt-0">
                <div className="mb-4 max-[900px]:mb-0">
                    <LanguageSwitcher variant="inverted" className="w-full max-[900px]:w-auto" />
                </div>

                <div className="flex items-center gap-3 px-1 max-[900px]:hidden">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <strong className="block truncate text-sm text-white">{admin?.name ?? t('sidebar.accountFallback')}</strong>
                        <span className="block truncate text-xs text-white/60">{admin?.email ?? t('common.dash')}</span>
                    </div>
                </div>

                <button
                    className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-white/70 hover:text-white max-[900px]:mt-0 max-[900px]:w-auto max-[900px]:px-2"
                    type="button"
                    onClick={logout}
                    disabled={isLoggingOut}
                    aria-busy={isLoggingOut}
                >
                    {isLoggingOut ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="max-[900px]:sr-only">{isLoggingOut ? t('sidebar.signingOut') : t('sidebar.signOut')}</span>
                </button>
            </div>
        </aside>
    );
}
