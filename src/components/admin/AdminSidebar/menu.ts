import {
    Boxes,
    ChartColumn,
    ClipboardList,
    Coins,
    Gift,
    Contact,
    CreditCard,
    LayoutDashboard,
    Mail,
    Megaphone,
    MessageSquareQuote,
    ArrowDownToLine,
    Package,
    PackageOpen,
    PackageSearch,
    Settings,
    ShieldCheck,
    ShoppingBasket,
    Star,
    Store,
    Tags,
    TicketPercent,
    Truck,
    Undo2,
    Users,
    Wallet,
    Warehouse,
} from 'lucide-react';
import type { MenuArea, MenuAreaKey, MenuItem, MenuItemKey } from './AdminSidebar.types';
import { canSeeMenuItem } from './roles';

/**
 * Menu do painel por área de trabalho (24/11/2026). Só o agrupamento é daqui:
 * os endereços são os de sempre e a área é descoberta por eles, então link de
 * e-mail e favorito continuam valendo. Dois níveis e nada mais — assunto
 * dentro de uma tela vira aba.
 */
export const MENU_AREAS: readonly MenuArea[] = [
    {
        key: 'operations',
        icon: Warehouse,
        items: [
            { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
            { key: 'orders', href: '/admin/pedidos', icon: ClipboardList, badge: 'orders' },
            {
                key: 'packages',
                href: '/admin/pacotes',
                icon: Boxes,
                badge: 'packages',
                // "Sem pacote" é aba de Pacotes (26/11/2026).
                also: ['/admin/sem-pacote'],
            },
            { key: 'unpacked', href: '/admin/sem-pacote', icon: PackageOpen },
            {
                key: 'productRequests',
                href: '/admin/pedidos-de-produto',
                icon: PackageSearch,
                badge: 'productRequests',
            },
            { key: 'suppliers', href: '/admin/fornecedores', icon: Contact },
        ],
    },
    {
        key: 'store',
        icon: Store,
        items: [
            { key: 'products', href: '/admin/produtos', icon: Package },
            { key: 'boxes', href: '/admin/boxes', icon: Gift },
            { key: 'coinShop', href: '/admin/coin-shop', icon: Coins },
            { key: 'checkoutAddons', href: '/admin/leve-junto', icon: ShoppingBasket },
            { key: 'categories', href: '/admin/categorias', icon: Tags },
            { key: 'storefrontFeedbacks', href: '/admin/vitrine/feedbacks', icon: MessageSquareQuote },
            { key: 'siteNotices', href: '/admin/avisos', icon: Megaphone },
        ],
    },
    {
        key: 'customers',
        icon: Users,
        items: [
            { key: 'users', href: '/admin/usuarios', icon: Users },
            { key: 'wholesale', href: '/admin/lojistas', icon: Store },
            { key: 'influencers', href: '/admin/influencers', icon: Star },
            { key: 'coupons', href: '/admin/cupons', icon: TicketPercent },
            { key: 'emails', href: '/admin/emails', icon: Mail },
        ],
    },
    {
        key: 'finance',
        icon: Wallet,
        items: [
            { key: 'profit', href: '/admin/lucro', icon: ChartColumn },
            { key: 'topUps', href: '/admin/recargas', icon: ArrowDownToLine },
            { key: 'finance', href: '/admin/financeiro', icon: Undo2, badge: 'finance' },
        ],
    },
    {
        key: 'settings',
        icon: Settings,
        items: [
            {
                key: 'settings',
                href: '/admin/configuracoes',
                icon: Settings,
                also: ['/admin/servicos-adicionais'],
            },
            {
                key: 'freight',
                href: '/admin/frete',
                icon: Truck,
                also: ['/admin/embalagens', '/admin/transportadoras'],
            },
            { key: 'paymentMethods', href: '/admin/meios-de-pagamento', icon: CreditCard },
            { key: 'admins', href: '/admin/admins', icon: ShieldCheck },
        ],
    },
];

const ALL_ITEMS = MENU_AREAS.flatMap((area) => area.items);

/** Por onde cada papel começa, depois do login e ao clicar na marca. */
const HOME_BY_ROLE: Readonly<Record<string, string>> = {
    CATALOG: '/admin/produtos',
    SUPPORT: '/admin/usuarios',
    FINANCE: '/admin/lucro',
};

export function homeHref(role: string | undefined) {
    return HOME_BY_ROLE[role ?? ''] ?? '/admin';
}

/**
 * `/admin` só fica ativo na rota exata; os demais também acendem nas telas de
 * detalhe (`/admin/pedidos/<id>`) e nas abas (`also`).
 */
export function isMenuItemActive(item: MenuItem, pathname: string) {
    if (item.href === '/admin') return pathname === item.href;
    return [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

/** A área da tela atual; endereço fora do menu fica em Operação. */
export function areaOfPath(pathname: string): MenuAreaKey {
    return MENU_AREAS.find((area) => area.items.some((item) => isMenuItemActive(item, pathname)))?.key ?? 'operations';
}

/** Áreas com o que o papel alcança; área sem nenhum item some. */
export function visibleAreas(role: string | undefined): MenuArea[] {
    return MENU_AREAS.map((area) => ({
        ...area,
        items: area.items.filter((item) => canSeeMenuItem(role, item.key)),
    })).filter((area) => area.items.length > 0);
}

export function visibleItems(role: string | undefined): MenuItem[] {
    return ALL_ITEMS.filter((item) => canSeeMenuItem(role, item.key));
}

export function isMenuItemKey(value: string): value is MenuItemKey {
    return ALL_ITEMS.some((item) => item.key === value);
}

/** Iniciais do admin logado para o avatar do rodapé. */
export function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
