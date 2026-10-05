import { NextResponse } from 'next/server';

/**
 * Cabeçalhos de segurança do painel, no mesmo espírito do `proxy.ts` do site.
 * Antes o painel não mandava nenhum: dava para abri-lo dentro de um iframe de
 * outro site e induzir um admin logado a clicar em "aprovar" ou "cancelar".
 *
 * Só diretivas que não quebram nada hoje. Ficam de fora, de propósito:
 * - `upgrade-insecure-requests` e HSTS: o painel roda em HTTP na rede local
 *   (ver `deploy/admin-lan` no backend), e os dois forçariam HTTPS;
 * - `script-src`: o tema é aplicado por um script inline no `layout.tsx`.
 */
const ENFORCED_CSP = ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join(
    '; ',
);

/** O painel não usa nenhuma dessas capacidades — desligar reduz superfície. */
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()';

export function proxy() {
    const response = NextResponse.next();

    response.headers.set('Content-Security-Policy', ENFORCED_CSP);
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // Os endereços do painel carregam ids de cliente e de pedido; nada disso
    // precisa sair para outro site. `same-origin`, e não `no-referrer`: o
    // proxy `/api` confere a origem pelo `Referer` nos GET (que não levam
    // `Origin`), e sem ele recusava até o `/admin-auth/me` do login.
    response.headers.set('Referrer-Policy', 'same-origin');
    response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
