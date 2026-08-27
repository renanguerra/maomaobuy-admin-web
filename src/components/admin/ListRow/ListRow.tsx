import type { ReactNode } from 'react';
import Link from 'next/link';

export interface ListRowProps {
    /** Quando informado, a linha inteira vira link para o registro. */
    href?: string;
    /** Miniatura ou ícone à esquerda. */
    leading?: ReactNode;
    title: ReactNode;
    meta?: ReactNode;
    /** Selo de situação. */
    pill?: ReactNode;
    /** Valor à direita (dinheiro, quantidade). */
    value?: ReactNode;
    /** Botões de ação — só em linhas sem `href`, para não aninhar clicáveis. */
    actions?: ReactNode;
    className?: string;
}

/**
 * Linha de lista compacta usada fora das tabelas: itens de um pedido, pacotes
 * de um usuário, anexos. Mesma anatomia sempre — identificação à esquerda,
 * situação e valor à direita.
 */
export function ListRow({ href, leading, title, meta, pill, value, actions, className = '' }: ListRowProps) {
    const content = (
        <>
            {leading && <span className="shrink-0">{leading}</span>}
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold break-words text-ink dark:text-night-text">{title}</span>
                {meta && <span className="mt-0.5 block text-xs text-muted dark:text-night-muted">{meta}</span>}
            </span>
            {pill}
            {value && (
                <span className="mm-data shrink-0 text-sm font-semibold text-ink dark:text-night-text">{value}</span>
            )}
            {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
        </>
    );

    const base = ['flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', className].filter(Boolean).join(' ');

    if (href) {
        return (
            <Link
                className={`${base} no-underline transition hover:bg-warm-100 dark:hover:bg-night-raised/60`}
                href={href}
            >
                {content}
            </Link>
        );
    }

    return <div className={base}>{content}</div>;
}

/** Lista de `ListRow` com divisórias e borda — o par natural de `SectionCard flush`. */
export function ListRows({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <ul
            className={[
                'm-0 grid list-none gap-0 p-0 [&>li]:border-b [&>li]:border-line [&>li:last-child]:border-b-0 dark:[&>li]:border-night-line',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {children}
        </ul>
    );
}
