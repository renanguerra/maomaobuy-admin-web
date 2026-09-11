import type { PresignedUpload } from '@/types/api';

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

/**
 * Grava um arquivo na URL pré-assinada com um PUT direto — o R2 não
 * implementa o POST pré-assinado do S3 (responde 501 mesmo com CORS
 * liberado para POST). Devolve a `Response` crua para cada chamador decidir
 * a mensagem de erro (traduzida, com o nome do arquivo etc.).
 */
export async function uploadToPresignedUrl(presigned: PresignedUpload, file: File): Promise<Response> {
    return fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
    });
}
