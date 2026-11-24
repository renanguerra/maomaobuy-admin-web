'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n/LanguageProvider';

const TABS = [
    { key: 'shippingTable', href: '/admin/frete' },
    { key: 'shippingBoxes', href: '/admin/embalagens' },
    { key: 'carriers', href: '/admin/transportadoras' },
] as const;

/**
 * Frete é uma tela só no menu, com três assuntos. Cada aba mantém o endereço
 * que já tinha, então link antigo abre a aba certa.
 */
export function FreightTabs() {
    const pathname = usePathname();
    const { t } = useTranslation();

    return (
        <nav
            aria-label={t('freightTabs.label')}
            className="mm-scroll-x flex gap-6 border-b border-line dark:border-night-line"
        >
            {TABS.map((tab) => {
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
                        key={tab.key}
                    >
                        {t(`freightTabs.${tab.key}`)}
                    </Link>
                );
            })}
        </nav>
    );
}
