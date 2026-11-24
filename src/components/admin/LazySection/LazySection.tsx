'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';

export interface LazySectionProps<T> {
    title: string;
    description?: string;
    icon?: ReactNode;
    /** Resumo mostrado no cabeçalho depois do carregamento (ex.: "3 endereços"). */
    summary?: (data: T) => string;
    fetcher: () => Promise<T>;
    errorMessage: string;
    /** Já abre e consulta ao montar: a seção é o assunto da aba. */
    defaultOpen?: boolean;
    children: (data: T) => ReactNode;
}

/**
 * Bloco que só consulta a API quando o admin o abre pela primeira vez. A tela
 * de detalhe do usuário tem quatro listas independentes — carregar todas de
 * uma vez atrasa a informação que ele veio ver.
 */
export function LazySection<T>({
    title,
    description,
    icon,
    summary,
    fetcher,
    errorMessage,
    defaultOpen = false,
    children,
}: LazySectionProps<T>) {
    const [open, setOpen] = useState(defaultOpen);
    const [loading, setLoading] = useState(defaultOpen);
    const [error, setError] = useState<string>();
    const [data, setData] = useState<T>();

    async function load() {
        try {
            setData(await fetcher());
        } catch {
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!defaultOpen) return;
        // `fetcher` e as mensagens nascem a cada render de quem usa; aqui só
        // importa a primeira consulta, ao montar.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function toggle() {
        if (open) {
            setOpen(false);
            return;
        }
        setOpen(true);
        if (data !== undefined || loading) return;

        setLoading(true);
        setError(undefined);
        await load();
    }

    return (
        <section className="mm-card">
            <h2 className="m-0">
                <button
                    className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-5 py-4 text-left"
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                >
                    {icon && (
                        <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-night-brand dark:text-night-accent [&>svg]:h-4.5 [&>svg]:w-4.5"
                            aria-hidden="true"
                        >
                            {icon}
                        </span>
                    )}
                    <span className="min-w-0 flex-1">
                        <span className="mm-display block text-base text-ink dark:text-night-text">{title}</span>
                        {(description || (data !== undefined && summary)) && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-muted dark:text-night-muted">
                                {data !== undefined && summary ? summary(data) : description}
                            </span>
                        )}
                    </span>
                    {loading ? (
                        <LoaderCircle
                            className="h-4 w-4 shrink-0 animate-spin text-muted dark:text-night-muted"
                            aria-hidden="true"
                        />
                    ) : (
                        <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted transition dark:text-night-muted ${open ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    )}
                </button>
            </h2>

            {open && (
                <div className="border-t border-line px-5 py-5 dark:border-night-line">
                    {error && (
                        <Alert tone="danger">
                            <p>{error}</p>
                        </Alert>
                    )}
                    {data !== undefined && children(data)}
                </div>
            )}
        </section>
    );
}
