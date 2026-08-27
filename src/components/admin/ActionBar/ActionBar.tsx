import type { ReactNode } from 'react';

export interface ActionBarProps {
    /** O que o registro está esperando agora. */
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

/**
 * Faixa com as ações possíveis no estado atual do registro. Só aparece quando
 * existe algo a fazer, então o admin não precisa decorar quais botões valem
 * para cada situação — a página só oferece os que o backend aceita.
 */
export function ActionBar({ title, description, children, className = '' }: ActionBarProps) {
    return (
        <div
            className={[
                'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5 dark:border-night-accent/25 dark:bg-night-brand',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="min-w-0">
                <p className="m-0 text-sm font-bold text-brand-900 dark:text-night-text">{title}</p>
                {description && (
                    <p className="mt-0.5 mb-0 text-xs text-brand-800/80 dark:text-night-muted">{description}</p>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}
