import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
    /** Origem ou tipo do registro, na linha do link de voltar. Só quando diz algo que o título não diz. */
    kicker?: ReactNode;
    title: ReactNode;
    /** Selo ao lado do título (situação do pedido, do pacote, do usuário). */
    badge?: ReactNode;
    description?: ReactNode;
    /** Contexto na linha abaixo do título (cliente, código, e-mail). */
    meta?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    backLabel?: string;
    className?: string;
}

/**
 * Cabeçalho padrão de toda tela do painel: quem sou, onde estou, o que posso
 * fazer daqui. Título e situação à esquerda, com o contexto na linha de baixo;
 * ações à direita. Em telas de detalhe as ações são um
 * `PageActions` e os avisos, um `PageNotices` logo abaixo.
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
            {(backHref || kicker) && (
                <p className="m-0 mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted dark:text-night-muted">
                    {backHref && (
                        <Link
                            className="inline-flex items-center gap-0.5 font-semibold text-inherit no-underline transition hover:text-primary dark:hover:text-night-accent"
                            href={backHref}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            {backLabel}
                        </Link>
                    )}
                    {backHref && kicker && <span aria-hidden="true">·</span>}
                    {kicker && <span>{kicker}</span>}
                </p>
            )}

            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 sm:flex-[1_1_24rem]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h1 className="mm-display m-0 text-xl break-words sm:text-2xl">{title}</h1>
                        {badge}
                    </div>
                    {meta && (
                        <div className="mt-1 min-w-0 text-sm break-words text-muted dark:text-night-muted">{meta}</div>
                    )}
                    {description && (
                        <p className="mt-1 mb-0 max-w-3xl text-sm leading-snug text-muted dark:text-night-muted">
                            {description}
                        </p>
                    )}
                </div>

                {/* `max-w-full` e não `shrink-0`: com muitas ações o grupo quebra
                    linha dentro do cabeçalho em vez de empurrar a página. */}
                {actions && (
                    <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:w-full sm:ml-auto sm:justify-end">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
