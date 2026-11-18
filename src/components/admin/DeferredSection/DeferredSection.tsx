'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DeferredSectionProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    /** Começa aberta (seção principal naquela etapa). */
    defaultOpen?: boolean;
    /** Sem o recuo interno, para listas que vão de borda a borda. */
    flush?: boolean;
    /**
     * O conteúdo só é montado na primeira vez que a seção abre — é aí que os
     * componentes de dentro fazem as consultas deles. Fechar só esconde: abrir
     * de novo não consulta outra vez.
     */
    children: ReactNode;
}

/**
 * Seção secundária que começa recolhida e só monta (e consulta) quando o
 * admin a abre. Para blocos com consulta própria que não são o assunto
 * principal da tela, como mensagens e controle interno do pacote.
 */
export function DeferredSection({
    title,
    description,
    icon,
    defaultOpen = false,
    flush = false,
    children,
}: DeferredSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [mounted, setMounted] = useState(defaultOpen);

    return (
        <section className="mm-card">
            <h2 className="m-0">
                <button
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-5 py-4 text-left"
                    onClick={() => {
                        setOpen((value) => !value);
                        setMounted(true);
                    }}
                    type="button"
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
                        {description && (
                            <span className="mt-0.5 block text-xs font-normal text-muted dark:text-night-muted">
                                {description}
                            </span>
                        )}
                    </span>
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted transition dark:text-night-muted ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
            </h2>
            {mounted && (
                <div
                    className={`border-t border-line dark:border-night-line ${flush ? '' : 'px-5 py-5'}`}
                    hidden={!open}
                >
                    {children}
                </div>
            )}
        </section>
    );
}
