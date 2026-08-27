import type { ReactNode } from 'react';

export interface DescriptionItem {
    label: ReactNode;
    value: ReactNode;
    /** Ocupa a linha inteira — endereços, descrições, motivos. */
    wide?: boolean;
    /** Valor numérico ou código: dígitos de largura fixa. */
    numeric?: boolean;
}

export interface DescriptionListProps {
    items: readonly DescriptionItem[];
    /** Colunas em telas largas. */
    columns?: 2 | 3;
    className?: string;
}

const COLUMN_CLASSES = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
} as const;

/**
 * Grade de "rótulo acima, valor abaixo" usada nos cabeçalhos de detalhe.
 * Rótulo pequeno e apagado, valor em destaque: dá para varrer a coluna de
 * valores sem ler os rótulos de novo a cada pedido.
 */
export function DescriptionList({ items, columns = 3, className = '' }: DescriptionListProps) {
    return (
        <dl
            className={['m-0 grid grid-cols-1 gap-x-6 gap-y-5', COLUMN_CLASSES[columns], className]
                .filter(Boolean)
                .join(' ')}
        >
            {items.map((item, index) => (
                <div className={item.wide ? 'sm:col-span-full' : 'min-w-0'} key={index}>
                    <dt className="text-xs font-semibold tracking-[.05em] text-muted uppercase dark:text-night-subtle">
                        {item.label}
                    </dt>
                    <dd
                        className={`m-0 mt-1 text-sm font-semibold break-words text-ink dark:text-night-text ${
                            item.numeric ? 'mm-data' : ''
                        }`}
                    >
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
