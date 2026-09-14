'use client';

import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { Skeleton } from '@/components/admin/Skeleton';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { ApiError, api } from '@/services/api';
import { formatDate } from '@/types/api';

interface Message {
    id: string;
    authorType: 'CUSTOMER' | 'ADMIN';
    authorName: string;
    body: string;
    createdAt: string;
}

/**
 * Ninguém responde na hora — não faz sentido bater no servidor a cada poucos
 * segundos. Quem precisa saber de uma mensagem nova do cliente fica sabendo
 * pelo alerta interno; o polling aqui é só pra não exigir refresh manual de
 * quem está com a tela aberta.
 */
const POLL_INTERVAL_MS = 120_000;
const MAX_LENGTH = 4000;

/**
 * Conversa de um pedido ou pacote. Sem WebSocket/SSE no projeto — atualiza
 * por polling, e só enquanto a aba está visível.
 */
export function MessageThread({ endpoint }: { endpoint: string }) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<Message[]>();
    const [error, setError] = useState<string>();
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(() => {
        api<Message[]>(endpoint)
            .then((data) => setMessages(data))
            .catch(() => setError(t('messages.loadError')));
    }, [endpoint, t]);

    useEffect(() => {
        load();
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') load();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [load]);

    async function send() {
        const trimmed = text.trim();
        if (!trimmed) return;
        setSending(true);
        setError(undefined);
        try {
            const message = await api<Message>(endpoint, {
                method: 'POST',
                body: JSON.stringify({ text: trimmed }),
            });
            setMessages((current) => [...(current ?? []), message]);
            setText('');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('messages.sendError'));
        } finally {
            setSending(false);
        }
    }

    if (!messages) {
        return (
            <div className="grid gap-3">
                <Skeleton className="h-14 w-3/4 rounded-lg" />
                <Skeleton className="ml-auto h-14 w-3/4 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {messages.length === 0 ? (
                <p className="m-0 text-sm text-muted dark:text-night-muted">{t('messages.empty')}</p>
            ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                    {messages.map((message) => (
                        <li
                            className={`flex ${message.authorType === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                            key={message.id}
                        >
                            <div
                                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                                    message.authorType === 'ADMIN'
                                        ? 'bg-brand-700 text-white dark:bg-brand-600'
                                        : 'bg-warm-100 text-ink dark:bg-night-raised dark:text-night-text'
                                }`}
                            >
                                <p className="m-0 leading-relaxed whitespace-pre-wrap">{message.body}</p>
                                <p
                                    className={`m-0 mt-1 text-[0.7rem] ${
                                        message.authorType === 'ADMIN'
                                            ? 'text-white/70'
                                            : 'text-muted dark:text-night-subtle'
                                    }`}
                                >
                                    {message.authorName} · {formatDate(message.createdAt)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}

            <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                }}
            >
                <textarea
                    aria-label={t('messages.placeholder')}
                    className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand-400 focus:outline-none dark:border-night-line dark:bg-night-canvas dark:text-night-text"
                    maxLength={MAX_LENGTH}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={t('messages.placeholder')}
                    rows={2}
                    value={text}
                />
                <Button aria-label={t('messages.send')} disabled={!text.trim()} loading={sending} type="submit">
                    <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
            </form>
        </div>
    );
}
