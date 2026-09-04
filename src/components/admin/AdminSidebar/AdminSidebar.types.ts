import type { LucideIcon } from 'lucide-react';
import type { PendingCounts } from '@/services/admin/pending-counts';

/** Contador de fila exibido como selo ao lado do item de menu. */
export type MenuBadge = keyof PendingCounts;

/** Sufixos válidos em `sidebar.items.*` — mantém o `t()` verificado pelo TypeScript. */
export type MenuItemKey =
    | 'dashboard'
    | 'orders'
    | 'inspections'
    | 'packages'
    | 'users'
    | 'products'
    | 'categories'
    | 'finance'
    | 'admins'
    | 'productRequests';

/** Sufixos válidos em `sidebar.groups.*`. */
export type MenuGroupKey = 'operations' | 'catalog' | 'logistics' | 'finance' | 'system';

export interface MenuItem {
    key: MenuItemKey;
    href: string;
    icon: LucideIcon;
    badge?: MenuBadge;
}

export interface MenuGroup {
    /** `undefined` para itens soltos no topo, sem cabeçalho de grupo. */
    key?: MenuGroupKey;
    items: readonly MenuItem[];
}
