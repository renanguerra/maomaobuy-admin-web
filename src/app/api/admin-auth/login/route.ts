import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from '@/server/admin-session-cookie';
import { isSameOriginRequest } from '@/server/same-origin';

const backend = process.env.ADMIN_API_URL ?? 'http://localhost:3002';

export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request)) {
        return Response.json(
            { message: 'Requisição recusada: origem não permitida.' },
            { status: 403, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json(
            { message: 'Corpo da requisição inválido.' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    let response: Response;
    try {
        response = await fetch(new URL('/v1/admin-auth/login', backend), {
            method: 'POST',
            headers: {
                authorization: `Bearer ${process.env.ADMIN_AUTH_TOKEN}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
    } catch {
        return Response.json(
            { message: 'O serviço MaoMaoBuy Admin está temporariamente indisponível.' },
            { status: 502, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const responseBody: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
        const message =
            typeof responseBody === 'object' &&
            responseBody !== null &&
            'message' in responseBody &&
            typeof responseBody.message === 'string'
                ? responseBody.message
                : 'Não foi possível entrar com essa conta administrativa.';
        return Response.json({ message }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const { token: sessionToken, admin } = responseBody as { token: string; admin: unknown };

    const store = await cookies();
    store.set(ADMIN_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
    });

    return Response.json({ admin }, { headers: { 'Cache-Control': 'no-store' } });
}
