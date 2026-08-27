import type { ReactNode } from 'react';
import type { StatusTone } from './status-tone';

export interface StatusPillProps {
    tone?: StatusTone;
    children: ReactNode;
    /** Oculta o marcador circular — útil em tabelas muito densas. */
    hideDot?: boolean;
    className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
    neutral:
        'border-warm-300 bg-warm-200 text-warm-700 dark:border-night-line dark:bg-night-raised dark:text-night-muted',
    info: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-night-accent/25 dark:bg-night-brand dark:text-night-accent-strong',
    warning:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-night-warning/25 dark:bg-night-warning-surface dark:text-night-warning',
    success:
        'border-jade-200 bg-jade-50 text-jade-700 dark:border-night-success/25 dark:bg-night-success-surface dark:text-night-success',
    danger: 'border-origin-200 bg-origin-50 text-origin-700 dark:border-night-coral/25 dark:bg-night-coral-surface dark:text-night-coral',
};

const DOT_CLASSES: Record<StatusTone, string> = {
    neutral: 'bg-warm-500 dark:bg-night-subtle',
    info: 'bg-brand-500',
    warning: 'bg-amber-400',
    success: 'bg-jade-500',
    danger: 'bg-origin-500',
};

/** Selo de situação. Mesma cor para a mesma situação em toda a aplicação. */
export function StatusPill({ tone = 'neutral', children, hideDot = false, className = '' }: StatusPillProps) {
    return (
        <span
            className={[
                'inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-none font-semibold',
                TONE_CLASSES[tone],
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {!hideDot && (
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />
            )}
            <span className="truncate">{children}</span>
        </span>
    );
}
