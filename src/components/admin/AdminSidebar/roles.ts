import type { MenuItemKey } from './AdminSidebar.types';

/**
 * Espelho das restrições de escrita do backend (`@Roles` nos controllers do
 * `apps/admin`). Leitura é aberta a todo admin, mas mostrar no menu uma área
 * em que a pessoa só vai tomar 403 ao clicar em qualquer botão é pior do que
 * escondê-la. `SUPERADMIN` vê tudo; quem não está listado aqui é porque a
 * área é balcão comum (pedidos, itens sem pacote, painel).
 *
 * `emails` é a exceção: ninguém escreve lá, mas a tela responde "o cliente
 * foi avisado?", que é pergunta de atendimento.
 */
const WRITE_ROLES: Partial<Record<MenuItemKey, readonly string[]>> = {
    packages: ['WAREHOUSE'],
    productRequests: ['SUPPORT', 'CATALOG'],
    users: ['SUPPORT'],
    influencers: ['SUPPORT', 'FINANCE'],
    wholesale: ['SUPPORT'],
    siteNotices: ['SUPPORT'],
    suppliers: ['CATALOG', 'WAREHOUSE', 'FINANCE'],
    freight: ['WAREHOUSE', 'FINANCE'],
    storefrontFeedbacks: ['CATALOG', 'SUPPORT'],
    emails: ['SUPPORT', 'FINANCE'],
    profit: ['FINANCE', 'WAREHOUSE', 'CATALOG'],
    products: ['CATALOG'],
    coinShop: ['CATALOG'],
    checkoutAddons: ['CATALOG'],
    boxes: ['CATALOG'],
    categories: ['CATALOG'],
    // Fora do menu enquanto não há serviço (decisão de 14/11/2026): o
    // link fica em Configurações, para o SUPERADMIN.
    optionalServices: [],
    coupons: ['FINANCE'],
    finance: ['FINANCE'],
    topUps: ['FINANCE'],
    paymentMethods: ['FINANCE'],
    admins: [],
    settings: [],
};

export function canSeeMenuItem(role: string | undefined, key: MenuItemKey): boolean {
    // "Sem pacote" é aba de Pacotes; vira item próprio só para quem não vê
    // Pacotes no menu (é balcão comum: o atendimento lembra o cliente).
    if (key === 'unpacked') return !canSeeMenuItem(role, 'packages');
    if (role === 'SUPERADMIN') return true;
    const allowed = WRITE_ROLES[key];
    if (!allowed) return true;
    return role !== undefined && allowed.includes(role);
}
