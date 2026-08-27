import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/admin/Skeleton';

export type StatCardTone = 'neutral' | 'brand' | 'warning' | 'success' | 'danger';

export interface StatCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    href?: string;
    tone?: StatCardTone;
    loading?: boolean;
}

const ICON_TONE_CLASSES: Record<StatCardTone, string> = {
    neutral: 'bg-warm-200 text-warm-700 dark:bg-night-raised dark:text-night-muted',
    brand: 'bg-brand-50 text-brand-700 dark:bg-night-brand dark:text-night-accent',
    warning: 'bg-amber-50 text-amber-700 dark:bg-night-warning-surface dark:text-night-warning',
    success: 'bg-jade-50 text-jade-700 dark:bg-night-success-surface dark:text-night-success',
    danger: 'bg-origin-50 text-origin-700 dark:bg-night-coral-surface dark:text-night-coral',
};

/**
 * Indicador do painel inicial. Quando aponta para uma fila de trabalho, o
 * cartão inteiro é o link para a listagem já filtrada — o número e a ação de
 * resolvê-lo ficam no mesmo lugar.
 */
export function StatCard({ label, value, hint, icon: Icon, href, tone = 'neutral', loading = false }: StatCardProps) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ICON_TONE_CLASSES[tone]}`}>
                    <Icon className="h-4.5 w-4.5" aria-hidden={true} />
                </span>
                {href && (
                    <ArrowUpRight
                        className="h-4 w-4 text-warm-400 transition group-hover:text-primary dark:text-night-subtle dark:group-hover:text-night-accent"
                        aria-hidden="true"
                    />
                )}
            </div>
            <p className="mt-3.5 mb-0 text-xs font-semibold tracking-[.06em] text-muted uppercase dark:text-night-subtle">
                {label}
            </p>
            {loading ? (
                <Skeleton className="mt-1.5 h-8 w-14" />
            ) : (
                <p className="mm-data m-0 mt-1 text-3xl leading-tight font-bold text-ink dark:text-night-text">
                    {value}
                </p>
            )}
            {hint && <p className="mt-1 mb-0 text-xs text-muted dark:text-night-muted">{hint}</p>}
        </>
    );

    if (!href) return <div className="mm-card p-4">{content}</div>;

    return (
        <Link
            className="mm-card group block p-4 text-inherit no-underline transition hover:border-brand-300 hover:shadow-[0_10px_28px_rgba(23,34,38,.08)] dark:hover:border-night-accent/40"
            href={href}
        >
            {content}
        </Link>
    );
}
