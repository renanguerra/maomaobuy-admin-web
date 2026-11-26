'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface RouteTab {
    href: string;
    label: string;
}

/**
 * Abas que são endereços: um item só no menu com vários assuntos, cada um
 * no endereço que já tinha (link antigo abre a aba certa). Frete e Pacotes.
 */
export function RouteTabs({ label, tabs }: { label: string; tabs: readonly RouteTab[] }) {
    const pathname = usePathname();

    return (
        <nav aria-label={label} className="mm-scroll-x flex gap-6 border-b border-line dark:border-night-line">
            {tabs.map((tab) => {
                const active = pathname === tab.href;
                return (
                    <Link
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex min-h-11 shrink-0 items-center border-b-2 text-sm font-semibold whitespace-nowrap no-underline transition ${
                            active
                                ? 'border-brand-700 text-ink dark:border-night-accent dark:text-night-text'
                                : 'border-transparent text-muted hover:text-ink dark:text-night-muted dark:hover:text-night-text'
                        }`}
                        href={tab.href}
                        key={tab.href}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
