export interface QuantityBadgeProps {
    quantity: number;
    /** `small` cabe dentro de um rótulo de checkbox. */
    size?: 'default' | 'small';
    className?: string;
}

/**
 * Quantidade da linha em destaque, no lugar do ícone genérico. Era um texto
 * pequeno embaixo do nome ("quantidade 3") e quem montava o pacote contava as
 * linhas, não as unidades. Acima de uma unidade o selo ganha a cor da marca:
 * é justamente o caso que se deixa passar.
 */
export function QuantityBadge({ quantity, size = 'default', className = '' }: QuantityBadgeProps) {
    const multiple = quantity > 1;
    return (
        <span
            aria-hidden="true"
            className={[
                'mm-data inline-grid shrink-0 place-items-center font-bold tabular-nums',
                size === 'small' ? 'h-6 min-w-6 rounded-md px-1.5 text-xs' : 'h-9 min-w-9 rounded-lg px-2 text-sm',
                multiple
                    ? 'bg-brand-700 text-white dark:bg-night-brand dark:text-night-accent'
                    : 'bg-warm-200 text-ink dark:bg-night-raised dark:text-night-text',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {quantity}×
        </span>
    );
}
