import type { ReactNode } from 'react';

export interface ToolbarProps {
    /** Filtros e busca, alinhados à esquerda. */
    children: ReactNode;
    /** Ações da listagem, alinhadas à direita. */
    actions?: ReactNode;
    className?: string;
}

/**
 * Faixa de filtros acima de uma listagem. Fica dentro do cartão da tabela
 * para deixar claro que tudo ali afeta as linhas logo abaixo.
 */
export function Toolbar({ children, actions, className = '' }: ToolbarProps) {
    return (
        <div
            className={[
                'flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3 dark:border-night-line',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
