'use client';

import type { InputProps } from './Input.types';

export function Input({ id, label, hint, error, className = '', ...props }: InputProps) {
    const inputId = id ?? `field-${label.toLowerCase().replaceAll(' ', '-')}`;
    const supportId = hint || error ? `${inputId}-support` : undefined;

    return (
        <label className="grid gap-2 text-ink dark:text-night-text" htmlFor={inputId}>
            <span className="text-sm font-semibold">{label}</span>
            <input
                id={inputId}
                aria-describedby={supportId}
                aria-invalid={Boolean(error)}
                className={[
                    'min-h-12 w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-ink shadow-sm transition hover:border-brand-300 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-warm-200 dark:border-night-line dark:bg-night-surface dark:text-night-text dark:focus:border-night-accent/70 dark:focus:ring-brand-900/50',
                    error ? 'border-secondary' : '',
                    className,
                ]
                    .filter(Boolean)
                    .join(' ')}
                {...props}
            />

            {(error || hint) && (
                <span
                    id={supportId}
                    className={[
                        'text-xs leading-relaxed text-muted dark:text-night-muted',
                        error ? 'text-secondary' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
                    {error ?? hint}
                </span>
            )}
        </label>
    );
}
