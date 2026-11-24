'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    Boxes,
    ClipboardList,
    CornerDownLeft,
    History,
    LoaderCircle,
    Package,
    Plus,
    Search,
    Settings,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { describeSetting, KNOWN_SETTING_KEYS } from '@/app/admin/configuracoes/settings-catalog';
import { visibleItems } from '@/components/admin/AdminSidebar/menu';
import { canSeeMenuItem } from '@/components/admin/AdminSidebar/roles';
import { useTranslation } from '@/i18n/LanguageProvider';
import { normalize } from '@/services/admin/normalize';
import { rememberEntry, useRecentEntries, type RecentEntry } from '@/services/admin/panel-prefs';
import { api } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import {
    orderStatusLabel,
    packageStatusLabel,
    type AdminOrder,
    type AdminPackage,
    type AdminProduct,
    type AdminUser,
    type Page,
} from '@/types/api';

type GroupKey = 'recent' | 'actions' | 'screens' | 'settings' | 'orders' | 'packages' | 'customers' | 'products';
type RemoteKey = 'orders' | 'packages' | 'customers' | 'products';

interface PaletteEntry extends RecentEntry {
    icon: LucideIcon;
}

interface PaletteGroup {
    key: GroupKey;
    entries: readonly PaletteEntry[];
}

/** As listas pedem ao menos dois caracteres; abaixo disso só telas e ações. */
const MIN_REMOTE_LENGTH = 2;
const REMOTE_DELAY_MS = 300;
const REMOTE_LIMIT = 5;
const REMOTE_KEYS: readonly RemoteKey[] = ['orders', 'packages', 'customers', 'products'];
const LOCAL_LIMIT = 6;
/** Duas letras casam com quase toda chave técnica. */
const MIN_SETTINGS_LENGTH = 3;

