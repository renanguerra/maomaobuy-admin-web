export interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <span
            className={['block animate-pulse rounded-md bg-warm-200 dark:bg-night-raised', className]
                .filter(Boolean)
                .join(' ')}
            aria-hidden="true"
        />
    );
}

/** Esqueleto de tabela — mantém a altura da lista enquanto a página carrega. */
export function SkeletonTable({ rows = 6, columns = 5, label }: { rows?: number; columns?: number; label: string }) {
    return (
        <div className="p-4" aria-busy="true" aria-live="polite">
            <span className="sr-only">{label}</span>
            <div className="grid gap-3">
                {Array.from({ length: rows }, (_, rowIndex) => (
                    <div className="flex items-center gap-4" key={rowIndex}>
                        {Array.from({ length: columns }, (_, columnIndex) => (
                            <Skeleton className={`h-4 ${columnIndex === 0 ? 'w-1/4' : 'flex-1'}`} key={columnIndex} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Esqueleto de blocos empilhados — cartões de detalhe, listas de itens. */
export function SkeletonCards({ count = 3, label }: { count?: number; label: string }) {
    return (
        <div className="grid gap-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">{label}</span>
            {Array.from({ length: count }, (_, index) => (
                <div className="mm-card p-4" key={index}>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2.5 h-4 w-2/5" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
            ))}
        </div>
    );
}
