import type { LucideIcon } from 'lucide-react';
import type { PendingCounts } from '@/services/admin/pending-counts';

/** Contador de fila exibido como selo ao lado do item de menu. */
export type MenuBadge = keyof PendingCounts;

/** Sufixos válidos em `sidebar.items.*` — mantém o `t()` verificado pelo TypeScript. */
export type MenuItemKey =
    | 'dashboard'
    | 'orders'
    | 'packages'
    | 'unpacked'
    | 'productRequests'
    | 'suppliers'
    | 'products'
    | 'coinShop'
    | 'checkoutAddons'
    | 'categories'
    | 'storefrontFeedbacks'
    | 'siteNotices'
    | 'users'
    | 'wholesale'
    | 'influencers'
    | 'coupons'
    | 'emails'
    | 'profit'
    | 'topUps'
    | 'finance'
    | 'settings'
    | 'freight'
    | 'optionalServices'
    | 'paymentMethods'
    | 'admins';

/** Sufixos válidos em `sidebar.areas.*`. */
export type MenuAreaKey = 'operations' | 'store' | 'customers' | 'finance' | 'settings';

export interface MenuItem {
    key: MenuItemKey;
    href: string;
    icon: LucideIcon;
    badge?: MenuBadge;
    /** Outros endereços da mesma tela (abas), que também acendem o item. */
    also?: readonly string[];
}

export interface MenuArea {
    key: MenuAreaKey;
    icon: LucideIcon;
    items: readonly MenuItem[];
}
