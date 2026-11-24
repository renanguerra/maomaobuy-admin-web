'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, LoaderCircle, LogOut, Pin, PinOff, Search } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTranslation } from '@/i18n/LanguageProvider';
import {
    clearRecentEntries,
    getWorkHref,
    MAX_PINS,
    rememberWorkHref,
    usePinnedItems,
} from '@/services/admin/panel-prefs';
import { clearPendingCounts, usePendingCounts, type MenuBadgeCount } from '@/services/admin/pending-counts';
import { logoutAdminAccount, useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { MenuArea, MenuAreaKey, MenuItem } from './AdminSidebar.types';
import { areaOfPath, homeHref, initials, isMenuItemActive, visibleAreas } from './menu';

export interface AdminSidebarProps {
    /** Chamado ao navegar — fecha a gaveta no celular. */
    onNavigate?: () => void;
    /** Abre a busca geral (a mesma do Ctrl+K). */
    onSearch: () => void;
}

/**
 * Navegação do painel. O mesmo componente serve à barra fixa do desktop e à
 * gaveta do celular, então o estado de "onde estou" nunca diverge entre os
 * dois tamanhos de tela.
 *
 * As áreas ficam sempre à vista e abrem no lugar; a da tela atual já vem
 * aberta. Ajustes troca a barra inteira, porque se entra lá de vez em quando
 * e fica um tempo.
 */
export function AdminSidebar({ onNavigate, onSearch }: AdminSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const { counts } = usePendingCounts();
    const { pins, toggle } = usePinnedItems(admin?.id);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const currentArea = areaOfPath(pathname);
    const inSettings = currentArea === 'settings';
    // Abrir ou fechar uma área à mão vale até a próxima troca de área.
    const [manual, setManual] = useState<{ area: MenuAreaKey; open: Partial<Record<MenuAreaKey, boolean>> }>({
        area: currentArea,
        open: {},
    });
    const manualOpen = manual.area === currentArea ? manual.open : {};

    useEffect(() => {
        if (!inSettings) rememberWorkHref(`${pathname}${window.location.search}`);
    }, [inSettings, pathname]);

    async function logout() {
        setIsLoggingOut(true);
        try {
            clearRecentEntries(admin?.id);
            await logoutAdminAccount();
            clearPendingCounts();
            router.replace('/login');
            router.refresh();
        } finally {
            setIsLoggingOut(false);
        }
    }

    const name = admin?.name ?? t('sidebar.accountFallback');
    const home = homeHref(admin?.role);
    const areas = visibleAreas(admin?.role);
    const workAreas = areas.filter((area) => area.key !== 'settings');
    const settingsArea = areas.find((area) => area.key === 'settings');
    const pinnedItems = pins.flatMap((pin) => {
        const item = areas.flatMap((area) => area.items).find((candidate) => candidate.key === pin);
        return item ? [item] : [];
    });

    function badgeOf(item: MenuItem): MenuBadgeCount {
        return (item.badge && counts?.[item.badge]) || { count: 0, overdue: 0 };
    }

    function areaBadge(area: MenuArea): MenuBadgeCount {
        return area.items.reduce(
            (sum, item) => {
                const badge = badgeOf(item);
                return { count: sum.count + badge.count, overdue: sum.overdue + badge.overdue };
            },
            { count: 0, overdue: 0 },
        );
    }

    function renderItem(item: MenuItem) {
        const label = t(`sidebar.items.${item.key}`);
        const pinned = pins.includes(item.key);
        return (
            <MenuLink
                active={isMenuItemActive(item, pathname)}
                badge={badgeOf(item)}
                item={item}
                key={item.key}
                label={label}
                pendingLabel={t('sidebar.pendingAria')}
                pinned={pinned}
                canPin={pinned || pins.length < MAX_PINS}
                pinLabel={t(pinned ? 'sidebar.unpin' : 'sidebar.pin', { item: label })}
                onNavigate={onNavigate}
                onTogglePin={() => toggle(item.key)}
            />
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-brand-800 text-white dark:bg-night-deep">
            <Link
                className="flex items-center gap-3 px-4 pt-3 pb-2.5 text-inherit no-underline"
                href={home}
                onClick={onNavigate}
            >
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
                <span className="min-w-0">
                    <strong className="block truncate text-sm">{t('sidebar.brandName')}</strong>
                    <span className="mt-0.5 block truncate text-xs text-white/70">{t('sidebar.brandTagline')}</span>
                </span>
            </Link>

            <div className="px-2.5 pb-2.5">
                <button
                    className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-white/20 bg-white/8 px-2.5 text-left text-sm text-white/80 transition hover:bg-white/15 hover:text-white"
                    type="button"
                    onClick={onSearch}
                >
                    <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{t('sidebar.search')}</span>
                    <kbd className="mm-data rounded border border-white/20 px-1.5 py-0.5 text-[0.65rem] text-white/70 max-lg:hidden">
                        Ctrl K
                    </kbd>
                </button>
            </div>

            <nav
                className="mm-scroll-x min-h-0 flex-1 overflow-y-auto px-2.5 pb-3"
                aria-label={t('sidebar.areasLabel')}
            >
                {inSettings && settingsArea ? (
                    <>
                        <Link
                            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-white/80 no-underline transition hover:bg-white/8 hover:text-white"
                            href={getWorkHref() ?? home}
                        >
                            <ArrowLeft className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                            {t('sidebar.backToPanel')}
                        </Link>
                        <h2 className="mt-4 mb-1.5 px-2.5 text-sm font-bold text-white">
                            {t('sidebar.areas.settings')}
                        </h2>
                        <ul className="m-0 grid list-none gap-0.5 p-0">{settingsArea.items.map(renderItem)}</ul>
                    </>
                ) : (
                    <>
                        {pinnedItems.length > 0 && (
                            <section className="mb-2">
                                <h2 className="mt-0 mb-1.5 px-2.5 text-xs font-semibold text-white/70">
                                    {t('sidebar.pinned')}
                                </h2>
                                <ul className="m-0 grid list-none gap-0.5 p-0">{pinnedItems.map(renderItem)}</ul>
                            </section>
                        )}
                        {workAreas.map((area) => {
                            const open = manualOpen[area.key] ?? area.key === currentArea;
                            return (
                                <AreaSection
                                    area={area}
                                    badge={areaBadge(area)}
                                    current={area.key === currentArea}
                                    key={area.key}
                                    label={t(`sidebar.areas.${area.key}`)}
                                    open={open}
                                    pendingLabel={t('sidebar.pendingAria')}
                                    onToggle={() =>
                                        setManual((current) => ({
                                            area: currentArea,
                                            open: {
                                                ...(current.area === currentArea ? current.open : {}),
                                                [area.key]: !open,
                                            },
                                        }))
                                    }
                                >
                                    {area.items.map(renderItem)}
                                </AreaSection>
                            );
                        })}
                    </>
                )}
            </nav>

            {!inSettings && settingsArea && (
                <div className="shrink-0 border-t border-white/12 px-2.5 py-1.5">
                    <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold text-white/80 no-underline transition hover:bg-white/8 hover:text-white"
                        href={settingsArea.items[0].href}
                    >
                        <settingsArea.icon className="h-4.5 w-4.5 shrink-0" aria-hidden={true} />
                        <span className="flex-1">{t('sidebar.areas.settings')}</span>
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                </div>
            )}

            <div className="shrink-0 border-t border-white/12 p-2.5">
                <div className="flex items-center gap-2.5 px-1.5 py-1">
                    <span
                        className="mm-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold"
                        aria-hidden="true"
                    >
                        {initials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{name}</strong>
                        <span className="block truncate text-xs text-white/70">{admin?.email ?? t('common.dash')}</span>
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

function AreaSection({
    area,
    label,
    open,
    current,
    badge,
    pendingLabel,
    onToggle,
    children,
}: {
    area: MenuArea;
    label: string;
    open: boolean;
    current: boolean;
    badge: MenuBadgeCount;
    pendingLabel: string;
    onToggle: () => void;
    children: ReactNode;
}) {
    const Icon = area.icon;
    // A barra existe duas vezes na página (fixa e gaveta): id próprio em cada uma.
    const panelId = useId();

    return (
        <section>
            <h2 className="m-0">
                <button
                    className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 pointer-coarse:min-h-11 bg-transparent px-2.5 text-left text-sm font-bold transition hover:bg-white/8 ${
                        current ? 'text-white' : 'text-white/80'
                    }`}
                    type="button"
                    aria-controls={panelId}
                    aria-expanded={open}
                    onClick={onToggle}
                >
                    <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden={true} />
                    <span className="flex-1 truncate">{label}</span>
                    {/* Aberta, cada item mostra o seu selo; o da área seria o mesmo número duas vezes. */}
                    {!open && <CountBadge badge={badge} pendingLabel={pendingLabel} />}
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
                        aria-hidden="true"
                    />
                </button>
            </h2>
            <ul className="m-0 mb-1 grid list-none gap-px p-0 pl-3" hidden={!open} id={panelId}>
                {children}
            </ul>
        </section>
    );
}

function CountBadge({ badge, pendingLabel }: { badge: MenuBadgeCount; pendingLabel: string }) {
    if (badge.count === 0) return null;
    return (
        <span
            className={`mm-data grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[0.65rem] leading-none font-bold ${
                badge.overdue > 0 ? 'bg-origin-700 text-white' : 'bg-amber-300 text-amber-950'
            }`}
        >
            {badge.count}
            <span className="sr-only"> {pendingLabel}</span>
        </span>
    );
}

function MenuLink({
    item,
    label,
    active,
    badge,
    pendingLabel,
    pinned,
    canPin,
    pinLabel,
    onNavigate,
    onTogglePin,
}: {
    item: MenuItem;
    label: string;
    active: boolean;
    /** Parte de `count` que passou do prazo deixa o selo vermelho. */
    badge: MenuBadgeCount;
    pendingLabel: string;
    pinned: boolean;
    canPin: boolean;
    pinLabel: string;
    onNavigate?: () => void;
    onTogglePin: () => void;
}) {
    const Icon = item.icon;
    const PinIcon = pinned ? PinOff : Pin;

    return (
        <li className="group relative">
            <Link
                className={`flex min-h-9 items-center gap-2.5 rounded-lg pr-9 pointer-coarse:min-h-11 pl-2.5 text-sm font-semibold no-underline transition ${
                    active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
            >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden={true} />
                <span className="flex-1 truncate">{label}</span>
                <CountBadge badge={badge} pendingLabel={pendingLabel} />
            </Link>
            {canPin && (
                <button
                    className="absolute top-1/2 right-1 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-white/70 opacity-0 transition group-hover:opacity-100 hover:bg-white/15 hover:text-white focus-visible:opacity-100 pointer-coarse:opacity-60"
                    type="button"
                    aria-label={pinLabel}
                    aria-pressed={pinned}
                    title={pinLabel}
                    onClick={onTogglePin}
                >
                    <PinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
        </li>
    );
}
