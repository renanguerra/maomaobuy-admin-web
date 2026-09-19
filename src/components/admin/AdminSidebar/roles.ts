import type { MenuItemKey } from './AdminSidebar.types';

/**
 * Espelho das restrições de escrita do backend (`@Roles` nos controllers do
 * `apps/admin`). Leitura é aberta a todo admin, mas mostrar no menu uma área
 * em que a pessoa só vai tomar 403 ao clicar em qualquer botão é pior do que
 * escondê-la. `SUPERADMIN` vê tudo; quem não está listado aqui é porque a
 * área é balcão comum (pedidos, e-mails, painel).
 */
const WRITE_ROLES: Partial<Record<MenuItemKey, readonly string[]>> = {
    inspections: ['WAREHOUSE'],
    packages: ['WAREHOUSE'],
    productRequests: ['SUPPORT', 'CATALOG'],
    users: ['SUPPORT'],
    products: ['CATALOG'],
    categories: ['CATALOG'],
    optionalServices: [],
    coupons: ['FINANCE'],
    finance: ['FINANCE'],
    admins: [],
    settings: [],
};

export function canSeeMenuItem(role: string | undefined, key: MenuItemKey) {
    if (role === 'SUPERADMIN') return true;
    const allowed = WRITE_ROLES[key];
    if (!allowed) return true;
    return role !== undefined && allowed.includes(role);
}
