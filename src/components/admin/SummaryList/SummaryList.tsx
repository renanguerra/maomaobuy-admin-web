import type { ReactNode } from 'react';

export interface SummaryRow {
    label: ReactNode;
    value: ReactNode;
    /** Destaca a linha como total do bloco. */
    emphasis?: boolean;
}

export interface SummaryListProps {
    rows: readonly SummaryRow[];
    className?: string;
}

/** Pares rótulo/valor em coluna estreita — resumo financeiro e datas. */
export function SummaryList({ rows, className = '' }: SummaryListProps) {
    return (
        <dl className={['m-0 grid gap-0', className].filter(Boolean).join(' ')}>
            {rows.map((row, index) => (
                <div
                    className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 ${
                        index > 0 ? 'border-t border-line dark:border-night-line' : ''
                    }`}
                    key={index}
                >
                    <dt
                        className={`text-xs ${
                            row.emphasis
                                ? 'font-bold text-ink dark:text-night-text'
                                : 'text-muted dark:text-night-muted'
                        }`}
                    >
                        {row.label}
                    </dt>
                    <dd
                        className={`mm-data m-0 text-right text-sm font-semibold text-ink dark:text-night-text ${
                            row.emphasis ? 'text-base' : ''
                        }`}
                    >
                        {row.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
