import {
    Boxes,
    ChartColumn,
    ClipboardCheck,
    ClipboardList,
    LayoutDashboard,
    Mail,
    Megaphone,
    Package,
    PackageOpen,
    PackageSearch,
    Settings,
    ShieldCheck,
    Sparkles,
    Tags,
    TicketPercent,
    Users,
    Wallet,
} from 'lucide-react';
import type { MenuGroup } from './AdminSidebar.types';

/**
 * Menu do painel, agrupado pelo fluxo de trabalho e não pelo modelo de dados:
 * primeiro o que tem fila (pedidos, pacotes), depois o catálogo, o financeiro
 * e por último o que quase nunca muda (contas de admin).
 */
export const MENU_GROUPS: readonly MenuGroup[] = [
    {
        items: [{ key: 'dashboard', href: '/admin', icon: LayoutDashboard }],
    },
    {
        key: 'logistics',
        items: [
            { key: 'orders', href: '/admin/pedidos', icon: ClipboardList, badge: 'orders' },
            {
                key: 'inspections',
                href: '/admin/inspecoes',
                icon: ClipboardCheck,
                badge: 'inspections',
            },
            { key: 'packages', href: '/admin/pacotes', icon: Boxes, badge: 'packages' },
            { key: 'unpacked', href: '/admin/sem-pacote', icon: PackageOpen },
            {
                key: 'productRequests',
                href: '/admin/pedidos-de-produto',
                icon: PackageSearch,
                badge: 'productRequests',
            },
        ],
    },
    {
        key: 'operations',
        items: [
            { key: 'users', href: '/admin/usuarios', icon: Users },
            { key: 'siteNotices', href: '/admin/avisos', icon: Megaphone },
        ],
    },
    {
        key: 'catalog',
        items: [
            { key: 'products', href: '/admin/produtos', icon: Package },
            { key: 'categories', href: '/admin/categorias', icon: Tags },
            { key: 'optionalServices', href: '/admin/servicos-adicionais', icon: Sparkles },
        ],
    },
    {
        key: 'finance',
        items: [
            { key: 'finance', href: '/admin/financeiro', icon: Wallet, badge: 'finance' },
            { key: 'coupons', href: '/admin/cupons', icon: TicketPercent },
            { key: 'profit', href: '/admin/lucro', icon: ChartColumn },
        ],
    },
    {
        key: 'system',
        items: [
            { key: 'admins', href: '/admin/admins', icon: ShieldCheck },
            { key: 'emails', href: '/admin/emails', icon: Mail },
            { key: 'settings', href: '/admin/configuracoes', icon: Settings },
        ],
    },
];

/**
 * `/admin` só fica ativo na rota exata; os demais também acendem nas telas de
 * detalhe (`/admin/pedidos/<id>`).
 */
export function isMenuItemActive(href: string, pathname: string) {
    return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Iniciais do admin logado para o avatar do rodapé. */
export function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
