import type { ReactNode } from 'react';

export interface SectionCardProps {
    title?: ReactNode;
    description?: ReactNode;
    /** Ícone decorativo à esquerda do título. */
    icon?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    /** Remove o padding do corpo — use com tabelas e listas divididas. */
    flush?: boolean;
    /** Cabeçalho e corpo mais compactos. */
    dense?: boolean;
    className?: string;
    bodyClassName?: string;
}

/** Bloco de conteúdo do painel: cabeçalho com ação à direita e corpo abaixo. */
export function SectionCard({
    title,
    description,
    icon,
    action,
    children,
    flush = false,
    dense = false,
    className = '',
    bodyClassName = '',
}: SectionCardProps) {
    return (
        <section className={['mm-card', className].filter(Boolean).join(' ')}>
            {(title || action) && (
                <header
                    className={`flex flex-wrap items-center justify-between gap-3 border-b border-line dark:border-night-line ${
                        dense ? 'px-4 py-3' : 'px-5 py-4'
                    }`}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        {icon && (
                            <span
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-night-brand dark:text-night-accent [&>svg]:h-4.5 [&>svg]:w-4.5"
                                aria-hidden="true"
                            >
                                {icon}
                            </span>
                        )}
                        <div className="min-w-0">
                            {title && <h2 className="mm-display m-0 text-base">{title}</h2>}
                            {description && (
                                <p className="mt-0.5 mb-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                    {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
                </header>
            )}
            <div className={[flush ? '' : dense ? 'p-4' : 'p-5', bodyClassName].filter(Boolean).join(' ')}>
                {children}
            </div>
        </section>
    );
}
