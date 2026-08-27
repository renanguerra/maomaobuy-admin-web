import { Skeleton } from '@/components/admin/Skeleton';

/**
 * Placeholder das listagens que leem a URL (`useSearchParams`): reserva a
 * altura do cabeçalho e da tabela para a página não pular quando o conteúdo
 * real entra.
 */
export function ListPageFallback() {
    return (
        <div className="grid gap-6" aria-hidden="true">
            <div>
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="mt-3 h-8 w-56" />
                <Skeleton className="mt-3 h-4 w-full max-w-md" />
            </div>
            <div className="mm-card">
                <div className="border-b border-line px-4 py-3 dark:border-night-line">
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid gap-3 p-4">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton className="h-10 w-full" key={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}
