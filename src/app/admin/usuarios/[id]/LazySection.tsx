'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react';

interface LazySectionProps<T> {
    title: string;
    icon: ReactNode;
    fetcher: () => Promise<T>;
    errorMessage: string;
    children: (data: T) => ReactNode;
}

/**
 * Painel que só busca dados na API quando o admin o abre pela primeira vez —
 * a página de detalhe do usuário deve exibir apenas o essencial ao carregar.
 */
export function LazySection<T>({ title, icon, fetcher, errorMessage, children }: LazySectionProps<T>) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [data, setData] = useState<T>();

    async function toggle() {
        if (open) {
            setOpen(false);
            return;
        }
        setOpen(true);
        if (data !== undefined) return;
        setLoading(true);
        setError(undefined);
        try {
            setData(await fetcher());
        } catch {
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="mm-panel mt-6 p-0">
            <button
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-6 py-4 text-left text-lg font-bold"
                type="button"
                onClick={toggle}
                aria-expanded={open}
            >
                <span className="flex items-center gap-3">
                    {icon}
                    {title}
                </span>
                {loading ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted dark:text-night-muted" aria-hidden="true" />
                ) : open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted dark:text-night-muted" aria-hidden="true" />
                ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted dark:text-night-muted" aria-hidden="true" />
                )}
            </button>

            {open && (
                <div className="border-t border-line px-6 py-5 dark:border-night-line">
                    {error && <p className="border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
                    {data !== undefined && children(data)}
                </div>
            )}
        </section>
    );
}
