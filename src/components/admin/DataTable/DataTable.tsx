import type { ReactNode } from 'react';
import { SkeletonTable } from '@/components/admin/Skeleton';

export interface DataTableColumn<T> {
    key: string;
    header: ReactNode;
    cell: (row: T) => ReactNode;
    align?: 'left' | 'right';
    /** Valor numérico — alinha à direita e usa dígitos de largura fixa. */
    numeric?: boolean;
    /** Esconde a coluna em telas menores que o ponto informado. */
    hideBelow?: 'sm' | 'md' | 'lg';
    width?: string;
    /**
     * Como a coluna aparece no cartão do celular: `hide` a omite e `full`
     * ocupa a linha inteira sem rótulo (usado pela coluna de ações).
     */
    card?: 'hide' | 'full';
}

export interface DataTableProps<T> {
    columns: readonly DataTableColumn<T>[];
    rows: readonly T[];
    rowKey: (row: T) => string;
    /** Descrição da tabela para leitores de tela. */
    caption: string;
    loading?: boolean;
    loadingLabel: string;
    /** Mostrado no lugar do corpo quando não há linhas. */
    empty: ReactNode;
    /** Largura mínima antes de a tabela rolar na horizontal. */
    minWidth?: string;
    className?: string;
}

const HIDE_BELOW_CLASSES = {
    sm: 'hidden sm:table-cell',
    md: 'hidden md:table-cell',
    lg: 'hidden lg:table-cell',
} as const;

function columnClasses<T>(column: DataTableColumn<T>, extra: string) {
    return [
        extra,
        column.numeric || column.align === 'right' ? 'text-right' : 'text-left',
        column.hideBelow ? HIDE_BELOW_CLASSES[column.hideBelow] : '',
    ]
        .filter(Boolean)
        .join(' ');
}

/**
 * Listagem do painel em duas formas a partir da mesma definição de colunas:
 * tabela no desktop (cabeçalho, colunas secundárias que somem conforme a tela
 * estreita) e cartões empilhados no celular, onde uma tabela de seis colunas
 * viraria rolagem horizontal às cegas.
 */
export function DataTable<T>({
    columns,
    rows,
    rowKey,
    caption,
    loading = false,
    loadingLabel,
    empty,
    minWidth = '48rem',
    className = '',
}: DataTableProps<T>) {
    if (loading) return <SkeletonTable columns={Math.min(columns.length, 5)} label={loadingLabel} />;
    if (rows.length === 0) return <>{empty}</>;

    const [primary, ...rest] = columns;

    return (
        <>
            <div className={['mm-scroll-x max-sm:hidden', className].filter(Boolean).join(' ')}>
                <table className="w-full border-collapse text-sm" style={{ minWidth }}>
                    <caption className="sr-only">{caption}</caption>
                    <thead>
                        <tr className="border-b border-line dark:border-night-line">
                            {columns.map((column) => (
                                <th
                                    className={columnClasses(
                                        column,
                                        'bg-warm-100 px-4 py-2.5 text-xs font-bold tracking-[.06em] text-muted uppercase dark:bg-night-canvas dark:text-night-subtle',
                                    )}
                                    key={column.key}
                                    scope="col"
                                    style={column.width ? { width: column.width } : undefined}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                className="border-b border-line transition last:border-b-0 hover:bg-warm-100 dark:border-night-line dark:hover:bg-night-raised/60"
                                key={rowKey(row)}
                            >
                                {columns.map((column) => (
                                    <td
                                        className={columnClasses(
                                            column,
                                            `px-4 py-3 align-middle ${column.numeric ? 'mm-data whitespace-nowrap' : ''}`,
                                        )}
                                        key={column.key}
                                    >
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="m-0 grid list-none gap-0 p-0 sm:hidden" aria-label={caption}>
                {rows.map((row) => (
                    <li
                        className="border-b border-line px-4 py-3.5 last:border-b-0 dark:border-night-line"
                        key={rowKey(row)}
                    >
                        <div className="text-sm font-semibold text-ink dark:text-night-text">{primary.cell(row)}</div>
                        <dl className="m-0 mt-2 grid gap-1.5">
                            {rest
                                .filter((column) => column.card !== 'hide')
                                .map((column) =>
                                    column.card === 'full' ? (
                                        <dd className="m-0 mt-1" key={column.key}>
                                            {column.cell(row)}
                                        </dd>
                                    ) : (
                                        <div
                                            className="flex flex-wrap items-baseline justify-between gap-x-4"
                                            key={column.key}
                                        >
                                            <dt className="text-xs text-muted dark:text-night-subtle">
                                                {column.header}
                                            </dt>
                                            <dd
                                                className={`m-0 text-right text-sm text-ink dark:text-night-text ${
                                                    column.numeric ? 'mm-data' : ''
                                                }`}
                                            >
                                                {column.cell(row)}
                                            </dd>
                                        </div>
                                    ),
                                )}
                        </dl>
                    </li>
                ))}
            </ul>
        </>
    );
}
