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

    const store = await cookies();
    const sessionToken = store.get(ADMIN_SESSION_COOKIE)?.value;

    if (sessionToken) {
        try {
            await fetch(new URL('/v1/admin-auth/logout', backend), {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${process.env.ADMIN_AUTH_TOKEN}`,
                    'x-admin-session-token': sessionToken,
                },
                cache: 'no-store',
            });
        } catch {
            // A sessão expira sozinha; a limpeza do cookie abaixo já basta
            // para encerrar o acesso deste navegador.
        }
    }

    store.delete(ADMIN_SESSION_COOKIE);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
