export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly body?: unknown,
    ) {
        super(message);
    }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: {
            ...(init?.body ? { 'content-type': 'application/json' } : {}),
            ...init?.headers,
        },
    });
    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
        const message =
            typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
                ? body.message
                : 'Não foi possível concluir a solicitação.';
        throw new ApiError(response.status, message, body);
    }
    return body as T;
}
