'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PaginationProps {
    page: number;
    totalPages: number;
    /** Texto já pronto: "Página 2 de 7 · 128 pedidos". */
    summary: string;
    previousLabel: string;
    nextLabel: string;
    onChange: (page: number) => void;
    disabled?: boolean;
    className?: string;
}

/** Rodapé de listagem: onde estou, quantos são, como avanço. */
export function Pagination({
    page,
    totalPages,
    summary,
    previousLabel,
    nextLabel,
    onChange,
    disabled = false,
    className = '',
}: PaginationProps) {
    return (
        <nav
            className={[
                'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 dark:border-night-line',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            aria-label={summary}
        >
            <p className="m-0 text-xs text-muted dark:text-night-muted" aria-live="polite">
                {summary}
            </p>
            <div className="flex gap-2">
                <Button
                    size="small"
                    variant="secondary"
                    leadingIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => onChange(page - 1)}
                    disabled={disabled || page <= 1}
                >
                    {previousLabel}
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() => onChange(page + 1)}
                    disabled={disabled || page >= totalPages}
                >
                    {nextLabel}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
        </nav>
    );
}
