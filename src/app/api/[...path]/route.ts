import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/server/admin-session-cookie';
import { isSameOriginRequest } from '@/server/same-origin';

const backend = process.env.ADMIN_API_URL ?? 'http://localhost:3002';

async function proxy(request: NextRequest, context: RouteContext<'/api/[...path]'>) {
    if (!isSameOriginRequest(request)) {
        return Response.json(
            { message: 'Requisição recusada: origem não permitida.' },
            { status: 403, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const store = await cookies();
    const sessionToken = store.get(ADMIN_SESSION_COOKIE)?.value;
    if (!sessionToken) {
        return Response.json(
            { message: 'Sessão administrativa expirada. Faça login novamente.' },
            { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const { path } = await context.params;
    const target = new URL(`/v1/${path.join('/')}`, backend);
    target.search = request.nextUrl.search;

    const headers = new Headers();
    for (const name of ['accept', 'content-type', 'sec-fetch-site', 'user-agent']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }

    headers.set('authorization', `Bearer ${process.env.ADMIN_AUTH_TOKEN}`);
    headers.set('x-admin-session-token', sessionToken);
    headers.set('x-forwarded-host', request.headers.get('host') ?? request.nextUrl.host);
    headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

    let response: Response;
    try {
        response = await fetch(target, {
            method: request.method,
            headers,
            body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
            cache: 'no-store',
            redirect: 'manual',
        });
    } catch {
        return Response.json(
            { message: 'O serviço MaoMaoBuy Admin está temporariamente indisponível.' },
            { status: 502, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const outgoing = new Headers(response.headers);
    outgoing.delete('content-encoding');
    outgoing.delete('content-length');
    outgoing.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, headers: outgoing });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