/**
 * Busca geral (Ctrl+K): telas, ações e configurações saem do próprio menu;
 * pedidos, pacotes, clientes e produtos, da busca que cada lista já tem. Só
 * mostra o que o papel alcança pelo menu.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { admin } = useAdminAccountAuth();
    const role = admin?.role;
    const recents = useRecentEntries(admin?.id);
    const [text, setText] = useState('');
    // Pelo endereço e não pela posição: resultado que chega depois não troca a escolha.
    const [selectedKey, setSelectedKey] = useState<string>();
    const [remote, setRemote] = useState<{ term: string; groups: PaletteGroup[]; failed: boolean }>();
    const baseId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const term = text.trim();
    const searchesRemote = term.length >= MIN_REMOTE_LENGTH;

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        document.body.dataset.dialogOpen = 'true';
        inputRef.current?.focus();
        return () => {
            delete document.body.dataset.dialogOpen;
            previouslyFocused?.focus?.();
        };
    }, []);

    useEffect(() => {
        if (!searchesRemote) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            const query = new URLSearchParams({ search: term, limit: String(REMOTE_LIMIT) }).toString();
            const fetchers: Record<RemoteKey, () => Promise<PaletteEntry[]>> = {
                orders: () =>
                    api<Page<AdminOrder>>(`/orders?${query}`, { signal: controller.signal }).then((page) =>
                        page.data.map((order) => ({
                            href: `/admin/pedidos/${order.id}`,
                            icon: ClipboardList,
                            title: `#${order.id.slice(0, 8)} · ${order.userName}`,
                            meta: [order.items[0]?.productName, orderStatusLabel(order.status)]
                                .filter(Boolean)
                                .join(' · '),
                        })),
                    ),
                packages: () =>
                    api<Page<AdminPackage>>(`/packages?${query}`, { signal: controller.signal }).then((page) =>
                        page.data.map((pkg) => ({
                            href: `/admin/pacotes/${pkg.id}`,
                            icon: Boxes,
                            title: `${pkg.packageCode} · ${pkg.userName}`,
                            meta: packageStatusLabel(pkg.status),
                        })),
                    ),
                customers: () =>
                    api<Page<AdminUser>>(`/users?${query}`, { signal: controller.signal }).then((page) =>
                        page.data.map((user) => ({
                            href: `/admin/usuarios/${user.id}`,
                            icon: Users,
                            title: user.name,
                            meta: `@${user.username} · ${user.email}`,
                        })),
                    ),
                products: () =>
                    api<Page<AdminProduct>>(`/products?${query}`, { signal: controller.signal }).then((page) =>
                        page.data.map((product) => ({
                            // O endereço de loja leva sozinho à CoinShop ou ao Leve junto.
                            href: `/admin/produtos/${product.id}`,
                            icon: Package,
                            title: product.name,
                        })),
                    ),
            };
            const menuKey = {
                orders: 'orders',
                packages: 'packages',
                customers: 'users',
                products: 'products',
            } as const;
            const keys = REMOTE_KEYS.filter((key) => canSeeMenuItem(role, menuKey[key]));
            void Promise.allSettled(keys.map((key) => fetchers[key]())).then((results) => {
                if (controller.signal.aborted) return;
                setRemote({
                    term,
                    failed: results.some((result) => result.status === 'rejected'),
                    groups: results.flatMap((result, index) =>
                        result.status === 'fulfilled' && result.value.length > 0
                            ? [{ key: keys[index], entries: result.value }]
                            : [],
                    ),
                });
            });
        }, REMOTE_DELAY_MS);
        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [role, searchesRemote, term]);

    const localGroups = useMemo<PaletteGroup[]>(() => {
        const items = visibleItems(role);
        const screens: PaletteEntry[] = items.map((item) => ({
            href: item.href,
            icon: item.icon,
            title: t(`sidebar.items.${item.key}`),
        }));
        // As abas de Frete também são telas que se procura pelo nome.
        if (canSeeMenuItem(role, 'freight'))
            screens.push(
                { href: '/admin/embalagens', icon: Boxes, title: t('freightTabs.shippingBoxes') },
                { href: '/admin/transportadoras', icon: Boxes, title: t('freightTabs.carriers') },
            );
        const actions: PaletteEntry[] = [
            { href: '/admin/pedidos/novo', icon: Plus, title: t('palette.actions.newOrder') },
        ];
        if (canSeeMenuItem(role, 'products'))
            actions.push(
                { href: '/admin/produtos/novo', icon: Plus, title: t('palette.actions.newProduct') },
                { href: '/admin/produtos/importar', icon: Plus, title: t('palette.actions.importProducts') },
            );
        if (canSeeMenuItem(role, 'suppliers'))
            actions.push({ href: '/admin/fornecedores/novo', icon: Plus, title: t('palette.actions.newSupplier') });
        const settings: PaletteEntry[] = canSeeMenuItem(role, 'settings')
            ? KNOWN_SETTING_KEYS.map((key) => ({
                  href: `/admin/configuracoes#${key}`,
                  icon: Settings,
                  title: describeSetting(key, t).name,
                  meta: key,
              }))
            : [];

        const needle = normalize(term);
        if (!needle) {
            return [
                { key: 'recent', entries: recents.map((entry) => ({ ...entry, icon: History })) },
                { key: 'actions', entries: actions },
                { key: 'screens', entries: screens },
            ];
        }
        const matching = (entries: PaletteEntry[]) =>
            entries
                .filter((entry) => normalize(`${entry.title} ${entry.meta ?? ''}`).includes(needle))
                .slice(0, LOCAL_LIMIT);
        return [
            { key: 'screens', entries: matching(screens) },
            { key: 'actions', entries: matching(actions) },
            { key: 'settings', entries: needle.length >= MIN_SETTINGS_LENGTH ? matching(settings) : [] },
        ];
    }, [recents, role, t, term]);

    const remoteReady = searchesRemote && remote?.term === term;
    const loading = searchesRemote && !remoteReady;
    // Configuração fica por último: quem busca um nome quer o cliente primeiro.
    const groups = [
        ...localGroups.filter((group) => group.key !== 'settings'),
        ...(remoteReady ? remote.groups : []),
        ...localGroups.filter((group) => group.key === 'settings'),
    ].filter((group) => group.entries.length > 0);
    const flat = groups.flatMap((group) =>
        group.entries.map((entry) => ({ entry, key: `${group.key}:${entry.href}` })),
    );
    const active = Math.max(
        0,
        flat.findIndex(({ key }) => key === selectedKey),
    );

    function open(entry: PaletteEntry) {
        // Ação não é lugar: "Novo pedido" já está sempre à mão.
        if (entry.icon !== Plus)
            rememberEntry(admin?.id, { href: entry.href, title: entry.title, ...(entry.meta && { meta: entry.meta }) });
        onClose();
        router.push(entry.href);
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        } else if (event.key === 'Tab') {
            // Um campo só: as opções são percorridas com as setas.
            event.preventDefault();
        } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && flat.length > 0) {
            event.preventDefault();
            const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
            setSelectedKey(flat[next].key);
            listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter' && !event.nativeEvent.isComposing && flat[active]) {
            event.preventDefault();
            open(flat[active].entry);
        }
    }

    const offsets = groups.map((_, index) =>
        groups.slice(0, index).reduce((sum, group) => sum + group.entries.length, 0),
    );

    return (
        <div
            className="fixed inset-0 z-50 flex justify-center bg-warm-950/45 px-4 pt-[10vh] pb-4 backdrop-blur-[2px] dark:bg-black/65"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="mm-card flex max-h-full w-full max-w-xl flex-col self-start overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-label={t('palette.title')}
                onKeyDown={handleKeyDown}
            >
                <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 dark:border-night-line">
                    {loading ? (
                        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                        <Search className="h-4 w-4 shrink-0 text-muted dark:text-night-muted" aria-hidden="true" />
                    )}
                    <input
                        className="min-h-13 min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-muted dark:text-night-text dark:placeholder:text-night-muted"
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        autoComplete="off"
                        spellCheck={false}
                        aria-activedescendant={flat[active] ? `${baseId}-${active}` : undefined}
                        aria-controls={`${baseId}-list`}
                        aria-expanded={flat.length > 0}
                        aria-label={t('palette.title')}
                        maxLength={120}
                        placeholder={t('palette.placeholder')}
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setSelectedKey(undefined);
                        }}
                    />
                    <button
                        className="min-h-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent px-2 text-xs font-semibold text-muted hover:text-ink dark:text-night-muted dark:hover:text-night-text"
                        type="button"
                        tabIndex={-1}
                        onClick={onClose}
                    >
                        {t('common.closeAria')}
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2" id={`${baseId}-list`} ref={listRef} role="listbox">
                    {groups.map((group, groupIndex) => (
                        <div
                            className="mb-2 last:mb-0"
                            key={group.key}
                            role="group"
                            aria-label={t(`palette.groups.${group.key}`)}
                        >
                            <p
                                className="m-0 px-2.5 py-1 text-xs font-semibold text-muted dark:text-night-muted"
                                aria-hidden="true"
                            >
                                {t(`palette.groups.${group.key}`)}
                            </p>
                            {group.entries.map((entry, entryIndex) => {
                                const index = offsets[groupIndex] + entryIndex;
                                const isActive = index === active;
                                return (
                                    <div
                                        aria-selected={isActive}
                                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 ${
                                            isActive ? 'bg-brand-50 dark:bg-night-brand' : ''
                                        }`}
                                        data-index={index}
                                        id={`${baseId}-${index}`}
                                        key={`${group.key}:${entry.href}`}
                                        role="option"
                                        onClick={() => open(entry)}
                                        onMouseMove={() => setSelectedKey(flat[index].key)}
                                    >
                                        <entry.icon
                                            className="h-4 w-4 shrink-0 text-muted dark:text-night-muted"
                                            aria-hidden={true}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-ink dark:text-night-text">
                                                {entry.title}
                                            </span>
                                            {entry.meta && (
                                                <span className="block truncate text-xs text-muted dark:text-night-muted">
                                                    {entry.meta}
                                                </span>
                                            )}
                                        </span>
                                        {isActive && (
                                            <CornerDownLeft
                                                className="h-3.5 w-3.5 shrink-0 text-muted dark:text-night-muted"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    <p className="m-0 px-2.5 py-2 text-sm text-muted empty:hidden dark:text-night-muted" role="status">
                        {loading
                            ? t('palette.loading')
                            : remoteReady && remote.failed
                              ? t('palette.partialError')
                              : flat.length === 0
                                ? t('palette.empty')
                                : null}
                    </p>
                </div>
            </div>
        </div>
    );
}
