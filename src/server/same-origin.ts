import type { NextRequest } from 'next/server';

function normalizedOrigin(value: string) {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

export function isSameOriginRequest(request: NextRequest) {
    const configuredOrigin = process.env.APP_ORIGIN;
    const allowedOrigin = configuredOrigin ? normalizedOrigin(configuredOrigin) : request.nextUrl.origin;
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const fetchSite = request.headers.get('sec-fetch-site');

    if (!allowedOrigin || (fetchSite && fetchSite !== 'same-origin')) return false;
    if (origin) return normalizedOrigin(origin) === allowedOrigin;
    if (referer) return normalizedOrigin(referer) === allowedOrigin;

    return false;
}
