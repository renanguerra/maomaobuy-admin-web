import type { MessageKey } from '@/i18n/translations';

const ORIGINS = {
    pedido: { path: '/admin/pedidos', label: 'customers.backToOrder' },
    pacote: { path: '/admin/pacotes', label: 'customers.backToPackage' },
    encomenda: { path: '/admin/pedidos-de-produto', label: 'customers.backToRequest' },
} as const satisfies Record<string, { path: string; label: MessageKey }>;

type Origin = keyof typeof ORIGINS;

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Ficha do cliente lembrando de onde se veio, para o link de voltar. */
export function customerHref(userId: string, from: Origin, resourceId: string) {
    return `/admin/usuarios/${userId}?de=${from}:${resourceId}`;
}

/** Lê o `?de=`. Só aceita destinos conhecidos: o valor vem do endereço. */
export function returnLink(value: string | null): { href: string; label: MessageKey } | undefined {
    const [origin, id] = (value ?? '').split(':');
    if (!Object.prototype.hasOwnProperty.call(ORIGINS, origin) || !UUID.test(id ?? '')) return undefined;
    const { path, label } = ORIGINS[origin as Origin];
    return { href: `${path}/${id}`, label };
}
