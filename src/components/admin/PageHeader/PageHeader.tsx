import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
    /** Etiqueta curta acima do título — situa a página dentro da área. */
    kicker?: ReactNode;
    title: ReactNode;
    /** Selo ao lado do título (situação do pedido, do pacote, do usuário). */
    badge?: ReactNode;
    description?: ReactNode;
    /** Linha de contexto abaixo do título (cliente, código, e-mail). */
    meta?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    backLabel?: string;
    className?: string;
}

/**
 * Cabeçalho padrão de toda tela do painel: quem sou, onde estou, o que posso
 * fazer daqui. As ações ficam sempre no canto superior direito para que o
 * admin não precise procurá-las em cada página.
 */
export function PageHeader({
    kicker,
    title,
    badge,
    description,
    meta,
    actions,
    backHref,
    backLabel,
    className = '',
}: PageHeaderProps) {
    return (
        <header className={className}>
            {backHref && (
                <Link
                    className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted no-underline transition hover:text-primary dark:text-night-muted dark:hover:text-night-accent"
                    href={backHref}
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    {backLabel}
                </Link>
            )}

            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0">
                    {kicker && <p className="mm-kicker mb-2.5">{kicker}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="mm-display m-0 text-2xl break-words sm:text-[1.75rem]">{title}</h1>
                        {badge}
                    </div>
                    {meta && <div className="mt-1.5 text-sm text-muted dark:text-night-muted">{meta}</div>}
                    {description && (
                        <p className="mt-2 mb-0 max-w-2xl text-sm leading-relaxed text-muted dark:text-night-muted">
                            {description}
                        </p>
                    )}
                </div>

                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </header>
    );
}
